// src/lib/utils/contextoEmail.ts
import type { ContextoDocumento } from './contexto_impresion';

// ------------------------------------------------------------
// MAPA DE MARCADORES AMIGABLES → PROPIEDADES DEL CONTEXTO
// ------------------------------------------------------------
const MAPA_MARCADORES: Record<string, keyof ContextoDocumento | ((ctx: ContextoDocumento) => string)> = {
    // General
    '{Nombre}': 'nombre_completo',
    '{Tema}': 'tema_asignacion',
    '{FechaAsamblea}': 'fecha_evento_texto',
    '{DiaAsamblea}': (ctx: ContextoDocumento) => extraerDia(ctx.fecha_evento_texto),
    '{Lugar}': 'lugar_nombre',
    '{Direccion}': 'lugar_direccion',
    '{Ciudad}': 'ciudad',
    '{Estado}': 'estado',

    // Orador
    '{Congregacion}': 'congregacion',
    '{Telefono}': (_ctx: ContextoDocumento) => '', // No viene en contexto, lo dejamos vacío
    '{Email}': (_ctx: ContextoDocumento) => '',    // No viene en contexto, lo dejamos vacío

    // Asignación
    '{Hora}': 'hora',
    '{Duracion}': (_ctx: ContextoDocumento) => '', // No viene en contexto, lo dejamos vacío
    '{NumeroBosquejo}': 'num_bosquejo',
    '{Sesion}': (_ctx: ContextoDocumento) => '',   // No viene en contexto, lo dejamos vacío

    // Oficina
    '{Rol}': 'tipo_asignacion',

    // Saludo
    '{Saludo}': 'saludo',

    // Fechas actuales
    '{FechaActualMediana}': (_ctx: ContextoDocumento) => new Date().toLocaleDateString('es-ES'),
    '{FechaActualCompleta}': (_ctx: ContextoDocumento) => new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }),

    // Campos de impresión adicionales (por si acaso)
    '{NombrePila}': 'nombre_pila',
    '{Apellidos}': 'apellidos',
    '{Circuito}': 'circuito',
    '{TipoAsignacion}': 'tipo_asignacion',
    '{TemaEvento}': 'tema_evento',
    '{TipoEvento}': 'tipo_evento',
    '{EnsayoFecha}': 'ensayo_fecha',
    '{EnsayoHora}': 'ensayo_hora',
    '{EnsayoLugar}': 'ensayo_lugar',
    '{EnsayoDireccion}': 'ensayo_direccion',
    '{EnsayoNotas}': 'ensayo_notas',
    '{Orientaciones}': 'orientaciones',
    '{Instrucciones}': 'instrucciones',
    '{EmailPresidente}': 'email_presidente',
    '{TelPresidente}': 'tel_presidente',
};

// ------------------------------------------------------------
// FUNCIÓN AUXILIAR PARA EXTRAER EL DÍA DE UNA FECHA
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// FUNCIÓN PRINCIPAL: PROCESAR CONTENIDO HTML DEL EMAIL
// ------------------------------------------------------------
export function prepararContenidoEmail(
    htmlTiptap: string,
    contexto: ContextoDocumento
): string {
    if (!htmlTiptap) return '';

    // 1. Convertir HTML a texto plano (respetando saltos de línea)
    let texto = htmlTiptap
        .replace(/<\/p>/gi, '\n')
        .replace(/<p>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '');

    // 2. Reemplazar TODOS los marcadores del mapa
    Object.entries(MAPA_MARCADORES).forEach(([marcador, valor]) => {
        let reemplazo: string;

        if (typeof valor === 'function') {
            reemplazo = valor(contexto);
        } else {
            reemplazo = (contexto[valor] as string) || '';
        }

        // Escape de caracteres especiales para regex
        const marcadorEscapado = marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(marcadorEscapado, 'g');
        texto = texto.replace(regex, reemplazo);
    });

    return texto.trim();
}

// ------------------------------------------------------------
// FUNCIÓN PARA PROCESAR EL ASUNTO (TEXTO PLANO)
// ------------------------------------------------------------
export function prepararAsuntoEmail(
    plantillaAsunto: string,
    contexto: ContextoDocumento
): string {
    if (!plantillaAsunto) return '';

    let asunto = plantillaAsunto;

    Object.entries(MAPA_MARCADORES).forEach(([marcador, valor]) => {
        let reemplazo: string;
        if (typeof valor === 'function') {
            reemplazo = valor(contexto);
        } else {
            reemplazo = (contexto[valor] as string) || '';
        }
        const marcadorEscapado = marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(marcadorEscapado, 'g');
        asunto = asunto.replace(regex, reemplazo);
    });

    return asunto;
}
