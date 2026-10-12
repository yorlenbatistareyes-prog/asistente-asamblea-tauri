import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { DB } from '$lib/services/db';
import { gruposMarcadoresPlantilla, type GrupoMarcadoresPlantilla } from './marcadoresPlantillas';

export interface PlantillaWhatsApp {
  id: string;
  title: string;
  body: string;
  isOpen?: boolean;
}

export type GrupoMarcadores = GrupoMarcadoresPlantilla;
export const marcadoresWhatsApp: GrupoMarcadores[] = gruposMarcadoresPlantilla;

export const whatsAppTemplates = writable<PlantillaWhatsApp[]>([
  { id: 'programa_recordatorio', title: 'Asignación y recordatorio del programa', body: '', isOpen: false },
  { id: 'contacto_orador', title: 'Contacto desde la lista de oradores', body: '', isOpen: false },
  { id: 'registro_orador', title: 'Contacto desde el registro de oradores', body: '', isOpen: false },
  { id: 'oficina', title: 'Auxiliares de Oficina', body: '', isOpen: false },
  { id: 'comite', title: 'Integrantes del Comité', body: '', isOpen: false },
  { id: 'departamentos', title: 'Equipos de departamentos', body: '', isOpen: false }
]);

export async function cargarPlantillasWhatsApp(): Promise<void> {
  const plantillas = get(whatsAppTemplates);
  const resultados = await Promise.all(plantillas.map(async (plantilla) => {
    try {
      const res: any = await invoke('obtener_plantilla_mensaje', { id: plantilla.id });
      if (res && res.cuerpo !== undefined) return { ...plantilla, body: res.cuerpo || '' };
    } catch (error) {
      console.error(`Error cargando plantilla WhatsApp ${plantilla.id}:`, error);
    }
    return plantilla;
  }));
  whatsAppTemplates.set(resultados);
}

export async function guardarPlantillaWhatsApp(id: string, cuerpo: string): Promise<void> {
  try {
    const plantilla = get(whatsAppTemplates).find(item => item.id === id);
    await DB.guardarPlantillaMensaje(id, plantilla?.title || '', cuerpo);
    whatsAppTemplates.update(items =>
      items.map(item => item.id === id ? { ...item, body: cuerpo } : item)
    );
  } catch (error) {
    console.error(`Error guardando plantilla WhatsApp "${id}":`, error);
    throw error;
  }
}

export function obtenerPlantillaWhatsAppPorId(id: string): PlantillaWhatsApp | undefined {
  return get(whatsAppTemplates).find(plantilla => plantilla.id === id);
}

export async function resetearPlantillaWhatsApp(id: string): Promise<void> {
  await guardarPlantillaWhatsApp(id, '');
}
