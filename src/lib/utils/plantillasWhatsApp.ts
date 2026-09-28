// src/lib/utils/plantillasWhatsApp.ts
import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { DB } from '$lib/services/db';

export interface PlantillaWhatsApp {
    id: string;
    title: string;
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

export const marcadoresWhatsApp: GrupoMarcadores[] = [
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
// STORE REACTIVO - USA LOS COMANDOS DE mensajería.rs
// ------------------------------------------------------------
export const whatsAppTemplates = writable<PlantillaWhatsApp[]>([
    { id: 'programa_individual', title: 'Programa, orador específico', body: '', isOpen: false },
    
    { id: 'programa_recordatorio', title: 'Programa, recordatorio de asignación', body: '', isOpen: false },
    
    { id: 'contacto_orador', title: 'Lista de oradores, contacto general', body: '', isOpen: false },
    
     { 
        id: 'registro_orador', 
        title: 'Registro de Oradores', 
        body: '', 
        isOpen: false 
    },

    { id: 'ensayo', title: 'Recordatorio de Ensayo', body: '', isOpen: false },
    
    { id: 'oficina', title: 'Auxiliares de Oficina', body: '', isOpen: false },
   
    { id: 'comite', title: 'Comité de Asamblea', body: '', isOpen: false },
    
    { id: 'departamentos', title: 'Departamentos (Audio/Video, Soporte, etc.)', body: '', isOpen: false }
]);

// ------------------------------------------------------------
// CARGA - usa obtener_plantilla_mensaje (no necesita asunto)
// ------------------------------------------------------------
export async function cargarPlantillasWhatsApp(): Promise<void> {
    const plantillas = get(whatsAppTemplates);
    const promesas = plantillas.map(async (p) => {
        try {
            const res: any = await invoke('obtener_plantilla_mensaje', { id: p.id });
            // La respuesta tiene asunto y cuerpo; nosotros solo usamos cuerpo
            if (res && res.cuerpo !== undefined) {
                return { ...p, body: res.cuerpo || '' };
            }
        } catch (e) {
            console.error(`Error cargando plantilla WhatsApp ${p.id}:`, e);
        }
        return p;
    });
    const resultados = await Promise.all(promesas);
    whatsAppTemplates.set(resultados);
}

// ------------------------------------------------------------
// GUARDAR - usa guardar_plantilla_mensaje (asunto vacío o título)
// ------------------------------------------------------------
// ------------------------------------------------------------
// GUARDAR - usa DB.guardarPlantillaMensaje
// ------------------------------------------------------------
export async function guardarPlantillaWhatsApp(id: string, cuerpo: string): Promise<void> {
    try {
        // Usamos el título de la plantilla como asunto, o vacío
        const plantilla = get(whatsAppTemplates).find(p => p.id === id);
        const asunto = plantilla?.title || '';
        
        // 🔥 USAMOS EL EMBUDO PARA GUARDAR Y DISPARAR LA SEÑAL
        await DB.guardarPlantillaMensaje(id, asunto, cuerpo);
        
        whatsAppTemplates.update(items =>
            items.map(p => (p.id === id ? { ...p, body: cuerpo } : p))
        );
        console.log(`✅ Plantilla WhatsApp "${id}" guardada.`);
    } catch (e) {
        console.error(`❌ Error guardando plantilla WhatsApp "${id}":`, e);
        throw e;
    }
}

// ------------------------------------------------------------
// OBTENER POR ID
// ------------------------------------------------------------
export function obtenerPlantillaWhatsAppPorId(id: string): PlantillaWhatsApp | undefined {
    return get(whatsAppTemplates).find(p => p.id === id);
}

// ------------------------------------------------------------
// RESETEAR
// ------------------------------------------------------------
export async function resetearPlantillaWhatsApp(id: string): Promise<void> {
    await guardarPlantillaWhatsApp(id, '');
}