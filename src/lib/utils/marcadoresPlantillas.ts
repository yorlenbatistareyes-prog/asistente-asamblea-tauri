import type { ContextoDocumento } from './contexto_impresion';

export interface MarcadorPlantilla {
  code: string;
  label: string;
  desc?: string;
}

export interface GrupoMarcadoresPlantilla {
  category: string;
  items: MarcadorPlantilla[];
}

export const gruposMarcadoresPlantilla: GrupoMarcadoresPlantilla[] = [
  {
    category: 'Saludo y orador',
    items: [
      { code: '[[Saludo según sexo]]', label: 'Saludo (hermano/hermana)', desc: 'Automático según género' },
      { code: '[[Nombre]]', label: 'Nombre de pila' },
      { code: '[[Segundo nombre]]', label: 'Segundo nombre' },
      { code: '[[Apellidos]]', label: 'Apellidos' },
      { code: '[[Nombre Completo]]', label: 'Nombre completo' },
      { code: '[[Congregación]]', label: 'Congregación' }
    ]
  },
  {
    category: 'Circuito y fechas',
    items: [
      { code: '[[Designación del Circuito]]', label: 'Circuito' },
      { code: '[[Fecha Actual Completa]]', label: 'Fecha actual (larga)' },
      { code: '[[Fecha Actual Mediana]]', label: 'Fecha actual (mediana)' }
    ]
  },
  {
    category: 'Asignación',
    items: [
      { code: '[[Hora]]', label: 'Hora de la asignación' },
      { code: '[[Duración]]', label: 'Duración', desc: 'En minutos' },
      { code: '[[Tema]]', label: 'Tema del discurso/rol' },
      { code: '[[Número de Bosquejo]]', label: 'Número de bosquejo' },
      { code: '[[Enlace(s) del Bosquejo]]', label: 'Enlace del bosquejo', desc: 'Si está disponible para la asignación' },
      { code: '[[Tipo de asignación]]', label: 'Tipo de asignación' },
      { code: '[[Notas]]', label: 'Notas de la asignación' }
    ]
  },
  {
    category: 'Lugar y evento',
    items: [
      { code: '[[Nombre del lugar]]', label: 'Nombre del lugar' },
      { code: '[[Dirección]]', label: 'Dirección' },
      { code: '[[Ciudad]]', label: 'Ciudad' },
      { code: '[[Estado o Provincia]]', label: 'Estado o provincia' },
      { code: '[[Fecha]]', label: 'Fecha del evento' },
      { code: '[[Tipo de Evento]]', label: 'Tipo de evento' },
      { code: '[[Tema del Evento]]', label: 'Tema del evento' }
    ]
  },
  {
    category: 'Ensayos',
    items: [
      { code: '[[Información completa de los ensayos]]', label: 'Información completa' },
      { code: '[[Lugar de los ensayos]]', label: 'Lugar de los ensayos' },
      { code: '[[Fecha y hora del ensayo]]', label: 'Fecha y hora del ensayo' },
      { code: '[[Fecha de ensayos]]', label: 'Fecha del ensayo' },
      { code: '[[Hora de ensayos]]', label: 'Hora del ensayo' },
      { code: '[[Notas para los ensayos]]', label: 'Notas de los ensayos' }
    ]
  },
  {
    category: 'Orientaciones y contacto',
    items: [
      { code: '[[Información de orientaciones]]', label: 'Orientaciones' },
      { code: '[[Instrucciones Especiales]]', label: 'Instrucciones especiales' },
      { code: '[[correo electrónico jwpub del Presidente de la asamblea]]', label: 'Correo del presidente' },
      { code: '[[Teléfono del Presidente de la asamblea]]', label: 'Teléfono del presidente' }
    ]
  }
];

function generarInfoEnsayos(contexto: ContextoDocumento): string {
  if (!contexto.ensayo_fecha || contexto.ensayo_fecha === 'No requiere ensayo previo' || contexto.ensayo_fecha === '---') {
    return 'No requiere ensayo previo para esta asignación.';
  }

  let info = `Fecha: ${contexto.ensayo_fecha} a las ${contexto.ensayo_hora}. Lugar: ${contexto.ensayo_lugar || 'Por definir'}.`;
  if (contexto.ensayo_direccion) info += ` Dirección: ${contexto.ensayo_direccion}.`;
  if (contexto.ensayo_notas) info += ` Notas: ${contexto.ensayo_notas}`;
  return info;
}

