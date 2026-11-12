export const FUENTES_DOCUMENTO = [
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Aptos',
  'Aptos Display',
  'Book Antiqua',
  'Calibri',
  'Calibri Light',
  'Cambria',
  'Cambria Math',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'Franklin Gothic Medium',
  'Garamond',
  'Georgia',
  'Impact',
  'Lucida Console',
  'Palatino Linotype',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana'
] as const;

const FUENTES_PDF = [
  ...FUENTES_DOCUMENTO,
  'Roboto',
  'Serif',
  'Sans-Serif',
  'Monospace',
  'Cursive'
] as const;

const fuentesPdfPorNombre = new Map(FUENTES_PDF.map(fuente => [fuente.toLowerCase(), fuente]));

export function normalizarFuentesHtmlParaPdf(html: string): string {
  return html.replace(/\bstyle=(["'])(.*?)\1/gi, (_atributo, comilla: string, estilos: string) => {
    const estilosNormalizados = estilos.replace(/font-family\s*:\s*([^;]*)/gi, (_declaracion, valor: string) => {
      const nombre = valor
        .replace(/&quot;|&#34;|&#x22;/gi, '"')
        .replace(/&apos;|&#39;/gi, "'")
        .split(',')[0]
        .replace(/["']/g, '')
        .trim();
      const fuente = fuentesPdfPorNombre.get(nombre.toLowerCase()) || 'Roboto';
      return `font-family: '${fuente}'`;
    });

    return `style=${comilla}${estilosNormalizados}${comilla}`;
  });
}
