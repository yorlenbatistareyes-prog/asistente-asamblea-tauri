// src/lib/utils/plantillasEmail.ts
import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { DB } from '$lib/services/db';
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
    code: string;
    label: string;
    desc?: string;
}

export interface GrupoMarcadores {
    category: string;
    isOpen?: boolean;
    items: Marcador[];
}

// ------------------------------------------------------------
// MARCADORES DISPONIBLES (SOLO FORMATO LEGIBLE: ESPACIOS Y TILDES)
// ------------------------------------------------------------
export const marcadoresEmail: GrupoMarcadores[] = [
    {
        category: 'Saludo y Orador',
        isOpen: true,
        items: [
            { code: '[[Saludo según sexo]]', label: 'Saludo (hermano/hermana)', desc: 'Automático según género' },
            { code: '[[Nombre]]', label: 'Nombre de pila', desc: 'Ej: Juan' },
            { code: '[[Segundo nombre]]', label: 'Segundo nombre', desc: '' },
            { code: '[[Apellidos]]', label: 'Apellidos', desc: '' },
            { code: '[[Nombre Completo]]', label: 'Nombre completo', desc: 'Ej: Juan Pérez López' },
        ]
    },
    {
        category: 'Circuito',
        isOpen: false,
        items: [
            { code: '[[Designación del Circuito]]', label: 'Circuito', desc: 'Ej: HG-06' },
        ]
    },
    {
        category: 'Fechas actuales',
        isOpen: false,
        items: [
            { code: '[[Fecha Actual Completa]]', label: 'Fecha actual (larga)', desc: '12 de febrero de 2026' },
            { code: '[[Fecha Actual Mediana]]', label: 'Fecha actual (mediana)', desc: '12 feb 2026' },
        ]
    },
    {
        category: 'Asignación',
        isOpen: false,
        items: [
            { code: '[[Hora]]', label: 'Hora de la asignación', desc: 'HH:MM' },
            { code: '[[Tema]]', label: 'Tema del discurso/rol', desc: '' },
            { code: '[[Número de Bosquejo]]', label: 'Número de bosquejo', desc: 'Ej: 10, 23, 31' },
            { code: '[[Tipo de asignación]]', label: 'Tipo de asignación', desc: 'Discurso, Presidencia, Oración, etc.' },
            { code: '[[Enlace(s) del Bosquejo]]', label: 'Enlace del bosquejo (opcional)', desc: '' },
            { code: '[[Notas]]', label: 'Notas de la asignación', desc: '' },
        ]
    },
    {
        category: 'Lugar del evento',
        isOpen: false,
        items: [
            { code: '[[Nombre del lugar]]', label: 'Nombre del lugar', desc: 'Salón de Asambleas' },
            { code: '[[Dirección]]', label: 'Dirección', desc: 'Calle, número, ciudad' },
            { code: '[[Ciudad]]', label: 'Ciudad', desc: '' },
            { code: '[[Estado o Provincia]]', label: 'Estado o Provincia', desc: 'Holguín' },
        ]
    },
    {
        category: 'Evento',
        isOpen: false,
        items: [
            { code: '[[Fecha]]', label: 'Fecha del evento', desc: '12 de febrero de 2026' },
            { code: '[[Tipo de Evento]]', label: 'Tipo de evento', desc: 'Asamblea Regional, Circuito, etc.' },
            { code: '[[Tema del Evento]]', label: 'Tema del evento', desc: 'Ej: "Sigan al hombre"' },
        ]
    },
    {
        category: 'Ensayos',
        isOpen: false,
        items: [
            { code: '[[Información completa de los ensayos]]', label: 'Información completa', desc: 'Fecha, hora, lugar, dirección, notas' },
            { code: '[[Lugar de los ensayos]]', label: 'Lugar de los ensayos', desc: 'Nombre y dirección' },
            { code: '[[Fecha y hora del ensayo]]', label: 'Fecha y hora', desc: '12/02/2026 a las 16:00' },
            { code: '[[Fecha de ensayos]]', label: 'Fecha del ensayo', desc: '' },
            { code: '[[Hora de ensayos]]', label: 'Hora del ensayo', desc: '' },
            { code: '[[Notas para los ensayos]]', label: 'Notas', desc: '' },
        ]
    },
    {
        category: 'Orientaciones e Instrucciones',
        isOpen: false,
        items: [
            { code: '[[Información de orientaciones]]', label: 'Orientaciones', desc: '' },
            { code: '[[Instrucciones Especiales]]', label: 'Instrucciones especiales', desc: '' },
        ]
    },
    {
        category: 'Contacto del Presidente',
        isOpen: false,
        items: [
            { code: '[[correo electrónico jwpub del Presidente de la asamblea]]', label: 'Email del presidente', desc: '' },
            { code: '[[Teléfono del Presidente de la asamblea]]', label: 'Teléfono del presidente', desc: '' },
        ]
    }
];

// ------------------------------------------------------------
// STORE REACTIVO (LISTA SIMPLIFICADA Y SEPARADA)
// ------------------------------------------------------------
export const emailTemplates = writable<PlantillaEmail[]>([
    
    // --- 1. INDIVIDUALES (Para los botones de cada fila en Programa) ---
    { 
        id: 'programa_individual', 
        title: 'Programa, a orador específico', 
        subject: 'Asignación en el Programa de la Asamblea', 
        body: '', 
        isOpen: false 
    },
    { 
        id: 'programa_recordatorio', 
        title: 'Programa, recordatorio de asignación', 
        subject: 'Recordatorio de su participación en la Asamblea', 
        body: '', 
        isOpen: false 
    },

     // --- 2. MASIVOS (Para los botones globales "Email a todos") ---
    { 
        id: 'masivo_general', 
        title: 'Programa, Email a todos (General)', 
        subject: 'Información importante de la Asamblea', 
        body: '', 
        isOpen: false 
    },
    { 
        id: 'masivo_recordatorio', 
        title: 'Programa, Email a todos (Recordatorio)', 
        subject: 'Recordatorio General de Asignaciones', 
        body: '', 
        isOpen: false 
    },

    // --- 3. SEGUIMIENTO Y CONTACTO (Para la Lista de Oradores) ---
    { 
        id: 'contacto_orador', 
        title: 'Lista de oradores, contacto general', 
        subject: 'Información sobre su asignación en la Asamblea', 
        body: '', 
        isOpen: false 
    },

    // --- 4. SEGUIMIENTO Y CONTACTO (Para el registro de Oradores) ---
    { 
        id: 'registro_orador', // <--- ID NUEVO Y ESPECÍFICO
        title: 'Registro de Oradores', 
        subject: 'Información sobre su asignación en la asamblea', 
        body: '', 
        isOpen: false 
    },

   

    // --- 5. OFICINA, COMITÉ Y DEPARTAMENTOS ---
    { 
        id: 'oficina', 
        title: 'Auxiliares de la Oficina', 
        subject: 'Asignación en la Oficina de la Asamblea', 
        body: '', 
        isOpen: false 
    },
    { 
        id: 'comite', 
        title: 'Comité de Asamblea', 
        subject: 'Información para el Comité', 
        body: '', 
        isOpen: false 
    },
    { 
        id: 'departamentos', 
        title: 'Departamentos (Audio/Video, Soporte, etc.)', 
        subject: 'Asignación de Departamento en la Asamblea', 
        body: '', 
        isOpen: false 
    }
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
        // 🔥 AHORA SÍ: El nombre es claro y específico para correos
        await DB.guardarPlantillaEmail(id, asunto, cuerpo);
        
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