export const FUENTES_DOCUMENTO = [
  { value: 'Liberation Sans', label: 'Liberation Sans', equivalencia: 'Compatible con Arial' },
  { value: 'Carlito', label: 'Carlito', equivalencia: 'Compatible con Calibri' },
  { value: 'Caladea', label: 'Caladea', equivalencia: 'Compatible con Cambria' },
  { value: 'Liberation Serif', label: 'Liberation Serif', equivalencia: 'Compatible con Times New Roman' },
  { value: 'Liberation Mono', label: 'Liberation Mono', equivalencia: 'Compatible con Courier New' },
  { value: 'Lato', label: 'Lato', equivalencia: 'Fuente de código abierto' }
] as const;

export const ALIAS_FUENTES_PDF: Readonly<Record<string, string>> = {
  Arial: 'Liberation Sans',
  'Arial Black': 'Liberation Sans',
  'Arial Narrow': 'Liberation Sans',
  Aptos: 'Carlito',
  'Aptos Display': 'Carlito',
  'Book Antiqua': 'Caladea',
  Calibri: 'Carlito',
  'Calibri Light': 'Carlito',
  Cambria: 'Caladea',
  'Cambria Math': 'Caladea',
  Candara: 'Carlito',
  'Comic Sans MS': 'Liberation Sans',
  Consolas: 'Liberation Mono',
  Constantia: 'Caladea',
  Corbel: 'Carlito',
  'Courier New': 'Liberation Mono',
  'Franklin Gothic Medium': 'Liberation Sans',
  Garamond: 'Liberation Serif',
  Georgia: 'Caladea',
  Impact: 'Liberation Sans',
  'Lucida Console': 'Liberation Mono',
  'Palatino Linotype': 'Caladea',
  'Segoe UI': 'Liberation Sans',
  Tahoma: 'Liberation Sans',
  'Times New Roman': 'Liberation Serif',
  'Trebuchet MS': 'Carlito',
  Verdana: 'Carlito',
  'Liberation Sans': 'Liberation Sans',
  Carlito: 'Carlito',
  Caladea: 'Caladea',
  'Liberation Serif': 'Liberation Serif',
  'Liberation Mono': 'Liberation Mono',
  Lato: 'Lato',
  Serif: 'Liberation Serif',
  'Sans-Serif': 'Liberation Sans',
  Monospace: 'Liberation Mono',
  Cursive: 'Carlito'
};

const fuentesPdfPorNombre = new Map(
  Object.entries(ALIAS_FUENTES_PDF).map(([nombre, fuente]) => [nombre.toLowerCase(), fuente])
);

export function normalizarFuenteDocumento(fuente: string | null | undefined): string {
  if (!fuente) return 'Liberation Sans';
  return fuentesPdfPorNombre.get(fuente.trim().toLowerCase()) || 'Liberation Sans';
}

export function normalizarFuentesHtmlParaPdf(html: string): string {
  const documento = new DOMParser().parseFromString(html, 'text/html');
      for (const bloque of [...documento.body.querySelectorAll('p, div')].reverse()) {
    const texto = bloque.textContent?.replace(/[\s\u200B\uFEFF]/g, '');
    // Verificamos si el párrafo tiene un margen configurado
    const tieneMargen = bloque.getAttribute('style')?.includes('margin');
    
    if (!texto && !bloque.querySelector('img, hr, table, svg')) {
      if (tieneMargen) {
        // Si está vacío pero tiene margen, le inyectamos un espacio invisible 
        // para obligar a pdfMake a respetar la altura del párrafo.
        bloque.innerHTML = '&nbsp;';
      } else {
        // Si no tiene margen, lo borramos
        bloque.remove();
      }
    }
  }

  return documento.body.innerHTML
  .replace(/(<br\b[^>]*>)(?:\s*<br\b[^>]*>)+/gi, '$1')
  .replace(/\bstyle=(["'])(.*?)\1/gi, (_atributo, comilla: string, estilos: string) => {
    // 1. Normalizar fuentes
    const estilosConFuentes = estilos.replace(/font-family\s*:\s*([^;]*)/gi, (_declaracion, valor: string) => {
      const nombre = valor
        .replace(/&quot;|&#34;|&#x22;/gi, '"')
        .replace(/&apos;|&#39;/gi, "'")
        .split(',')[0]
        .replace(/["']/g, '')
        .trim();
      return `font-family: '${normalizarFuenteDocumento(nombre)}'`;
    });

    // 2. Eliminar márgenes verticales heredados de Word (no horizontales)
    const estilosSinMargenesVerticales = estilosConFuentes
      .replace(/(?:^|;)\s*margin-(?:top|bottom)\s*:[^;]*;?/gi, (match) => match.startsWith(';') ? ';' : '')
      .replace(/^\s*;+\s*/, '')
      .replace(/\s*;+\s*$/, '')
      .trim();

    return `style=${comilla}${estilosSinMargenesVerticales}${comilla}`;
  });
}
