import { invoke } from '@tauri-apps/api/core';

// INTERFAZ MAESTRA
// Define qué datos están disponibles para CUALQUIER correspondencia
export interface ContextoDocumento {
    // Personal
    saludo: string;
    nombre_pila: string;
    segundo_nombre: string;
    apellidos: string;
    nombre_completo: string;
    sexo: string;
    circuito: string;

    // Asignación
    tema_asignacion: string;
    tipo_asignacion: string;
    num_bosquejo: string;
    hora: string;
    fecha_asignacion: string;
    congregacion: string;
    nota_asignacion: string;
    
    // Evento
    tema_evento: string;
    tipo_evento: string;
    fecha_evento_texto: string;
    lugar_nombre: string;
    lugar_direccion: string;
    ciudad: string;
    estado: string;

    // Ensayos
    ensayo_fecha: string;
    ensayo_hora: string;
    ensayo_lugar: string;
    ensayo_direccion: string;
    ensayo_notas: string; // HTML

    // Instrucciones
    orientaciones: string; // HTML
    instrucciones: string;

    // Presidente
    email_presidente: string;
    tel_presidente: string;
}

/**
 * Recopila datos de BD, Orador y Asamblea para crear un contexto unificado.
 */
export async function generarContexto(objeto: any, asambleaId: number, esPartePrograma: boolean): Promise<ContextoDocumento> {
    
    // 1. OBTENER DATOS DEL BACKEND
    // Fuente A: Textos ricos, temas y configuraciones (InformacionEvento.svelte)
    const infoAsamblea: any = await invoke('obtener_asamblea_activa') || {};
    // Fuente B: Datos relacionales, direcciones de locales (Gestión Salones)
    const infoExtra: any = await invoke('obtener_info_extra_evento', { asambleaId }) || {};

    console.log("📂 CONTEXTO RAW:", { orador: objeto, asamblea: infoAsamblea, extra: infoExtra });

    // 2. NORMALIZACIÓN DE NOMBRES
    let nombreCompleto = (objeto.nombre_orador || objeto.nombre_completo || objeto.nombre || 'Hermano').trim();
    let nombrePila = '';
    let apellidos = objeto.apellidos || '';
    let segundoNombre = '';

    if (nombreCompleto) {
        const partes = nombreCompleto.split(' ');
        if (partes.length > 0) {
            nombrePila = partes[0];
            if (!apellidos && partes.length > 1) {
                apellidos = partes.slice(1).join(' ');
            }
            if (partes.length > 2) segundoNombre = partes[1];
        }
    }

    // 3. CONSTRUCCIÓN DEL CONTEXTO FINAL
    // Aquí mapeamos lo que viene de la BD a nuestra estructura estándar
    return {
        // --- PERSONAL ---
        saludo: objeto.sexo === 'F' ? 'Estimada hermana' : 'Estimado hermano',
        nombre_pila: nombrePila,
        segundo_nombre: segundoNombre,
        apellidos: apellidos,
        nombre_completo: nombreCompleto,
        sexo: objeto.sexo || 'M',
        circuito: 'HG-06',

        // --- ASIGNACIÓN ---
        tema_asignacion: objeto.tema || (esPartePrograma ? 'Discurso' : 'Asignación Especial'),
        tipo_asignacion: esPartePrograma ? 'Discurso' : (objeto.tipo_asignacion || 'Asignación'),
        num_bosquejo: objeto.numero_bosquejo || objeto.bosquejo || '',
        hora: objeto.hora_inicio || objeto.hora || '---',
        fecha_asignacion: objeto.fecha || '---', // Fecha específica de la parte
        congregacion: objeto.congregacion_orador || objeto.nombre_congregacion || '',
        nota_asignacion: objeto.notas || '',

        // --- EVENTO ---
        tema_evento: infoAsamblea.tema || 'Asamblea Regional',
        tipo_evento: infoAsamblea.tipo || 'Asamblea',
        fecha_evento_texto: infoAsamblea.fecha || infoExtra.fecha_texto || 'Fecha por definir',
        
        // --- LUGAR ---
        // Priorizamos infoExtra.lugar (que viene del join con locales) sobre el texto plano
        lugar_nombre: infoExtra.lugar || infoAsamblea.local_nombre || 'Salón de Asambleas',
        lugar_direccion: infoExtra.direccion || infoAsamblea.local_direccion || '',
        ciudad: infoAsamblea.ciudad || 'Holguín',
        estado: 'Holguín',

        // --- ENSAYOS ---
        // Prioridad: Datos específicos de infoAsamblea (guardados en InformacionEvento)
        ensayo_fecha: infoAsamblea.ensayo_fecha || infoExtra.fecha_ensayo || '---',
        ensayo_hora: infoAsamblea.ensayo_hora || infoExtra.hora_ensayo || '---',
        ensayo_lugar: infoAsamblea.ensayo_lugar || infoExtra.lugar || '',
        // Dirección específica para ensayo si es diferente
        ensayo_direccion: infoExtra.direccion_ensayo || infoExtra.direccion || '',
        ensayo_notas: infoAsamblea.ensayo_notas || '',

        // --- INSTRUCCIONES ---
        // infoAsamblea.recorridos_info es como se llama en la BD (verificado en tu código anterior)
        orientaciones: infoAsamblea.recorridos_info || infoExtra.recorridos_info || '',
        instrucciones: infoAsamblea.instrucciones_esp || infoExtra.instrucciones_esp || '',

        // --- PRESIDENTE ---
        email_presidente: infoAsamblea.email_presidente || '',
        tel_presidente: infoAsamblea.telefono_presidente || ''
    };
}