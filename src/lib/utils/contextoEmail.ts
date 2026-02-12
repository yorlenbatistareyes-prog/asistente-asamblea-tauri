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

    // Campos de impresión adicionales
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
// NORMALIZADOR DE MARCADORES (convierte cualquier variante a {Nombre} etc.)
// ------------------------------------------------------------
function normalizarMarcadores(texto: string): string {
    return texto.replace(/\{\s*([^}]+)\s*\}/g, (match, contenido) => {
        const limpio = contenido.trim();
        // Capitalizar primera letra, resto minúsculas (Ej: nombre -> Nombre)
        const capitalizado = limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
        return `{${capitalizado}}`;
    });
}

// ------------------------------------------------------------
// FUNCIÓN PRINCIPAL: PROCESAR CONTENIDO HTML DEL EMAIL (CON LOGS)
// ------------------------------------------------------------
export function prepararContenidoEmail(
    htmlTiptap: string,
    contexto: ContextoDocumento
): string {
    if (!htmlTiptap) return '';

    console.log('📨 [prepararContenidoEmail] ==========');
    console.log('📄 HTML original:', htmlTiptap);

    // 1. Convertir HTML a texto plano
    let texto = htmlTiptap
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '');

    console.log('🧹 Texto sin HTML:', JSON.stringify(texto));

    // 2. NORMALIZAR marcadores
    const textoNormalizado = normalizarMarcadores(texto);
    if (textoNormalizado !== texto) {
        console.log('✨ Marcadores normalizados:', textoNormalizado);
        texto = textoNormalizado;
    }

    // 3. Reemplazar TODOS los marcadores del mapa
    Object.entries(MAPA_MARCADORES).forEach(([marcador, valor]) => {
        let reemplazo: string;

        if (typeof valor === 'function') {
            reemplazo = valor(contexto);
        } else {
            reemplazo = (contexto[valor] as string) || '';
        }

        const regex = new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const antes = texto;
        texto = texto.replace(regex, reemplazo);

        if (antes !== texto) {
            console.log(`✅ Reemplazado ${marcador} → "${reemplazo}"`);
        }
    });

    // 4. Buscar marcadores que NO se reemplazaron (posible error)
    const marcadoresRestantes = texto.match(/\{[^}]+\}/g);
    if (marcadoresRestantes) {
        console.warn('⚠️ Marcadores no reemplazados:', marcadoresRestantes);
    }

    console.log('📨 Resultado final:', texto);
    console.log('=====================================\n');
    return texto.trim();
}

// ------------------------------------------------------------
// FUNCIÓN PARA PROCESAR EL ASUNTO (TEXTO PLANO) CON LOGS
// ------------------------------------------------------------
export function prepararAsuntoEmail(
    plantillaAsunto: string,
    contexto: ContextoDocumento
): string {
    if (!plantillaAsunto) return '';

    console.log('📨 [prepararAsuntoEmail] ==========');
    console.log('📄 Asunto original:', plantillaAsunto);

    let asunto = plantillaAsunto;

    // Normalizar
    const asuntoNormalizado = normalizarMarcadores(asunto);
    if (asuntoNormalizado !== asunto) {
        console.log('✨ Asunto normalizado:', asuntoNormalizado);
        asunto = asuntoNormalizado;
    }

    Object.entries(MAPA_MARCADORES).forEach(([marcador, valor]) => {
        let reemplazo: string;
        if (typeof valor === 'function') {
            reemplazo = valor(contexto);
        } else {
            reemplazo = (contexto[valor] as string) || '';
        }
        const regex = new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const antes = asunto;
        asunto = asunto.replace(regex, reemplazo);
        if (antes !== asunto) {
            console.log(`✅ Reemplazado ${marcador} → "${reemplazo}"`);
        }
    });

    console.log('📨 Asunto final:', asunto);
    console.log('=====================================\n');
    return asunto;
}