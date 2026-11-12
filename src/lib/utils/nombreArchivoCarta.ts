import type { ContextoDocumento } from './contexto_impresion';

function limpiarParteNombreArchivo(valor: string): string {
  return valor
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[. ]+$/g, '')
    .replace(/_+/g, '_');
}

function formatearFechaNombreArchivo(fecha: string): string {
  const fechas = fecha.match(/\d{4}-\d{2}-\d{2}/g);
  if (fechas?.length) {
    return fechas
      .map(fechaIso => fechaIso.split('-').reverse().join('-'))
      .join('_al_');
  }

  return limpiarParteNombreArchivo(fecha) || 'Fecha_por_definir';
}

export function generarNombreArchivoCarta(
  datos: Pick<ContextoDocumento, 'id_asamblea' | 'identificador_asamblea' | 'fecha_asamblea' | 'nombre_completo' | 'tipo_asignacion'>,
  idPlantilla: string
): string {
  const rol = `${idPlantilla} ${datos.tipo_asignacion}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const prefijo = rol.includes('presidente') || rol.includes('presidencia')
    ? 'Presidente'
    : rol.includes('oracion')
      ? 'Oración'
      : 'Orador';
  const nombre = limpiarParteNombreArchivo(datos.nombre_completo) || 'Sin_nombre';
  const identificador = limpiarParteNombreArchivo(datos.identificador_asamblea) || `Asamblea_${limpiarParteNombreArchivo(datos.id_asamblea)}`;
  const fecha = formatearFechaNombreArchivo(datos.fecha_asamblea);

  return `${prefijo}_${nombre}_${identificador}_${fecha}.pdf`;
}
