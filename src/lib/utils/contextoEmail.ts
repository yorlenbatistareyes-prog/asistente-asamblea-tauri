// src/lib/utils/contextoEmail.ts
import type { ContextoDocumento } from './contexto_impresion';

// ------------------------------------------------------------
// FUNCIONES AUXILIARES 
// ------------------------------------------------------------
function generarInfoEnsayos(datos: ContextoDocumento): string {
    // 👇 Validamos si no hay ensayo para devolver un texto limpio
    if (!datos.ensayo_fecha || datos.ensayo_fecha === 'No requiere ensayo previo' || datos.ensayo_fecha === '---') {
        return 'No requiere ensayo previo para esta asignación.';
    }
    
    let info = `Fecha: ${datos.ensayo_fecha} a las ${datos.ensayo_hora}. Lugar: ${datos.ensayo_lugar || 'Por definir'}.`;
    if (datos.ensayo_direccion) info += ` Dirección: ${datos.ensayo_direccion}.`;
    if (datos.ensayo_notas) info += ` Notas: ${datos.ensayo_notas}`;
    
    return info;
}

function construirLugarEnsayo(datos: ContextoDocumento): string {
    // 👇 Si no hay ensayo, no mostramos un lugar vacío
    if (!datos.ensayo_fecha || datos.ensayo_fecha === 'No requiere ensayo previo' || datos.ensayo_fecha === '---') {
        return 'No aplica';
    }
    if (!datos.ensayo_lugar) return 'Por definir';
    
    let lugar = datos.ensayo_lugar;
    if (datos.ensayo_direccion) lugar += ` - ${datos.ensayo_direccion}`;
    return lugar;
}

// ------------------------------------------------------------
// MAPA DE REEMPLAZO DIRECTO (SOLO MARCADORES CON ESPACIOS Y TILDES)
// ------------------------------------------------------------
const MAPA_REEMPLAZO: Record<string, (ctx: ContextoDocumento) => string> = {
    // --- SALUDO Y ORADOR ---
    '[[Saludo según sexo]]': (ctx) => ctx.saludo,
    '[[Nombre]]': (ctx) => ctx.nombre_pila,
    '[[Segundo nombre]]': (ctx) => ctx.segundo_nombre,
    '[[Apellidos]]': (ctx) => ctx.apellidos,
    '[[Nombre Completo]]': (ctx) => ctx.nombre_completo,

    // --- CIRCUITO ---
    '[[Designación del Circuito]]': (ctx) => ctx.circuito,

    // --- FECHAS ACTUALES ---
    '[[Fecha Actual Completa]]': () => new Date().toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
    }),
    '[[Fecha Actual Mediana]]': () => new Date().toLocaleDateString('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric'
    }),

    // --- ASIGNACIÓN ---
    '[[Hora]]': (ctx) => ctx.hora,
    '[[Tema]]': (ctx) => ctx.tema_asignacion,
    '[[Número de Bosquejo]]': (ctx) => ctx.num_bosquejo,
    '[[Tipo de asignación]]': (ctx) => ctx.tipo_asignacion,
    '[[Enlace(s) del Bosquejo]]': () => '',
    '[[Notas]]': (ctx) => ctx.nota_asignacion,

    // --- LUGAR DEL EVENTO ---
    '[[Nombre del lugar]]': (ctx) => ctx.lugar_nombre,
    '[[Dirección]]': (ctx) => ctx.lugar_direccion,
    '[[Ciudad]]': (ctx) => ctx.ciudad,
    '[[Estado o Provincia]]': (ctx) => ctx.estado || 'Holguín', // 👇 Ya es dinámico, Holguín es solo por si está vacío

    // --- EVENTO ---
    '[[Fecha]]': (ctx) => ctx.fecha_evento_texto,
    '[[Tipo de Evento]]': (ctx) => ctx.tipo_evento,
    '[[Tema del Evento]]': (ctx) => ctx.tema_evento,

    // --- ENSAYOS ---
    '[[Información completa de los ensayos]]': (ctx) => generarInfoEnsayos(ctx),
    '[[Lugar de los ensayos]]': (ctx) => construirLugarEnsayo(ctx),
    '[[Fecha y hora del ensayo]]': (ctx) => (ctx.ensayo_fecha && ctx.ensayo_fecha !== 'No requiere ensayo previo' && ctx.ensayo_fecha !== '---') ? `${ctx.ensayo_fecha} a las ${ctx.ensayo_hora}` : 'No aplica',
    '[[Fecha de ensayos]]': (ctx) => ctx.ensayo_fecha,
    '[[Hora de ensayos]]': (ctx) => ctx.ensayo_hora,
    '[[Notas para los ensayos]]': (ctx) => ctx.ensayo_notas,

    // --- ORIENTACIONES E INSTRUCCIONES ---
    '[[Información de orientaciones]]': (ctx) => ctx.orientaciones || 'No hay orientaciones específicas.',
    '[[Instrucciones Especiales]]': (ctx) => ctx.instrucciones || 'Ninguna.',

    // --- CONTACTO PRESIDENTE ---
    '[[correo electrónico jwpub del Presidente de la asamblea]]': (ctx) => ctx.email_presidente,
    '[[Teléfono del Presidente de la asamblea]]': (ctx) => ctx.tel_presidente,
};

// ------------------------------------------------------------
// PROCESAR CONTENIDO HTML DEL EMAIL
// ------------------------------------------------------------
export function prepararContenidoEmail(htmlTiptap: string, contexto: ContextoDocumento): string {
    if (!htmlTiptap) return '';

    // 1. Convertir HTML a texto plano
    let texto = htmlTiptap
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '');

    // 2. Decodificar entidades HTML comunes
    texto = texto
        .replace(/&nbsp;/g, ' ')
        .replace(/&aacute;/g, 'á')
        .replace(/&eacute;/g, 'é')
        .replace(/&iacute;/g, 'í')
        .replace(/&oacute;/g, 'ó')
        .replace(/&uacute;/g, 'ú')
        .replace(/&ntilde;/g, 'ñ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // 3. Reemplazar marcadores (SOLO LOS DEL MAPA, SIN NORMALIZACIÓN)
    Object.entries(MAPA_REEMPLAZO).forEach(([marcador, fn]) => {
        const reemplazo = fn(contexto);
        const marcadorEscapado = marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(marcadorEscapado, 'g');
        texto = texto.replace(regex, reemplazo);
    });

    return texto.trim();
}

// ------------------------------------------------------------
// PROCESAR ASUNTO (TEXTO PLANO)
// ------------------------------------------------------------
export function prepararAsuntoEmail(plantillaAsunto: string, contexto: ContextoDocumento): string {
    if (!plantillaAsunto) return '';

    let asunto = plantillaAsunto;

    // Decodificar entidades (por si acaso)
    asunto = asunto
        .replace(/&nbsp;/g, ' ')
        .replace(/&aacute;/g, 'á')
        .replace(/&eacute;/g, 'é')
        .replace(/&iacute;/g, 'í')
        .replace(/&oacute;/g, 'ó')
        .replace(/&uacute;/g, 'ú')
        .replace(/&ntilde;/g, 'ñ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Reemplazar marcadores
    Object.entries(MAPA_REEMPLAZO).forEach(([marcador, fn]) => {
        const reemplazo = fn(contexto);
        const marcadorEscapado = marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(marcadorEscapado, 'g');
        asunto = asunto.replace(regex, reemplazo);
    });

    return asunto;
}