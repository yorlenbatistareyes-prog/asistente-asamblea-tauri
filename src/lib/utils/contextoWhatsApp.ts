// src/lib/utils/contextoWhatsApp.ts
import type { ContextoDocumento } from './contexto_impresion';

// ------------------------------------------------------------
// FUNCIONES AUXILIARES (COPIADAS DE IMPRESION.TS)
// ------------------------------------------------------------
function generarInfoEnsayos(datos: ContextoDocumento): string {
    if (!datos.ensayo_fecha || !datos.ensayo_hora) return 'No hay información de ensayos.';
    return `Fecha: ${datos.ensayo_fecha} a las ${datos.ensayo_hora}. Lugar: ${datos.ensayo_lugar || 'Por definir'}. Dirección: ${datos.ensayo_direccion || 'Por definir'}. Notas: ${datos.ensayo_notas || 'Ninguna.'}`;
}

function construirLugarEnsayo(datos: ContextoDocumento): string {
    if (!datos.ensayo_lugar) return 'Por definir';
    let lugar = datos.ensayo_lugar;
    if (datos.ensayo_direccion) lugar += ` - ${datos.ensayo_direccion}`;
    return lugar;
}

// ------------------------------------------------------------
// MAPA DE REEMPLAZO (MISMO QUE EN EMAIL)
// ------------------------------------------------------------
const MAPA_REEMPLAZO: Record<string, (ctx: ContextoDocumento) => string> = {
    '[[Saludo según sexo]]': (ctx) => ctx.saludo,
    '[[Nombre]]': (ctx) => ctx.nombre_pila,
    '[[Segundo nombre]]': (ctx) => ctx.segundo_nombre,
    '[[Apellidos]]': (ctx) => ctx.apellidos,
    '[[Nombre Completo]]': (ctx) => ctx.nombre_completo,
    '[[Designación del Circuito]]': (ctx) => ctx.circuito,
    '[[Fecha Actual Completa]]': () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
    '[[Fecha Actual Mediana]]': () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
    '[[Hora]]': (ctx) => ctx.hora,
    '[[Tema]]': (ctx) => ctx.tema_asignacion,
    '[[Número de Bosquejo]]': (ctx) => ctx.num_bosquejo,
    '[[Tipo de asignación]]': (ctx) => ctx.tipo_asignacion,
    '[[Enlace(s) del Bosquejo]]': () => '',
    '[[Notas]]': (ctx) => ctx.nota_asignacion,
    '[[Nombre del lugar]]': (ctx) => ctx.lugar_nombre,
    '[[Dirección]]': (ctx) => ctx.lugar_direccion,
    '[[Ciudad]]': (ctx) => ctx.ciudad,
    '[[Estado o Provincia]]': () => 'Holguín',
    '[[Fecha]]': (ctx) => ctx.fecha_evento_texto,
    '[[Tipo de Evento]]': (ctx) => ctx.tipo_evento,
    '[[Tema del Evento]]': (ctx) => ctx.tema_evento,
    '[[Información completa de los ensayos]]': (ctx) => generarInfoEnsayos(ctx),
    '[[Lugar de los ensayos]]': (ctx) => construirLugarEnsayo(ctx),
    '[[Fecha y hora del ensayo]]': (ctx) => `${ctx.ensayo_fecha} a las ${ctx.ensayo_hora}`,
    '[[Fecha de ensayos]]': (ctx) => ctx.ensayo_fecha,
    '[[Hora de ensayos]]': (ctx) => ctx.ensayo_hora,
    '[[Notas para los ensayos]]': (ctx) => ctx.ensayo_notas,
    '[[Información de orientaciones]]': (ctx) => ctx.orientaciones || 'No hay orientaciones específicas.',
    '[[Instrucciones Especiales]]': (ctx) => ctx.instrucciones || 'Ninguna.',
    '[[correo electrónico jwpub del Presidente de la asamblea]]': (ctx) => ctx.email_presidente,
    '[[Teléfono del Presidente de la asamblea]]': (ctx) => ctx.tel_presidente,
};

// ------------------------------------------------------------
// PROCESAR CONTENIDO HTML PARA WHATSAPP
// ------------------------------------------------------------
export function prepararContenidoWhatsApp(htmlTiptap: string, contexto: ContextoDocumento): string {
    if (!htmlTiptap) return '';

    // 1. Convertir HTML a texto plano (respetando saltos de línea)
    let texto = htmlTiptap
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '');

    // 2. Decodificar entidades HTML
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

    // 3. Reemplazar marcadores
    Object.entries(MAPA_REEMPLAZO).forEach(([marcador, fn]) => {
        const reemplazo = fn(contexto);
        const marcadorEscapado = marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(marcadorEscapado, 'g');
        texto = texto.replace(regex, reemplazo);
    });

    return texto.trim();
}
