import { writable } from 'svelte/store';
import { load } from '@tauri-apps/plugin-store';

export const sesionApp = writable({
    correo: '',
    token: '',
    isLoggedIn: false,
    verificando: true
});

const STORE_PATH = 'sesion_rassembly.json';
let isInitialized = false; // 👈 Evita lecturas dobles

export async function inicializarSesion() {
    // Si ya sabemos quién es el usuario, no leemos el disco otra vez
    if (isInitialized) {
        sesionApp.update(s => ({ ...s, verificando: false }));
        return;
    }

    try {
        const store = await load(STORE_PATH);
        const token = await store.get<string>('token');
        const correo = await store.get<string>('correo');

        if (token && correo) {
            sesionApp.set({ correo, token, isLoggedIn: true, verificando: false });
        } else {
            sesionApp.update(s => ({ ...s, verificando: false }));
        }
    } catch (error) {
        console.error("Error inicializando sesión:", error);
        sesionApp.update(s => ({ ...s, verificando: false }));
    } finally {
        isInitialized = true; // 👈 Marcamos como listo
    }
}

export async function guardarSesion(correo: string, token: string) {
    try {
        const store = await load(STORE_PATH);
        await store.set('token', token);
        await store.set('correo', correo);
        await store.save(); 

        sesionApp.set({ correo, token, isLoggedIn: true, verificando: false });
        isInitialized = true;
    } catch (error) {
        console.error("Error guardando sesión:", error);
    }
}

export async function cerrarSesion() {
    try {
        const store = await load(STORE_PATH);
        await store.delete('token');
        await store.delete('correo');
        await store.save();

        sesionApp.set({ correo: '', token: '', isLoggedIn: false, verificando: false });
        isInitialized = false; // 👈 Permitimos que se vuelva a inicializar si alguien se loguea
    } catch (error) {
        console.error("Error cerrando sesión:", error);
    }
}