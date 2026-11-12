export interface MargenesPlantilla {
  superior: number;
  derecho: number;
  inferior: number;
  izquierdo: number;
}

export const MARGENES_PLANTILLA_POR_DEFECTO: MargenesPlantilla = {
  superior: 2.54,
  derecho: 2.54,
  inferior: 2.54,
  izquierdo: 2.54
};

const MARCADOR_MARGENES = /<!--\s*page-margins:(\{[\s\S]*?\})\s*-->/i;

export function leerMargenesPlantilla(html: string): {
  contenido: string;
  margenes: MargenesPlantilla;
} {
  const coincidencia = html.match(MARCADOR_MARGENES);
  if (!coincidencia) {
    return { contenido: html, margenes: { ...MARGENES_PLANTILLA_POR_DEFECTO } };
  }

  const valores = JSON.parse(coincidencia[1]) as Partial<MargenesPlantilla>;
  const margenes = { ...MARGENES_PLANTILLA_POR_DEFECTO, ...valores };
  for (const [lado, valor] of Object.entries(margenes)) {
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
      throw new Error(`El margen ${lado} de la plantilla no es válido.`);
    }
  }

  return {
    contenido: html.replace(MARCADOR_MARGENES, ''),
    margenes
  };
}

export function guardarMargenesEnPlantilla(html: string, margenes: MargenesPlantilla): string {
  const contenido = leerMargenesPlantilla(html).contenido;
  return `<!-- page-margins:${JSON.stringify(margenes)} -->${contenido}`;
}
