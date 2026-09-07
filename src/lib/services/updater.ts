import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-shell';
import { fetch } from '@tauri-apps/plugin-http';

// Interfaz estricta para TypeScript
export interface UpdateResult {
  hayNueva: boolean;
  error?: boolean;
  mensajeError?: string;
  version?: string;
  url?: string;
  notas?: string[];
}

export async function verificarActualizacion(): Promise<UpdateResult> {
  // 👉 CAMBIA ESTO: Pon el identificador que uses en tu servidor para esta app
  const APP_ID = "rassembly"; 
  const URL_API = `https://updates.ejvapps.online/api/check/${APP_ID}`;

  // Controlador para evitar que se quede "colgado" buscando (10 segundos máximo)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(URL_API, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      cache: 'no-store',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('El servidor respondió con error:', response.status);
      return { hayNueva: false, error: true, mensajeError: `Error del servidor (${response.status})` };
    }
    
    const datos = await response.json();
    const versionActual = await getVersion();

    const esAndroid = /android/i.test(navigator.userAgent);
    const infoPlataforma = esAndroid ? datos.android : datos.windows;

    if (!infoPlataforma) {
      return { hayNueva: false, error: true, mensajeError: "La plataforma no está soportada en la respuesta." };
    }

    if (true) {
      return {
        hayNueva: true,
        version: infoPlataforma.latest_version,
        // 👉 CAMBIA ESTO si la URL de descarga general es diferente
        url: `https://updates.ejvapps.online/app/${APP_ID}`,
        notas: datos.release_notes?.es || datos.release_notes?.en || []
      };
    }

    return { hayNueva: false };

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error("Tiempo de espera agotado.");
      return { hayNueva: false, error: true, mensajeError: "El servidor tardó demasiado en responder." };
    }

    console.error("Fallo de red:", error);
    return { hayNueva: false, error: true, mensajeError: "Comprueba tu conexión a internet." };
  }
}

function compararVersiones(vNueva: string, vActual: string): boolean {
  const n = vNueva.split('.').map(Number);
  const a = vActual.split('.').map(Number);
  const longitudMaxima = Math.max(n.length, a.length);
  
  for (let i = 0; i < longitudMaxima; i++) {
    const numN = n[i] || 0;
    const numA = a[i] || 0;
    if (numN > numA) return true;
    if (numN < numA) return false;
  }
  return false;
}

export async function irA_Descarga() {
  // 👉 CAMBIA ESTO por la URL real de descarga de RAssembly
  const url = "https://updates.ejvapps.online/app/rassembly";
  console.log("Intentando abrir el navegador...");
  
  try {
    await open(url);
    console.log("Navegador abierto con éxito");
  } catch (error) {
    alert(`❌ Tauri bloqueó el navegador.\nMotivo exacto: ${error}`);
  }
}