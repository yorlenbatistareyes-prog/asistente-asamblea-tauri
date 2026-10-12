import type { ContextoDocumento } from './contexto_impresion';
import { prepararTextoPlantilla, reemplazarMarcadoresPlantilla } from './marcadoresPlantillas';

export function prepararContenidoEmail(htmlTiptap: string, contexto: ContextoDocumento): string {
  return prepararTextoPlantilla(htmlTiptap, contexto);
}

export function prepararAsuntoEmail(asunto: string, contexto: ContextoDocumento): string {
  return reemplazarMarcadoresPlantilla(asunto, contexto);
}
