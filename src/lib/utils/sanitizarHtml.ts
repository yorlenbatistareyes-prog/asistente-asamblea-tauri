import DOMPurify from 'dompurify';

const ETIQUETAS_PERMITIDAS = [
  'a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'hr', 'li', 'mark', 'ol', 'p', 'pre', 's', 'span', 'strong', 'u', 'ul'
];
const ATRIBUTOS_PERMITIDOS = ['href', 'rel', 'style', 'target', 'title'];
let hookDeEstilosRegistrado = false;

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, caracter => {
    switch (caracter) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return caracter;
    }
  });
}

function filtrarEstilos(estilos: string): string {
  return estilos
    .split(';')
    .map(declaracion => {
      const separador = declaracion.indexOf(':');
      if (separador < 0) return null;

      const propiedad = declaracion.slice(0, separador).trim().toLowerCase();
      const valor = declaracion.slice(separador + 1).trim();
      if (
        (propiedad === 'color' || propiedad === 'background-color') &&
        /^#[\da-f]{3,8}$/i.test(valor)
      ) {
        return `${propiedad}: ${valor}`;
      }
      if (propiedad === 'text-align' && /^(left|center|right|justify)$/i.test(valor)) {
        return `${propiedad}: ${valor.toLowerCase()}`;
      }
      return null;
    })
    .filter((declaracion): declaracion is string => declaracion !== null)
    .join('; ');
}

export function sanitizarHtml(texto: string): string {
  if (typeof window === 'undefined') return escaparHtml(texto);

  if (!hookDeEstilosRegistrado) {
    DOMPurify.addHook('uponSanitizeAttribute', (_elemento, atributo) => {
      if (atributo.attrName !== 'style') return;
      const estilosSeguros = filtrarEstilos(atributo.attrValue);
      if (!estilosSeguros) {
        atributo.keepAttr = false;
      } else {
        atributo.attrValue = estilosSeguros;
      }
    });
    hookDeEstilosRegistrado = true;
  }

  return DOMPurify.sanitize(texto, {
    ALLOWED_TAGS: ETIQUETAS_PERMITIDAS,
    ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
    ALLOW_DATA_ATTR: false
  });
}
