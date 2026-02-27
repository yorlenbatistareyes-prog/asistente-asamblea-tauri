import { invoke } from '@tauri-apps/api/core';

// INTERFAZ MAESTRA
export interface ContextoDocumento {
    saludo: string;
    nombre_pila: string;
    segundo_nombre: string;
    apellidos: string;
    nombre_completo: string;
    sexo: string;
    circuito: string;

    tema_asignacion: string;
    tipo_asignacion: string;
    num_bosquejo: string;
    hora: string;
    fecha_asignacion: string;
    congregacion: string;
    nota_asignacion: string;
    
    tema_evento: string;
    tipo_evento: string;
    fecha_evento_texto: string;
    lugar_nombre: string;
    lugar_direccion: string;
    ciudad: string;
    estado: string;

    ensayo_fecha: string;
    ensayo_hora: string;
    ensayo_lugar: string;
    ensayo_direccion: string;
    ensayo_notas: string;

    orientaciones: string;
    instrucciones: string;

    email_presidente: string;
    tel_presidente: string;
}

export async function generarContexto(objeto: any, asambleaId: number, esPartePrograma: boolean): Promise<ContextoDocumento> {
    
    // 1. OBTENER DATOS GLOBALES (¡CORREGIDO!)
    // Ahora busca exactamente la asamblea que tienes abierta, no la última.
    const infoAsamblea: any = await invoke('obtener_asamblea_por_id', { id: asambleaId }) || {};
    const infoExtra: any = await invoke('obtener_info_extra_evento', { asambleaId }) || {};

    // 2. DETECCIÓN INTELIGENTE DEL NOMBRE
    let nombreCompleto = (
        objeto.nombre_orador || 
        objeto.nombre_completo || 
        objeto.nombre_presidente || 
        objeto.nombre || 
        'Hermano'
    ).trim();

    let nombrePila = '';
    let apellidos = objeto.apellidos || '';
    let segundoNombre = '';

    if (nombreCompleto && nombreCompleto !== 'Hermano') {
        const partes = nombreCompleto.replace(/\s+/g, ' ').split(' ');
        if (partes.length > 0) {
            nombrePila = partes[0];
            if (partes.length > 1) {
                if (!apellidos) apellidos = partes.slice(1).join(' '); 
                if (partes.length > 2) segundoNombre = partes[1];
            }
        }
    }

    // 3. LÓGICA DE ASIGNACIÓN
    let tipoAsignacionFinal = 'Asignación';
    let temaFinal = objeto.tema || '';

    if (esPartePrograma) {
        if (objeto.numero_bosquejo) {
            tipoAsignacionFinal = 'Discurso';
            if (!temaFinal) temaFinal = 'Discurso de Asamblea';
        } else if (objeto.tipo === 'Video') {
            tipoAsignacionFinal = 'Video';
        } else {
            tipoAsignacionFinal = objeto.tipo || 'Parte del Programa';
        }
    } else {
        const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();

        if (rol.includes('presidente')) {
            tipoAsignacionFinal = 'Presidencia';
            temaFinal = 'Presidente de la sesión';
        } else if (rol.includes('oracion') || rol.includes('oración')) {
            tipoAsignacionFinal = 'Oración';
            if (rol.includes('apertura')) temaFinal = 'Oración de apertura';
            else if (rol.includes('conclusion') || rol.includes('conclusión')) temaFinal = 'Oración de conclusión';
            else temaFinal = 'Oración';
        } else if (rol.includes('plataforma')) {
            tipoAsignacionFinal = 'Plataforma';
            temaFinal = 'Superintendente de Plataforma';
        } else if (rol.includes('bosquejo')) {
            tipoAsignacionFinal = 'Discurso'; 
        } else if (rol.includes('personal') || objeto.es_personal) {
            tipoAsignacionFinal = 'Personal de Oficina';
            temaFinal = objeto.tarea || 'Asignación en la Oficina';
        } else {
            tipoAsignacionFinal = 'Asignación Especial';
        }
    }

    // 4. DATOS DE CONTACTO
    const congregacionFinal = objeto.congregacion_visual || objeto.congregacion_orador || objeto.nombre_congregacion || '';

    // 5. EVENTO
    let tipoEventoMejorado = infoAsamblea.tipo || 'Asamblea';
    if (tipoEventoMejorado.trim().toLowerCase() === 'asamblea') {
        tipoEventoMejorado = 'Asamblea Regional';
    }

    return {
        // --- PERSONAL ---
        saludo: (objeto.sexo === 'F' || objeto.genero === 'F') ? 'hermana' : 'hermano',
        nombre_pila: nombrePila,
        segundo_nombre: segundoNombre,
        apellidos: apellidos,
        nombre_completo: nombreCompleto,
        sexo: objeto.sexo || 'M',
        circuito: infoAsamblea.circuito || 'HG-06',

        // --- ASIGNACIÓN ---
        tema_asignacion: temaFinal,
        tipo_asignacion: tipoAsignacionFinal,
        num_bosquejo: objeto.numero_bosquejo || objeto.bosquejo || '', 
        hora: objeto.hora_inicio || objeto.hora || '---',
        fecha_asignacion: objeto.dia || objeto.fecha || infoAsamblea.fecha || '---',
        congregacion: congregacionFinal,
        nota_asignacion: objeto.notas || objeto.nota || '',

        // --- EVENTO ---
        tema_evento: infoAsamblea.tema || 'Asamblea Regional',
        tipo_evento: tipoEventoMejorado,
        fecha_evento_texto: infoAsamblea.fecha || infoExtra.fecha_texto || 'Fecha por definir',
        
        // --- LUGAR ---
        lugar_nombre: infoExtra.lugar || infoAsamblea.local_nombre || 'Salón de Asambleas',
        lugar_direccion: infoExtra.direccion || infoAsamblea.local_direccion || '',
        ciudad: infoAsamblea.ciudad || '', 
        estado: infoAsamblea.estado || infoAsamblea.provincia || '', 

        // --- ENSAYOS ---
        ensayo_fecha: infoAsamblea.ensayo_fecha || infoExtra.fecha_ensayo || '---',
        ensayo_hora: infoAsamblea.ensayo_hora || infoExtra.hora_ensayo || '---',
        ensayo_lugar: infoAsamblea.ensayo_lugar || infoExtra.lugar || '',
        ensayo_direccion: infoExtra.direccion_ensayo || infoExtra.direccion || '',
        
        // 👇 AHORA SÍ: Conectado a los nombres reales de tu base de datos
        ensayo_notas: infoAsamblea.ensayo_notas || '',

        // --- INSTRUCCIONES ---
        // 👇 AHORA SÍ: Conectado a 'recorridos_info' y 'instrucciones_esp' de Rust
        orientaciones: infoAsamblea.recorridos_info || '',
        instrucciones: infoAsamblea.instrucciones_esp || '',

        // --- PRESIDENTE ---
        email_presidente: infoAsamblea.email_presidente || '',
        tel_presidente: infoAsamblea.telefono_presidente || ''
    };
}