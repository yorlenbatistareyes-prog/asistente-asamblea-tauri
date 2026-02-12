// src/lib/utils/contextoEmail.ts
import type { ContextoDocumento } from './contexto_impresion';

const MAPA_MARCADORES: Record<string, keyof ContextoDocumento | ((ctx: ContextoDocumento) => string)> = {
    // General
    '[[Nombre]]': 'nombre_completo',
    '[[Tema]]': 'tema_asignacion',
    '[[FechaAsamblea]]': 'fecha_evento_texto',
    '[[DiaAsamblea]]': (ctx) => extraerDia(ctx.fecha_evento_texto),
    '[[Lugar]]': 'lugar_nombre',
    '[[Direccion]]': 'lugar_direccion',
    '[[Ciudad]]': 'ciudad',
    '[[Estado]]': 'estado',
    '[[Estado o Provincia]]': 'estado',

    // Orador
    '[[Congregacion]]': 'congregacion',
    '[[Saludo]]': 'saludo',
    '[[Saludo según sexo]]': 'saludo',
    '[[Apellidos]]': 'apellidos',

    // Asignación
    '[[Hora]]': 'hora',
    '[[Número de Bosquejo]]': 'num_bosquejo',
    '[[NumeroBosquejo]]': 'num_bosquejo',
    '[[Tipo de asignación]]': 'tipo_asignacion',
    '[[TipoAsignacion]]': 'tipo_asignacion',
    '[[Fecha]]': 'fecha_evento_texto',

    // Evento
    '[[Tipo de Evento]]': 'tipo_evento',
    '[[TipoEvento]]': 'tipo_evento',

    // Lugar y ensayos
    '[[Nombre del lugar]]': 'lugar_nombre',
    '[[Lugar de los ensayos]]': 'ensayo_lugar',
    '[[Notas para los ensayos]]': 'ensayo_notas',
    '[[EnsayoFecha]]': 'ensayo_fecha',
    '[[EnsayoHora]]': 'ensayo_hora',
    '[[EnsayoDireccion]]': 'ensayo_direccion',
    '[[EnsayoNotas]]': 'ensayo_notas',

    // Otros
    '[[Orientaciones]]': 'orientaciones',
    '[[Instrucciones]]': 'instrucciones',
    '[[EmailPresidente]]': 'email_presidente',
    '[[TelPresidente]]': 'tel_presidente',

    // Fechas actuales
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
    let texto = htmlTiptap
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '');

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
    Object.entries(MAPA_MARCADORES).forEach(([marcador, valor]) => {
        const reemplazo = typeof valor === 'function' ? valor(contexto) : (contexto[valor] as string) || '';
        const regex = new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        asunto = asunto.replace(regex, reemplazo);
    });
    return asunto;
}
