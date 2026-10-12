import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { DB } from '$lib/services/db';
import { gruposMarcadoresPlantilla, type GrupoMarcadoresPlantilla } from './marcadoresPlantillas';

export interface PlantillaEmail {
  id: string;
  title: string;
  subject: string;
  body: string;
  isOpen?: boolean;
}

export type GrupoMarcadores = GrupoMarcadoresPlantilla;
export const marcadoresEmail: GrupoMarcadores[] = gruposMarcadoresPlantilla;

export const emailTemplates = writable<PlantillaEmail[]>([
  { id: 'programa_individual', title: 'Asignación individual al orador', subject: 'Asignación en el Programa de la Asamblea', body: '', isOpen: false },
  { id: 'programa_recordatorio', title: 'Recordatorio individual de asignación', subject: 'Recordatorio de su participación en la Asamblea', body: '', isOpen: false },
  { id: 'masivo_general', title: 'Aviso general a varios oradores', subject: 'Información importante de la Asamblea', body: '', isOpen: false },
  { id: 'masivo_recordatorio', title: 'Recordatorio general a varios oradores', subject: 'Recordatorio General de Asignaciones', body: '', isOpen: false },
  { id: 'contacto_orador', title: 'Contacto desde la lista de oradores', subject: 'Información sobre su asignación en la Asamblea', body: '', isOpen: false },
  { id: 'registro_orador', title: 'Contacto desde el registro de oradores', subject: 'Información sobre su asignación en la asamblea', body: '', isOpen: false },
  { id: 'oficina', title: 'Auxiliares de Oficina', subject: 'Asignación en la Oficina de la Asamblea', body: '', isOpen: false },
  { id: 'comite', title: 'Integrantes del Comité', subject: 'Información para el Comité', body: '', isOpen: false },
  { id: 'departamentos', title: 'Equipos de departamentos', subject: 'Asignación de Departamento en la Asamblea', body: '', isOpen: false }
]);

export async function cargarPlantillasEmail(): Promise<void> {
  const plantillas = get(emailTemplates);
  const resultados = await Promise.all(plantillas.map(async (plantilla) => {
    try {
      const res: any = await invoke('obtener_plantilla_email', { id: plantilla.id });
      if (res && (res.asunto !== undefined || res.cuerpo !== undefined)) {
        return { ...plantilla, subject: res.asunto || '', body: res.cuerpo || '' };
      }
    } catch (error) {
      console.error(`Error cargando plantilla ${plantilla.id}:`, error);
    }
    return plantilla;
  }));
  emailTemplates.set(resultados);
}

export async function guardarPlantillaEmail(id: string, asunto: string, cuerpo: string): Promise<void> {
  try {
    await DB.guardarPlantillaEmail(id, asunto, cuerpo);
    emailTemplates.update(items =>
      items.map(plantilla => plantilla.id === id ? { ...plantilla, subject: asunto, body: cuerpo } : plantilla)
    );
  } catch (error) {
    console.error(`Error guardando plantilla "${id}":`, error);
    throw error;
  }
}

export function obtenerPlantillaPorId(id: string): PlantillaEmail | undefined {
  return get(emailTemplates).find(plantilla => plantilla.id === id);
}

export async function resetearPlantillaEmail(id: string): Promise<void> {
  await guardarPlantillaEmail(id, '', '');
}
