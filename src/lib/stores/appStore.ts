import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';

export interface AppState {
  version: string;
  asambleas: any[];
  usuario: string;
}

const initialState: AppState = {
  version: '1.0.0',
  asambleas: [],
  usuario: 'Invitado'
};

export const appStore = writable<AppState>(initialState);

// Función para cargar todos los datos desde el backend y actualizar el store
export async function cargarDatosGlobales() {
  try {
    const [version, asambleas, config] = await Promise.all([
      getVersion(),
      invoke('obtener_asambleas'),
      invoke('obtener_configuracion_general')
    ]);

    appStore.update(state => ({
      ...state,
      version: version || '1.0.0',
      asambleas: asambleas as any[],
      usuario: (config as any)?.nombre || (config as any)?.nombre_usuario || 'Invitado'
    }));
  } catch (e) {
    console.error('Error cargando datos globales:', e);
  }
}