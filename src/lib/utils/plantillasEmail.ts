// src/lib/utils/plantillasEmail.ts
import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------
export interface PlantillaEmail {
    id: string;
    title: string;
    subject: string;
    body: string;
    isOpen?: boolean;
}

export interface Marcador {
    code: string;      // Ej: {Nombre}, {Tema}, {FechaAsamblea}
    label: string;
    desc?: string;
}

export interface GrupoMarcadores {
    category: string;
    isOpen?: boolean;
    items: Marcador[];
}

// ------------------------------------------------------------
// MARCADORES DISPONIBLES (Los que se insertan en el editor)
// ------------------------------------------------------------
export const marcadoresEmail: GrupoMarcadores[] = [
    {
        category: 'General',
        isOpen: true,
        items: [
            { code: '{Nombre}', label: 'Nombre completo del hermano', desc: 'Ej: Juan Pérez' },
            { code: '{Tema}', label: 'Tema de la asignación', desc: 'Título del discurso o rol' },
            { code: '{FechaAsamblea}', label: 'Fecha de la asamblea', desc: 'Ej: 12 de febrero de 2026' },
            { code: '{DiaAsamblea}', label: 'Día de la asamblea', desc: 'Viernes, Sábado o Domingo' },
            { code: '{Lugar}', label: 'Lugar de la asamblea', desc: 'Nombre del salón' },
            { code: '{Direccion}', label: 'Dirección del lugar', desc: 'Calle, número, ciudad' },
            { code: '{Ciudad}', label: 'Ciudad', desc: '' },
            { code: '{Estado}', label: 'Estado/Provincia', desc: '' },
        ]
    },
    {
        category: 'Orador',
        isOpen: false,
        items: [
            { code: '{Congregacion}', label: 'Congregación', desc: 'Nombre de la congregación' },
            { code: '{Saludo}', label: 'Saludo (hermano/hermana)', desc: 'Automático según género' },
        ]
    },
    {
        category: 'Asignación',
        isOpen: false,
        items: [
            { code: '{Hora}', label: 'Hora', desc: 'HH:MM' },
            { code: '{NumeroBosquejo}', label: 'Número de bosquejo', desc: 'Ej: 10, 23, 31' },
            { code: '{Rol}', label: 'Rol', desc: 'Presidente, Oración, Plataforma, etc.' },
            { code: '{TipoAsignacion}', label: 'Tipo de asignación', desc: 'Discurso, Presidencia, etc.' },
        ]
    },
    {
        category: 'Fechas',
        isOpen: false,
        items: [
            { code: '{FechaActualMediana}', label: 'Fecha actual (corta)', desc: '12/02/2026' },
            { code: '{FechaActualCompleta}', label: 'Fecha actual (larga)', desc: '12 de febrero de 2026' },
        ]
    },
    {
        category: 'Evento',
        isOpen: false,
        items: [
            { code: '{TemaEvento}', label: 'Tema del evento', desc: 'Ej: "Sigan al hombre" (2026)' },
            { code: '{TipoEvento}', label: 'Tipo de evento', desc: 'Asamblea Regional, Circuito, etc.' },
        ]
    },
    {
        category: 'Ensayos',
        isOpen: false,
        items: [
            { code: '{EnsayoFecha}', label: 'Fecha del ensayo', desc: '' },
            { code: '{EnsayoHora}', label: 'Hora del ensayo', desc: '' },
            { code: '{EnsayoLugar}', label: 'Lugar del ensayo', desc: '' },
            { code: '{EnsayoDireccion}', label: 'Dirección del ensayo', desc: '' },
            { code: '{EnsayoNotas}', label: 'Notas del ensayo', desc: '' },
        ]
    },
    {
        category: 'Contacto',
        isOpen: false,
        items: [
            { code: '{EmailPresidente}', label: 'Email del presidente', desc: '' },
            { code: '{TelPresidente}', label: 'Teléfono del presidente', desc: '' },
        ]
    }
];

// ------------------------------------------------------------
// STORE REACTIVO
// ------------------------------------------------------------
export const emailTemplates = writable<PlantillaEmail[]>([
    { id: 'oradores', title: 'Oradores (Discursos)', subject: '', body: '', isOpen: false },
    { id: 'presidentes', title: 'Presidentes de sesión', subject: '', body: '', isOpen: false },
    { id: 'oraciones', title: 'Oraciones (Apertura/Conclusión)', subject: '', body: '', isOpen: false }
]);

// ------------------------------------------------------------
// FUNCIONES DE CARGA / GUARDADO
// ------------------------------------------------------------

/**
 * Carga TODAS las plantillas desde la BD y actualiza el store.
 * Debe ejecutarse al iniciar la app (ej: en layout o en onMount de página principal).
 */
export async function cargarPlantillasEmail(): Promise<void> {
    const plantillas = get(emailTemplates);
    const promesas = plantillas.map(async (p) => {
        try {
            const res: any = await invoke('obtener_plantilla_email', { id: p.id });
            if (res && (res.asunto !== undefined || res.cuerpo !== undefined)) {
                return { ...p, subject: res.asunto || '', body: res.cuerpo || '' };
            }
        } catch (e) {
            console.error(`Error cargando plantilla ${p.id}:`, e);
        }
        return p;
    });
    const resultados = await Promise.all(promesas);
    emailTemplates.set(resultados);
}

/**
 * Guarda UNA plantilla en la BD y actualiza el store.
 */
export async function guardarPlantillaEmail(id: string, asunto: string, cuerpo: string): Promise<void> {
    try {
        await invoke('guardar_plantilla_email', { id, asunto, cuerpo });
        emailTemplates.update(items =>
            items.map(p => (p.id === id ? { ...p, subject: asunto, body: cuerpo } : p))
        );
        console.log(`✅ Plantilla "${id}" guardada.`);
    } catch (e) {
        console.error(`❌ Error guardando plantilla "${id}":`, e);
        throw e;
    }
}

/**
 * Obtiene una plantilla del store por su ID (síncrono).
 */
export function obtenerPlantillaPorId(id: string): PlantillaEmail | undefined {
    return get(emailTemplates).find(p => p.id === id);
}

/**
 * Resetea una plantilla a valores vacíos.
 */
export async function resetearPlantillaEmail(id: string): Promise<void> {
    await guardarPlantillaEmail(id, '', '');
}