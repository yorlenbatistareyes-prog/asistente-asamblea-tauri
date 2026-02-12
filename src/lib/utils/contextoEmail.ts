// src/lib/utils/contextoEmail.ts
import type { ContextoDocumento } from './contexto_impresion';

const MAPA_MARCADORES: Record<string, keyof ContextoDocumento | ((ctx: ContextoDocumento) => string)> = {
    // --- GENERAL ---
    '[[Nombre]]': 'nombre_completo',
    '[[Tema]]': 'tema_asignacion',
    '[[FechaAsamblea]]': 'fecha_evento_texto',
    '[[DiaAsamblea]]': (ctx) => extraerDia(ctx.fecha_evento_texto),
    '[[Lugar]]': 'lugar_nombre',
    '[[Direccion]]': 'lugar_direccion',
    '[[Dirección]]': 'lugar_direccion',          // ✅ NUEVA: con tilde
    '[[Ciudad]]': 'ciudad',
    '[[Estado]]': 'estado',
    '[[Estado o Provincia]]': 'estado',

    // --- ORADOR ---
    '[[Congregacion]]': 'congregacion',
    '[[Saludo]]': 'saludo',
    '[[Saludo según sexo]]': 'saludo',
    '[[Apellidos]]': 'apellidos',

    // --- ASIGNACIÓN ---
    '[[Hora]]': 'hora',
    '[[Número de Bosquejo]]': 'num_bosquejo',    // con tilde y espacio
    '[[Numero de Bosquejo]]': 'num_bosquejo',    // ✅ NUEVA: sin tilde, con espacio
    '[[NumeroBosquejo]]': 'num_bosquejo',        // sin tilde, sin espacio
    '[[Tipo de asignación]]': 'tipo_asignacion', // con tilde
    '[[Tipo de asignacion]]': 'tipo_asignacion', // ✅ NUEVA: sin tilde
    '[[TipoAsignacion]]': 'tipo_asignacion',     // sin tilde, sin espacio
    '[[Fecha]]': 'fecha_evento_texto',

    // --- EVENTO ---
    '[[Tipo de Evento]]': 'tipo_evento',
    '[[TipoEvento]]': 'tipo_evento',

    // --- LUGAR Y ENSAYOS ---
    '[[Nombre del lugar]]': 'lugar_nombre',
    '[[Lugar de los ensayos]]': 'ensayo_lugar',
    '[[Notas para los ensayos]]': 'ensayo_notas',
    '[[EnsayoFecha]]': 'ensayo_fecha',
    '[[EnsayoHora]]': 'ensayo_hora',
    '[[EnsayoDireccion]]': 'ensayo_direccion',
    '[[EnsayoNotas]]': 'ensayo_notas',

    // --- OTROS ---
    '[[Orientaciones]]': 'orientaciones',
    '[[Instrucciones]]': 'instrucciones',
    '[[EmailPresidente]]': 'email_presidente',
    '[[TelPresidente]]': 'tel_presidente',

    // --- FECHAS ACTUALES ---
    '[[FechaActualMediana]]': () => new Date().toLocaleDateString('es-ES'),
    '[[FechaActualCompleta]]': () => new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
};

function extraerDia(fechaTexto: string): string {
    if (!fechaTexto) return '';
    try {
        const fecha = new Date(fechaTexto);
        if (!isNaN(fecha.getTime())) {
            return fecha.toLocaleDateString('es-ES', { weekday: 'long' });
        }
    } catch { /* ignorar */ }
    return '';
}

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

    // 3. Normalizar marcadores: eliminar espacios y unificar acentos
    texto = texto.replace(/\[\s*\[([^\]]+)\]\s*\]/g, (match, contenido) => {
        const limpio = contenido.trim();
        // Eliminar tildes comunes para que coincida con el mapa
        const sinTildes = limpio
            .replace(/á/g, 'a')
            .replace(/é/g, 'e')
            .replace(/í/g, 'i')
            .replace(/ó/g, 'o')
            .replace(/ú/g, 'u')
            .replace(/ñ/g, 'n');
        return `[[${sinTildes}]]`;
    });

    // 4. Reemplazar marcadores
    Object.entries(MAPA_MARCADORES).forEach(([marcador, valor]) => {
        const reemplazo = typeof valor === 'function' ? valor(contexto) : (contexto[valor] as string) || '';
        const regex = new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        texto = texto.replace(regex, reemplazo);
    });

    return texto.trim();
}

export function prepararAsuntoEmail(plantillaAsunto: string, contexto: ContextoDocumento): string {
    if (!plantillaAsunto) return '';
    let asunto = plantillaAsunto;
    // Normalizar acentos en marcadores
    asunto = asunto.replace(/\[\s*\[([^\]]+)\]\s*\]/g, (match, contenido) => {
        const limpio = contenido.trim();
        const sinTildes = limpio
            .replace(/á/g, 'a')
            .replace(/é/g, 'e')
            .replace(/í/g, 'i')
            .replace(/ó/g, 'o')
            .replace(/ú/g, 'u')
            .replace(/ñ/g, 'n');
        return `[[${sinTildes}]]`;
    });
    Object.entries(MAPA_MARCADORES).forEach(([marcador, valor]) => {
        const reemplazo = typeof valor === 'function' ? valor(contexto) : (contexto[valor] as string) || '';
        const regex = new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        asunto = asunto.replace(regex, reemplazo);
    });
    return asunto;
}