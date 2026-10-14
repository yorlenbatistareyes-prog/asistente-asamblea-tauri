import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { get } from 'svelte/store';
import { sesionApp } from '$lib/stores/authStore';

const BOVEDA_PATH = 'boveda_seguridad.json';

/**
 * Deriva una llave de 256 bits (32 bytes) en Base64 usando PBKDF2 (100,000 iteraciones).
 * Mezcla el correo del usuario (como Salt único) + la Clave Secreta (que el servidor jamás conoce).
 */
async function derivarLlaveZeroKnowledge(correo: string, passSecreto: string): Promise<string> {
    const encoder = new TextEncoder();
    
    // 1. Importamos la contraseña secreta del usuario como material criptográfico
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(passSecreto.trim()),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    // 2. Usamos el correo limpio como "Salt" para que dos usuarios con el mismo PIN tengan llaves distintas
    const salt = encoder.encode(`RAssembly_E2EE_Salt_v1_${correo.toLowerCase().trim()}`);

    // 3. Ejecutamos 100,000 rondas de SHA-256 (Frena ataques de fuerza bruta)
    const derivedBits = await window.crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256 // 256 bits = 32 bytes exactos para AES-256 en Rust
    );

    const hashArray = Array.from(new Uint8Array(derivedBits));
    return btoa(String.fromCharCode.apply(null, hashArray));
}

/**
 * Guarda la contraseña/PIN de cifrado únicamente en este dispositivo.
 */
export async function guardarPasswordCifrado(password: string): Promise<void> {
    const boveda = await load(BOVEDA_PATH);
    await boveda.set('e2ee_user_pin', password.trim());
    await boveda.save();
}

/**
 * Verifica si el dispositivo actual ya tiene configurada la clave de cifrado.
 */
export async function tienePasswordCifrado(): Promise<boolean> {
    const boveda = await load(BOVEDA_PATH);
    const pass = await boveda.get<string>('e2ee_user_pin');
    return !!pass && pass.trim().length > 0;
}

/**
 * Elimina la clave de cifrado de este dispositivo (útil al cerrar sesión o cambiar clave).
 */
export async function borrarPasswordCifrado(): Promise<void> {
    const boveda = await load(BOVEDA_PATH);
    await boveda.delete('e2ee_user_pin');
    await boveda.save();
}

/**
 * Obtiene la llave maestra para Rust.
 * - Si hay sesión en la nube: genera la llave E2EE combinando Correo + Clave Secreta.
 * - Si es uso local sin cuenta: usa la llave local aleatoria para la carpeta compartida.
 */
export async function obtenerOCrearLlave(): Promise<string> {
    try {
        const boveda = await load(BOVEDA_PATH);
        const sesion = get(sesionApp);

        // 🔒 MODO NUBE (EXTREMO A EXTREMO PURO)
        if (sesion && sesion.isLoggedIn && sesion.correo) {
            const passSecreto = await boveda.get<string>('e2ee_user_pin');
            if (!passSecreto) {
                throw new Error("Falta configurar tu Clave de Cifrado (PIN) en este dispositivo.");
            }
            return await derivarLlaveZeroKnowledge(sesion.correo, passSecreto);
        }

        // 📁 MODO 100% OFFLINE (Carpeta local sin cuenta de servidor)
        let llave = await boveda.get<string>('llave_maestra');
        if (!llave) {
            llave = await invoke<string>('generar_llave_invisible');
            await boveda.set('llave_maestra', llave);
            await boveda.save();
        }

        return llave;
    } catch (error) {
        console.error("Error al gestionar la llave de seguridad:", error);
        throw error;
    }
}

/**
 * Cifra cualquier cadena de texto (como JSON de borradores) usando AES-256-GCM en el navegador.
 */
export async function cifrarTextoLocal(textoPlano: string, llaveBase64: string): Promise<string> {
    const rawKey = Uint8Array.from(atob(llaveBase64), c => c.charCodeAt(0));
    const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );

    // Vector de inicialización (IV) único de 12 bytes
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(textoPlano);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encodedText
    );

    // Unimos el IV (12 bytes) + los datos cifrados en un solo paquete Base64
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    return btoa(String.fromCharCode.apply(null, Array.from(combined)));
}

/**
 * Descifra un paquete Base64 creado con cifrarTextoLocal usando AES-256-GCM.
 */
export async function descifrarTextoLocal(paqueteBase64: string, llaveBase64: string): Promise<string> {
    const rawKey = Uint8Array.from(atob(llaveBase64), c => c.charCodeAt(0));
    const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    );

    const combined = Uint8Array.from(atob(paqueteBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
    );

    return new TextDecoder().decode(decryptedBuffer);
}