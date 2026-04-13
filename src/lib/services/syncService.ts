import { get } from 'svelte/store';
import { sesionApp } from '$lib/stores/authStore';

const BASE_URL = 'https://syncserver.ejvapps.online';
const APP_ID = 'rassembly'; 
const SERVER_TOKEN = 'ejv_server_2026'; // Token obligatorio para que el servidor acepte la petición

/**
 * Arma las cabeceras requeridas por el servidor de EJVApps
 */
function obtenerCabeceras(tokenUsuario?: string) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Server-Token': SERVER_TOKEN
    };
    
    if (tokenUsuario) {
        headers['Authorization'] = `Bearer ${tokenUsuario}`;
    }
    return headers;
}

/**
 * Detecta el nombre del dispositivo para el registro de la nube
 */
export function obtenerNombreDispositivo(): string {
    if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent;
        if (ua.includes("Android")) return "Android";
        if (ua.includes("Windows")) return "PC Windows";
        if (ua.includes("Mac OS")) return "MacBook / iMac";
        if (ua.includes("Linux")) return "Linux";
    }
    return "Dispositivo Desconocido";
}

export const SyncService = {
    /**
     * 1. SOLICITAR CÓDIGO OTP
     */
    async solicitarOTP(email: string) {
        const response = await fetch(`${BASE_URL}/api/auth/request-code`, {
            method: 'POST',
            headers: obtenerCabeceras(),
            body: JSON.stringify({ email })
        });
        
        if (!response.ok) throw new Error('Error al solicitar el código. Verifica tu correo.');
        return await response.json(); 
    },

    /**
     * 2. VERIFICAR CÓDIGO Y OBTENER TOKEN
     */
    // En RAssembly, asegúrate de que el retorno sea directo como en la otra app
async verificarOTP(email: string, code: string) {
    const response = await fetch(`${BASE_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: obtenerCabeceras(),
        body: JSON.stringify({ email, code })
    });
    
    // Si el servidor responde pero no es OK, esto evita que se quede "plasmado"
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Código incorrecto o expirado.');
    }
    
    return await response.json(); 
},

    /**
     * 3. CHEQUEAR ESTADO EN LA NUBE (RADAR)
     */
    async chequearEstadoNube() {
        const sesion = get(sesionApp);
        const response = await fetch(`${BASE_URL}/api/backups/${APP_ID}/check`, {
            method: 'GET',
            headers: obtenerCabeceras(sesion.token)
        });

        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Error al chequear el estado en la nube.');
        
        const data = await response.json();
        return data.backup; // Retorna { last_synced_at, last_device }
    },

    /**
     * 4. SUBIR RESPALDO (UPLOAD)
     */
    async subirRespaldo(backupDataJson: string, fechaSync: string, dispositivo: string) {
        const sesion = get(sesionApp);
        const response = await fetch(`${BASE_URL}/api/backups/${APP_ID}`, {
            method: 'POST',
            headers: obtenerCabeceras(sesion.token),
            body: JSON.stringify({ 
                backup_data: backupDataJson,
                last_device: dispositivo,
                last_synced_at: fechaSync
            })
        });

        if (!response.ok) throw new Error('No se pudo subir el respaldo a la nube.');
        return await response.json();
    },

    /**
     * 5. DESCARGAR RESPALDO (DOWNLOAD)
     */
    async descargarRespaldo() {
        const sesion = get(sesionApp);
        const response = await fetch(`${BASE_URL}/api/backups/${APP_ID}`, {
            method: 'GET',
            headers: obtenerCabeceras(sesion.token)
        });

        if (response.status === 404) throw new Error('No hay respaldos previos en la nube.');
        if (!response.ok) throw new Error('Error al descargar el respaldo.');
        
        const data = await response.json();
        return data.backup; // Retorna el objeto backup con el JSON dentro
    }
};