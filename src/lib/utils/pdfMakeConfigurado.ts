import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { FUENTES_DOCUMENTO } from './fuentesDocumento';

interface PdfFontDescriptor {
  normal: string;
  bold: string;
  italics: string;
  bolditalics: string;
}

interface CustomPdfMake {
  fonts: Record<string, PdfFontDescriptor>;
  addVirtualFileSystem(vfs: Record<string, string>): void;
  createPdf: typeof pdfMake.createPdf;
}

interface CustomPdfFonts {
  default?: Record<string, string>;
  pdfMake?: { vfs: Record<string, string> };
  vfs?: Record<string, string>;
  [filename: string]: unknown;
}

export const pdf = pdfMake as unknown as CustomPdfMake;

const importedFonts = pdfFonts as unknown as CustomPdfFonts;
const vfs = importedFonts.pdfMake?.vfs
  || importedFonts.vfs
  || importedFonts.default
  || importedFonts as Record<string, string>;

const archivosRoboto = [
  'Roboto-Regular.ttf',
  'Roboto-Medium.ttf',
  'Roboto-Italic.ttf',
  'Roboto-MediumItalic.ttf'
];

if (archivosRoboto.some(archivo => typeof vfs[archivo] !== 'string')) {
  throw new Error('No se pudieron cargar las fuentes Roboto incluidas con pdfMake.');
}

pdf.addVirtualFileSystem(vfs);

const fuenteRoboto: PdfFontDescriptor = {
  normal: 'Roboto-Regular.ttf',
  bold: 'Roboto-Medium.ttf',
  italics: 'Roboto-Italic.ttf',
  bolditalics: 'Roboto-MediumItalic.ttf'
};

// pdfMake solo incluye Roboto; los alias evitan errores con fuentes de Word no empaquetadas.
pdf.fonts = {
  ...pdf.fonts,
  ...Object.fromEntries(
    [...FUENTES_DOCUMENTO, 'Roboto', 'Serif', 'Sans-Serif', 'Monospace', 'Cursive']
      .map(fuente => [fuente, fuenteRoboto])
  )
};