function construirLugarEnsayo(contexto: ContextoDocumento): string {
  if (!contexto.ensayo_fecha || contexto.ensayo_fecha === 'No requiere ensayo previo' || contexto.ensayo_fecha === '---') {
    return 'No aplica';
  }
  if (!contexto.ensayo_lugar) return 'Por definir';
  return contexto.ensayo_direccion
    ? `${contexto.ensayo_lugar} - ${contexto.ensayo_direccion}`
    : contexto.ensayo_lugar;
}

const reemplazos: Record<string, (contexto: ContextoDocumento) => string> = {
  '[[Saludo según sexo]]': (ctx) => ctx.saludo,
  '[[Nombre]]': (ctx) => ctx.nombre_pila,
  '[[Segundo nombre]]': (ctx) => ctx.segundo_nombre,
  '[[Apellidos]]': (ctx) => ctx.apellidos,
  '[[Nombre Completo]]': (ctx) => ctx.nombre_completo,
  '[[Congregación]]': (ctx) => ctx.congregacion,
  '[[Designación del Circuito]]': (ctx) => ctx.circuito,
  '[[Fecha Actual Completa]]': () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
  '[[Fecha Actual Mediana]]': () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
  '[[Hora]]': (ctx) => ctx.hora,
  '[[Duración]]': (ctx) => ctx.duracion ? `${ctx.duracion} minutos` : '',
  '[[Tema]]': (ctx) => ctx.tema_asignacion,
  '[[Número de Bosquejo]]': (ctx) => ctx.num_bosquejo,
  '[[Tipo de asignación]]': (ctx) => ctx.tipo_asignacion,
  '[[Enlace(s) del Bosquejo]]': (ctx) => ctx.enlace_bosquejo,
  '[[Notas]]': (ctx) => ctx.nota_asignacion,
  '[[Nombre del lugar]]': (ctx) => ctx.lugar_nombre,
  '[[Dirección]]': (ctx) => ctx.lugar_direccion,
  '[[Ciudad]]': (ctx) => ctx.ciudad,
  '[[Estado o Provincia]]': (ctx) => ctx.estado,
  '[[Fecha]]': (ctx) => ctx.fecha_evento_texto,
  '[[Tipo de Evento]]': (ctx) => ctx.tipo_evento,
  '[[Tema del Evento]]': (ctx) => ctx.tema_evento,
  '[[Información completa de los ensayos]]': generarInfoEnsayos,
  '[[Lugar de los ensayos]]': construirLugarEnsayo,
  '[[Fecha y hora del ensayo]]': (ctx) =>
    ctx.ensayo_fecha && ctx.ensayo_fecha !== 'No requiere ensayo previo' && ctx.ensayo_fecha !== '---'
      ? `${ctx.ensayo_fecha} a las ${ctx.ensayo_hora}`
      : 'No aplica',
  '[[Fecha de ensayos]]': (ctx) => ctx.ensayo_fecha,
  '[[Hora de ensayos]]': (ctx) => ctx.ensayo_hora,
  '[[Notas para los ensayos]]': (ctx) => ctx.ensayo_notas,
  '[[Información de orientaciones]]': (ctx) => ctx.orientaciones || 'No hay orientaciones específicas.',
  '[[Instrucciones Especiales]]': (ctx) => ctx.instrucciones || 'Ninguna.',
  '[[correo electrónico jwpub del Presidente de la asamblea]]': (ctx) => ctx.email_presidente,
  '[[Teléfono del Presidente de la asamblea]]': (ctx) => ctx.tel_presidente
};

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&nbsp;/gi, ' ')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function reemplazarMarcadoresPlantilla(
  contenido: string,
  contexto: ContextoDocumento,
  paraHtml = false
): string {
  let resultado = contenido;
  for (const [marcador, obtenerValor] of Object.entries(reemplazos)) {
    const valor = obtenerValor(contexto) || '';
    const valorSeguro = paraHtml
      ? valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      : valor;
    const marcadorEscapado = marcador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    resultado = resultado.replace(new RegExp(marcadorEscapado, 'g'), () => valorSeguro);
  }
  return resultado;
}

export function prepararTextoPlantilla(contenido: string, contexto: ContextoDocumento): string {
  if (!contenido) return '';
  const texto = decodificarEntidades(
    contenido
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  );
  return reemplazarMarcadoresPlantilla(texto, contexto).trim();
}
