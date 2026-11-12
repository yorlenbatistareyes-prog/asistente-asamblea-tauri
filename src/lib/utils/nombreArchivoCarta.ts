import type { ContextoDocumento } from './contexto_impresion';

function limpiarParteNombreArchivo(valor: string): string {
  if (!valor) return '';
  return valor
    .normalize('NFC') // Mantiene tildes y eñes (opcional, quita el NFD si no las quieres)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ') // Quita caracteres inválidos
    .trim()
    .replace(/\s+/g, ' ') // Deja un solo espacio entre palabras
    .replace(/[. ]+$/g, ''); // Quita puntos o espacios al final
}

export function generarNombreArchivoCarta(
  datos: Pick<ContextoDocumento, 'id_asamblea' | 'identificador_asamblea' | 'nombre_completo' | 'tipo_asignacion'>,
  idPlantilla: string
): string {
  // 1. Determinamos el tipo (Carta Orador, Carta Presidente, etc.)
  const rol = `${idPlantilla} ${datos.tipo_asignacion}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  
  let prefijo = 'Carta Orador';
  if (rol.includes('presidente') || rol.includes('presidencia')) {
    prefijo = 'Carta Presidente';
  } else if (rol.includes('oracion') || rol.includes('oración')) {
    prefijo = 'Carta Oración';
  }

  // 2. Limpiamos el nombre (con tildes)
  const nombre = limpiarParteNombreArchivo(datos.nombre_completo) || 'Sin nombre';
  
  // 3. Limpiamos el identificador de la asamblea (ej. "Holguín 5")
  const identificador = limpiarParteNombreArchivo(datos.identificador_asamblea) || `Asamblea ${datos.id_asamblea}`;

  // 4. Retornamos el nombre: "Carta Orador_Nombre_Holguín 5.pdf"
  return `${prefijo}_${nombre}_${identificador}.pdf`;
}