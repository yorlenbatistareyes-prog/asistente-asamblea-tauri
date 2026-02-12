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
    code: string;      // Ej: [[Nombre]], [[Tema]], [[FechaAsamblea]]
    label: string;
    desc?: string;
}

export interface GrupoMarcadores {
    category: string;
    isOpen?: boolean;
    items: Marcador[];
}

// ------------------------------------------------------------
// MARCADORES DISPONIBLES (AHORA CON DOBLE CORCHETE)
// ------------------------------------------------------------
export const marcadoresEmail: GrupoMarcadores[] = [
    {
        category: 'General',
        isOpen: true,
        items: [
            { code: '[[Nombre]]', label: 'Nombre completo del hermano', desc: 'Ej: Juan Pérez' },
            { code: '[[Tema]]', label: 'Tema de la asignación', desc: 'Título del discurso o rol' },
            { code: '[[FechaAsamblea]]', label: 'Fecha de la asamblea', desc: 'Ej: 12 de febrero de 2026' },
            { code: '[[DiaAsamblea]]', label: 'Día de la asamblea', desc: 'Viernes, Sábado o Domingo' },
            { code: '[[Lugar]]', label: 'Lugar de la asamblea', desc: 'Nombre del salón' },
            { code: '[[Direccion]]', label: 'Dirección del lugar', desc: 'Calle, número, ciudad' },
            { code: '[[Ciudad]]', label: 'Ciudad', desc: '' },
            { code: '[[Estado]]', label: 'Estado/Provincia', desc: '' },
        ]
    },
    {
        category: 'Orador',
        isOpen: false,
        items: [
            { code: '[[Congregacion]]', label: 'Congregación', desc: 'Nombre de la congregación' },
            { code: '[[Saludo]]', label: 'Saludo (hermano/hermana)', desc: 'Automático según género' },
            { code: '[[Saludo según sexo]]', label: 'Saludo según sexo', desc: 'hermano/hermana' },
            { code: '[[Apellidos]]', label: 'Apellidos', desc: 'Apellidos del hermano' },
        ]
    },
    {
        category: 'Asignación',
        isOpen: false,
        items: [
            { code: '[[Hora]]', label: 'Hora', desc: 'HH:MM' },
            { code: '[[Número de Bosquejo]]', label: 'Número de bosquejo', desc: 'Ej: 10, 23, 31' },
            { code: '[[NumeroBosquejo]]', label: 'Número de bosquejo (corto)', desc: 'Ej: 10' },
            { code: '[[Rol]]', label: 'Rol', desc: 'Presidente, Oración, Plataforma, etc.' },
            { code: '[[Tipo de asignación]]', label: 'Tipo de asignación', desc: 'Discurso, Presidencia, etc.' },
            { code: '[[TipoAsignacion]]', label: 'Tipo de asignación (corto)', desc: '' },
        ]
    },
    {
        category: 'Fechas',
        isOpen: false,
        items: [
            { code: '[[Fecha]]', label: 'Fecha del evento', desc: 'Ej: 12 de febrero de 2026' },
            { code: '[[FechaActualMediana]]', label: 'Fecha actual (corta)', desc: '12/02/2026' },
            { code: '[[FechaActualCompleta]]', label: 'Fecha actual (larga)', desc: '12 de febrero de 2026' },
        ]
    },
    {
        category: 'Evento',
        isOpen: false,
        items: [
            { code: '[[TemaEvento]]', label: 'Tema del evento', desc: 'Ej: "Sigan al hombre" (2026)' },
            { code: '[[Tipo de Evento]]', label: 'Tipo de evento', desc: 'Asamblea Regional, Circuito, etc.' },
            { code: '[[TipoEvento]]', label: 'Tipo de evento (corto)', desc: '' },
        ]
    },
    {
        category: 'Lugar y Ensayos',
        isOpen: false,
        items: [
            { code: '[[Nombre del lugar]]', label: 'Nombre del lugar', desc: 'Salón de Asambleas' },
            { code: '[[Lugar de los ensayos]]', label: 'Lugar de los ensayos', desc: '' },
            { code: '[[EnsayoFecha]]', label: 'Fecha del ensayo', desc: '' },
            { code: '[[EnsayoHora]]', label: 'Hora del ensayo', desc: '' },
            { code: '[[EnsayoDireccion]]', label: 'Dirección del ensayo', desc: '' },
            { code: '[[EnsayoNotas]]', label: 'Notas para los ensayos', desc: '' },
            { code: '[[Notas para los ensayos]]', label: 'Notas para los ensayos', desc: '' },
        ]
    },
    {
        category: 'Contacto',
        isOpen: false,
        items: [
            { code: '[[EmailPresidente]]', label: 'Email del presidente', desc: '' },
            { code: '[[TelPresidente]]', label: 'Teléfono del presidente', desc: '' },
            { code: '[[Orientaciones]]', label: 'Orientaciones', desc: '' },
            { code: '[[Instrucciones]]', label: 'Instrucciones', desc: '' },
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

export function obtenerPlantillaPorId(id: string): PlantillaEmail | undefined {
    return get(emailTemplates).find(p => p.id === id);
}

export async function resetearPlantillaEmail(id: string): Promise<void> {
    await guardarPlantillaEmail(id, '', '');
}