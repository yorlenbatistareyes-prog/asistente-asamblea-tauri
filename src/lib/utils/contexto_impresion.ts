import { invoke } from '@tauri-apps/api/core';

function formatearFechaEvento(fechaISO: string | undefined): string {
    if (!fechaISO) return 'Fecha por definir';

    // "Pesca" todas las fechas con formato AAAA-MM-DD que haya en el texto
    const fechasExtraidas = fechaISO.match(/\d{4}-\d{2}-\d{2}/g);

    // Si encontró exactamente dos fechas (es un rango)
    if (fechasExtraidas && fechasExtraidas.length === 2) {
        const f1 = new Date(fechasExtraidas[0] + 'T12:00:00');
        const f2 = new Date(fechasExtraidas[1] + 'T12:00:00');
        
        const mes1 = f1.toLocaleDateString('es-ES', { month: 'long' });
        const mes2 = f2.toLocaleDateString('es-ES', { month: 'long' });
        const año1 = f1.getFullYear();
        const año2 = f2.getFullYear();

        // Mismo mes y año: "1 al 3 de enero de 2027"
        if (mes1 === mes2 && año1 === año2) {
            return `${f1.getDate()} al ${f2.getDate()} de ${mes1} de ${año1}`;
        }
        // Mismo año pero distinto mes: "30 de enero al 2 de febrero de 2027"
        if (año1 === año2) {
            return `${f1.getDate()} de ${mes1} al ${f2.getDate()} de ${mes2} de ${año1}`;
        }
        // Distinto año: "30 de diciembre de 2026 al 2 de enero de 2027"
        return `${f1.getDate()} de ${mes1} de ${año1} al ${f2.getDate()} de ${mes2} de ${año2}`;
    }

    // Si solo hay una fecha individual
    if (fechasExtraidas && fechasExtraidas.length === 1) {
        const fecha = new Date(fechasExtraidas[0] + 'T12:00:00');
        return fecha.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    // Si es un texto libre que no tiene fechas ISO, lo devuelve tal cual
    return fechaISO.trim();
}


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
    duracion: string;
    enlace_bosquejo: string;
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
    
     // 🆕 DATOS DEL USUARIO (Presidente)
    let emailPresidente = '';
    let telPresidente = '';
    try {
        const config: any = await invoke('obtener_configuracion_general') || {};
        emailPresidente = config.email_jwpub || config.email || '';
        telPresidente = config.movil || '';
    } catch (e) {
        console.warn('No se pudo cargar configuración general:', e);
    }
    
    const sexoPersona = String(objeto.sexo || objeto.genero_orador || objeto.genero || 'M').trim().toUpperCase();

    // 2. DETECCIÓN INTELIGENTE DEL NOMBRE
    const nombreCompletoBase = (
        objeto.nombre_orador || 
        objeto.nombre_completo || 
        objeto.nombre_presidente || 
        objeto.nombre_completo_presidente ||
        [objeto.nombre, objeto.segundo_nombre, objeto.apellido || objeto.apellidos, objeto.sufijo]
            .filter(Boolean)
            .join(' ') ||
        objeto.nombre ||
        'Hermano'
    ).trim();

    let nombrePila = objeto.nombre_pila || '';
    let apellidos = objeto.apellidos || objeto.apellido || '';
    let segundoNombre = objeto.segundo_nombre || '';
    let nombreCompleto = nombreCompletoBase;

    if (nombreCompleto && nombreCompleto !== 'Hermano') {
        const partes = nombreCompleto.replace(/\s+/g, ' ').split(' ');
        if (!nombrePila) nombrePila = partes[0] || '';
        if (!apellidos && partes.length > 1) apellidos = partes.slice(1).join(' ');
        nombreCompleto = nombreCompleto.replace(/\s+/g, ' ');
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

    // 6. LÓGICA DE PRIORIDAD PARA ENSAYOS
    let valFechaEnsayo = '---';
    let valHoraEnsayo = '---';
    let valLugarEnsayo = '';
    let valNotasEnsayo = '';

    // Si tiene la propiedad 'requiere_ensayo' pero está en false, es porque explícitamente no necesita ensayo
    const tieneCasillaEnsayo = 'requiere_ensayo' in objeto;
    const requiereEnsayo = objeto.requiere_ensayo === true || objeto.requiere_ensayo === 1;

    if (!tieneCasillaEnsayo || requiereEnsayo) {
        // Prioridad: 1° Datos específicos de la tarjeta -> 2° Datos globales de la Asamblea -> 3° Vacío
        valFechaEnsayo = (objeto.fecha_ensayo && objeto.fecha_ensayo.trim() !== '') ? objeto.fecha_ensayo : (infoAsamblea.ensayo_fecha || infoExtra.fecha_ensayo || '---');
        valHoraEnsayo = (objeto.hora_ensayo && objeto.hora_ensayo.trim() !== '') ? objeto.hora_ensayo : (infoAsamblea.ensayo_hora || infoExtra.hora_ensayo || '---');
        valLugarEnsayo = (objeto.lugar_ensayo && objeto.lugar_ensayo.trim() !== '') ? objeto.lugar_ensayo : (infoAsamblea.ensayo_lugar || infoExtra.lugar || '');
        valNotasEnsayo = (objeto.notas_ensayo && objeto.notas_ensayo.trim() !== '') ? objeto.notas_ensayo : (infoAsamblea.ensayo_notas || '');
    } else {
        // Si es una parte del programa y NO se marcó la casilla, limpiamos los campos para no confundir al hermano
        valFechaEnsayo = 'No requiere ensayo previo';
        valHoraEnsayo = '--:--';
    }

    return {
        // --- PERSONAL ---
        saludo: sexoPersona === 'F' ? 'hermana' : 'hermano',
        nombre_pila: nombrePila,
        segundo_nombre: segundoNombre,
        apellidos: apellidos,
        nombre_completo: nombreCompleto,
        sexo: sexoPersona,
        circuito: objeto.circuito_orador || objeto.circuito || infoAsamblea.circuito || 'HG-06',

        // --- ASIGNACIÓN ---
        tema_asignacion: temaFinal,
        tipo_asignacion: tipoAsignacionFinal,
        num_bosquejo: objeto.numero_bosquejo || objeto.bosquejo || '', 
        duracion: objeto.duracion ? String(objeto.duracion) : '',
        enlace_bosquejo: objeto.enlace_bosquejo || objeto.url_bosquejo || objeto.enlace_bosquejo_url || '',
        hora: objeto.hora_inicio || objeto.hora || '---',
        fecha_asignacion: objeto.dia || objeto.fecha || infoAsamblea.fecha || '---',
        congregacion: congregacionFinal,
        nota_asignacion: objeto.notas || objeto.nota || objeto.notas_orador || '',

        // --- EVENTO ---
        tema_evento: objeto.tema_evento || infoAsamblea.tema || 'Asamblea Regional',
        tipo_evento: objeto.tipo_evento || tipoEventoMejorado,
        fecha_evento_texto: formatearFechaEvento(objeto.fecha_evento || infoAsamblea.fecha || infoExtra.fecha_texto),
        
        // --- LUGAR ---
        lugar_nombre: objeto.nombre_del_lugar || objeto.lugar_nombre || infoExtra.lugar || infoAsamblea.local_nombre || 'Salón de Asambleas',
        lugar_direccion: objeto.direccion_del_lugar || objeto.lugar_direccion || infoExtra.direccion || infoAsamblea.local_direccion || '',
        ciudad: infoAsamblea.ciudad || '', 
        estado: infoAsamblea.estado || infoAsamblea.provincia || '', 

        // --- ENSAYOS (Integrando la nueva lógica) ---
        ensayo_fecha: valFechaEnsayo,
        ensayo_hora: valHoraEnsayo,
        ensayo_lugar: valLugarEnsayo,
        ensayo_direccion: infoExtra.direccion_ensayo || infoExtra.direccion || '',
        ensayo_notas: valNotasEnsayo,

        // --- INSTRUCCIONES ---
        orientaciones: infoAsamblea.recorridos_info || '',
        instrucciones: infoAsamblea.instrucciones_esp || '',

        // --- PRESIDENTE ---
        email_presidente: emailPresidente || '',
        tel_presidente: telPresidente || ''
    };
}