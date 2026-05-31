import { invoke } from '@tauri-apps/api/core';

// 🛡️ EL SEMÁFORO
let estaRestaurando = false;

export function iniciarRestauracion() { estaRestaurando = true; }
export function terminarRestauracion() { estaRestaurando = false; }
export function isRestaurando() { return estaRestaurando; }

// 📢 EL AVISADOR
function notificarCambioLocal() {
    if (estaRestaurando) {
        console.log("🔄 Restauración en curso, ignorando cambios.");
        return;
    }
    
    if (typeof window !== 'undefined') {
        console.log("📢 [DB] Cambio detectado. Emitiendo señal...");
        window.dispatchEvent(new CustomEvent('db_local_cambiada'));
    }
}

// 🗄️ EL EMBUDO MAESTRO
export const DB = {
    // --- LECTURA ---
    async obtenerAsambleas() {
        return await invoke('obtener_asambleas');
    },

    // --- ESCRITURA BÁSICA ---
    async crearAsamblea(datos: any) {
        const resultado = await invoke('crear_asamblea', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    async eliminarAsamblea(id: number) {
        const resultado = await invoke('eliminar_asamblea', { id });
        notificarCambioLocal();
        return resultado;
    },

    // --- NUEVAS FUNCIONES PARA ORADORES ---
    async alternarEstadoParte(id: number, tipoAccion: string, valorNuevo: boolean) {
        const resultado = await invoke('alternar_estado_parte', { id, tipoAccion, valorNuevo });
        notificarCambioLocal(); // 📢 Grita al sistema
        return resultado;
    },

    async guardarNotaDirecta(asambleaId: number, id: number, nota: string) {
        const resultado = await invoke('guardar_nota_directa', { asambleaId, id, nota });
        notificarCambioLocal(); // 📢 Grita al sistema
        return resultado;
    },

    // --- NUEVAS FUNCIONES PARA REGISTRO DE ORADORES ---
    async actualizarCheckRegistro(id: number, campo: string, valor: boolean) {
        const resultado = await invoke('actualizar_check_registro', { id, campo, valor });
        notificarCambioLocal(); // 📢 El grito de sincronización
        return resultado;
    }
};