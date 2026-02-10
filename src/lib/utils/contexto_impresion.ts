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
    
    const infoAsamblea: any = await invoke('obtener_asamblea_activa') || {};
    const infoExtra: any = await invoke('obtener_info_extra_evento', { asambleaId }) || {};

    // NORMALIZACIÓN DE NOMBRES
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

    // --- LÓGICA INTELIGENTE DE EVENTO ---
    // Si la BD dice "Asamblea" (a secas), nosotros lo mejoramos a "Asamblea Regional"
    let tipoEventoMejorado = infoAsamblea.tipo || 'Asamblea';
    if (tipoEventoMejorado.trim().toLowerCase() === 'asamblea') {
        tipoEventoMejorado = 'Asamblea Regional';
    }

    return {
        // --- PERSONAL ---
        // CAMBIO AQUÍ: Ya no ponemos "Estimado", solo la palabra clave.
        saludo: objeto.sexo === 'F' ? 'hermana' : 'hermano',
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
        fecha_asignacion: objeto.fecha || '---',
        congregacion: objeto.congregacion_orador || objeto.nombre_congregacion || '',
        nota_asignacion: objeto.notas || '',

        // --- EVENTO ---
        tema_evento: infoAsamblea.tema || 'Asamblea Regional',
        tipo_evento: tipoEventoMejorado, // Aquí va el nombre corregido
        fecha_evento_texto: infoAsamblea.fecha || infoExtra.fecha_texto || 'Fecha por definir',
        
        // --- LUGAR ---
        lugar_nombre: infoExtra.lugar || infoAsamblea.local_nombre || 'Salón de Asambleas',
        lugar_direccion: infoExtra.direccion || infoAsamblea.local_direccion || '',
        ciudad: infoAsamblea.ciudad || 'Holguín',
        estado: 'Holguín',

        // --- ENSAYOS ---
        ensayo_fecha: infoAsamblea.ensayo_fecha || infoExtra.fecha_ensayo || '---',
        ensayo_hora: infoAsamblea.ensayo_hora || infoExtra.hora_ensayo || '---',
        ensayo_lugar: infoAsamblea.ensayo_lugar || infoExtra.lugar || '',
        ensayo_direccion: infoExtra.direccion_ensayo || infoExtra.direccion || '',
        ensayo_notas: infoAsamblea.ensayo_notas || '',

        // --- INSTRUCCIONES ---
        orientaciones: infoAsamblea.recorridos_info || infoExtra.recorridos_info || '',
        instrucciones: infoAsamblea.instrucciones_esp || infoExtra.instrucciones_esp || '',

        // --- PRESIDENTE ---
        email_presidente: infoAsamblea.email_presidente || '',
        tel_presidente: infoAsamblea.telefono_presidente || ''
    };
}