import type { ContextoDocumento } from './contexto_impresion';
import { prepararTextoPlantilla } from './marcadoresPlantillas';

export function prepararContenidoWhatsApp(htmlTiptap: string, contexto: ContextoDocumento): string {
  return prepararTextoPlantilla(htmlTiptap, contexto);
}
