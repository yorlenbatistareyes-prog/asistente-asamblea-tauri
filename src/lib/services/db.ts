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
    },

    // --- NUEVAS FUNCIONES ESPECÍFICAS ---
    
    // Para cartas (el editor que acabas de pasar)
    async guardarPlantillaCarta(id: string, contenido: string) {
        const resultado = await invoke('guardar_plantilla', { id, contenido });
        notificarCambioLocal(); 
        return resultado;
    },

    // Para plantillas de correos electrónicos
    async guardarPlantillaEmail(id: string, asunto: string, cuerpo: string) {
        const resultado = await invoke('guardar_plantilla_email', { id, asunto, cuerpo });
        notificarCambioLocal(); // 📢 Grita al sistema para que sincronice
        return resultado;
    },

    // Para plantillas de WhatsApp y otros mensajes
    async guardarPlantillaMensaje(id: string, asunto: string, cuerpo: string) {
        const resultado = await invoke('guardar_plantilla_mensaje', { id, asunto, cuerpo });
        notificarCambioLocal(); // 📢 Grita al sistema para que sincronice
        return resultado;
    },

    // --- FUNCIONES PARA COMITÉ Y PERSONAS ---
    async crearPersona(datos: any) {
        const resultado = await invoke('crear_persona', datos);
        notificarCambioLocal(); // 📢 Grita al sistema que hay un hermano nuevo
        return resultado;
    },

    async guardarComite(datos: any) {
        const resultado = await invoke('guardar_comite', datos);
        notificarCambioLocal(); // 📢 Grita al sistema que el comité cambió
        return resultado;
    },

    // --- FUNCIÓN PARA CONFIGURACIÓN DEL USUARIO ---
    async guardarConfiguracionGeneral(config: any) {
        const resultado = await invoke('guardar_configuracion_general', { config });
        notificarCambioLocal(); // 📢 Grita al sistema que los datos del usuario cambiaron
        return resultado;
    },

    // --- FUNCIÓN PARA GUARDAR LA RUTA DE SINCRONIZACIÓN ---
    async guardarRutaSync(ruta: string | null) {
        const resultado = await invoke('guardar_ruta_sync', { ruta });
        notificarCambioLocal(); // 📢 Grita al sistema que la carpeta cambió
        return resultado;
    },

    // --- FUNCIONES PARA CONGREGACIONES ---
    async crearCongregacion(datos: any) {
        const resultado = await invoke('crear_congregacion', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    async importarCongregacionesCsv(datos: any) {
        const resultado = await invoke('importar_congregaciones_csv', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    async eliminarCongregacion(datos: any) {
        const resultado = await invoke('eliminar_congregacion', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    async limpiarCongregaciones(datos: any) {
        const resultado = await invoke('limpiar_congregaciones', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    // --- FUNCIÓN ESPECÍFICA PARA ENSAYOS ---
    async alternarEstadoEnsayo(datos: any) {
        // Llama al backend en Rust
        const resultado = await invoke('alternar_estado_parte', datos);
        notificarCambioLocal(); // 📢 Despierta al radar
        return resultado;
    },

    // --- FUNCIÓN PARA INFORMACIÓN GENERAL DE LA ASAMBLEA ---
    async guardarInfoEvento(datos: any) {
        const resultado = await invoke('guardar_info_evento', datos);
        notificarCambioLocal(); // 📢 Grita al sistema que los detalles de la asamblea cambiaron
        return resultado;
    },

    // --- FUNCIÓN PARA EL MEMBRETE ---
    async guardarConfigMembrete(config: any) {
        // Llama a tu backend en Rust
        const resultado = await invoke('guardar_config_membrete', { config });
        notificarCambioLocal(); // 📢 Despierta al radar de sincronización
        return resultado;
    },

    // --- FUNCIONES PARA PERSONAL Y HORARIO DE OFICINA ---
    async guardarAsignacionEspecial(datos: any) {
        const resultado = await invoke('guardar_asignacion_especial', datos);
        notificarCambioLocal(); // 📢 Grita al sistema que el horario de la oficina cambió
        return resultado;
    },

    async eliminarAsignacionEspecial(datos: any) {
        const resultado = await invoke('eliminar_asignacion_especial', datos);
        notificarCambioLocal(); // 📢 Grita al sistema que se eliminó o vació una asignación
        return resultado;
    },

    async guardarDetallesOficina(datos: any) {
        const resultado = await invoke('guardar_detalles_oficina', datos);
        notificarCambioLocal(); // 📢 Grita al sistema que cambiaron las responsabilidades/disponibilidad
        return resultado;
    },

    // --- FUNCIONES PARA PERSONAS ---
    // Para la pantalla exclusiva de Personas.svelte
    async registrarPersona(datos: any) {
        const resultado = await invoke('crear_persona', datos);
        notificarCambioLocal(); // 📢 Despierta al radar
        return resultado;
    },

    async importarPersonasCsv(datos: any) {
        const resultado = await invoke('importar_personas_csv', datos);
        notificarCambioLocal(); // 📢 Grita al sistema que se importó una lista de personas
        return resultado;
    },

    async eliminarPersona(datos: any) {
        const resultado = await invoke('eliminar_persona', datos);
        notificarCambioLocal(); // 📢 Grita al sistema que se eliminó a una persona
        return resultado;
    },

    async limpiarPersonas(datos: any) {
        const resultado = await invoke('limpiar_personas', datos);
        notificarCambioLocal(); // 📢 Grita al sistema que la lista se vació por completo
        return resultado;
    },

    // --- FUNCIONES PARA EL PROGRAMA DE LA ASAMBLEA ---
    async actualizarDetallesParte(datos: any) {
        const resultado = await invoke('actualizar_detalles_parte', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    async asignarParte(datos: any) {
        const resultado = await invoke('asignar_parte', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    async crearParte(datos: any) {
        const resultado = await invoke('crear_parte', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    async limpiarPrograma(datos: any) {
        const resultado = await invoke('limpiar_programa', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    async eliminarParte(datos: any) {
        const resultado = await invoke('eliminar_parte', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    async importarProgramaJw(datos: any) {
        const resultado = await invoke('importar_programa_jw', datos);
        notificarCambioLocal(); 
        return resultado;
    },

    // --- FUNCIONES PARA ESTADÍSTICAS Y CONFIGURACIÓN DE MONITOR ---
    
    // 1. Nueva función para LEER los datos al abrir la pantalla
    async obtenerAsistencia(asambleaId: number) {
        return await invoke('obtener_asistencia_asamblea', { asambleaId });
    },

    async guardarAsistencia(asambleaId: number, datos: any) {
        // Ajustamos el nombre al comando exacto de Rust: 'guardar_asistencia_db'
        const resultado = await invoke('guardar_asistencia_db', { asambleaId, datos });
        notificarCambioLocal(); 
        return resultado;
    },

    // Ajustamos la función para que coincida con 'guardar_bautismos_db' de Rust
    async guardarBautismos(asambleaId: number, cantidad: number) {
        const resultado = await invoke('guardar_bautismos_db', { asambleaId, cantidad });
        notificarCambioLocal();
        return resultado;
    }
    
};