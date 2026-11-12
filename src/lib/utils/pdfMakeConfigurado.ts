import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { ALIAS_FUENTES_PDF } from './fuentesDocumento';
import LiberationSansRegular from '../assets/fonts/LiberationSans-Regular.ttf?url';
import LiberationSansBold from '../assets/fonts/LiberationSans-Bold.ttf?url';
import LiberationSansItalic from '../assets/fonts/LiberationSans-Italic.ttf?url';
import LiberationSansBoldItalic from '../assets/fonts/LiberationSans-BoldItalic.ttf?url';
import CarlitoRegular from '../assets/fonts/Carlito-Regular.ttf?url';
import CarlitoBold from '../assets/fonts/Carlito-Bold.ttf?url';
import CarlitoItalic from '../assets/fonts/Carlito-Italic.ttf?url';
import CarlitoBoldItalic from '../assets/fonts/Carlito-BoldItalic.ttf?url';
import CaladeaRegular from '../assets/fonts/Caladea-Regular.ttf?url';
import CaladeaBold from '../assets/fonts/Caladea-Bold.ttf?url';
import CaladeaItalic from '../assets/fonts/Caladea-Italic.ttf?url';
import CaladeaBoldItalic from '../assets/fonts/Caladea-BoldItalic.ttf?url';
import LiberationSerifRegular from '../assets/fonts/LiberationSerif-Regular.ttf?url';
import LiberationSerifBold from '../assets/fonts/LiberationSerif-Bold.ttf?url';
import LiberationSerifItalic from '../assets/fonts/LiberationSerif-Italic.ttf?url';
import LiberationSerifBoldItalic from '../assets/fonts/LiberationSerif-BoldItalic.ttf?url';
import LiberationMonoRegular from '../assets/fonts/LiberationMono-Regular.ttf?url';
import LiberationMonoBold from '../assets/fonts/LiberationMono-Bold.ttf?url';
import LiberationMonoItalic from '../assets/fonts/LiberationMono-Italic.ttf?url';
import LiberationMonoBoldItalic from '../assets/fonts/LiberationMono-BoldItalic.ttf?url';
import LatoRegular from '../assets/fonts/Lato-Regular.ttf?url';
import LatoBold from '../assets/fonts/Lato-Bold.ttf?url';
import LatoItalic from '../assets/fonts/Lato-Italic.ttf?url';
import LatoBoldItalic from '../assets/fonts/Lato-BoldItalic.ttf?url';

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

interface ImportedPdfFonts {
  default?: Record<string, unknown>;
  pdfMake?: { vfs?: Record<string, unknown> };
  vfs?: Record<string, unknown>;
  [filename: string]: unknown;
}

const pdf = pdfMake as unknown as CustomPdfMake;
const importedFonts = pdfFonts as unknown as ImportedPdfFonts;
const sourceVfs = importedFonts.pdfMake?.vfs
  || importedFonts.vfs
  || importedFonts.default
  || importedFonts;
const baseVfs = Object.fromEntries(
  Object.entries(sourceVfs).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
);

if (!baseVfs['Roboto-Regular.ttf']) {
  throw new Error('No se pudieron cargar las fuentes Roboto incluidas con pdfMake.');
}

pdf.addVirtualFileSystem(baseVfs);

const urlsPorFamilia: Record<string, Record<string, string>> = {
  'Liberation Sans': {
    'LiberationSans-Regular.ttf': LiberationSansRegular,
    'LiberationSans-Bold.ttf': LiberationSansBold,
    'LiberationSans-Italic.ttf': LiberationSansItalic,
    'LiberationSans-BoldItalic.ttf': LiberationSansBoldItalic
  },
  Carlito: {
    'Carlito-Regular.ttf': CarlitoRegular,
    'Carlito-Bold.ttf': CarlitoBold,
    'Carlito-Italic.ttf': CarlitoItalic,
    'Carlito-BoldItalic.ttf': CarlitoBoldItalic
  },
  Caladea: {
    'Caladea-Regular.ttf': CaladeaRegular,
    'Caladea-Bold.ttf': CaladeaBold,
    'Caladea-Italic.ttf': CaladeaItalic,
    'Caladea-BoldItalic.ttf': CaladeaBoldItalic
  },
  'Liberation Serif': {
    'LiberationSerif-Regular.ttf': LiberationSerifRegular,
    'LiberationSerif-Bold.ttf': LiberationSerifBold,
    'LiberationSerif-Italic.ttf': LiberationSerifItalic,
    'LiberationSerif-BoldItalic.ttf': LiberationSerifBoldItalic
  },
  'Liberation Mono': {
    'LiberationMono-Regular.ttf': LiberationMonoRegular,
    'LiberationMono-Bold.ttf': LiberationMonoBold,
    'LiberationMono-Italic.ttf': LiberationMonoItalic,
    'LiberationMono-BoldItalic.ttf': LiberationMonoBoldItalic
  },
  Lato: {
    'Lato-Regular.ttf': LatoRegular,
    'Lato-Bold.ttf': LatoBold,
    'Lato-Italic.ttf': LatoItalic,
    'Lato-BoldItalic.ttf': LatoBoldItalic
  }
};

const familiasFuente: Record<string, PdfFontDescriptor> = {
  'Liberation Sans': {
    normal: 'LiberationSans-Regular.ttf',
    bold: 'LiberationSans-Bold.ttf',
    italics: 'LiberationSans-Italic.ttf',
    bolditalics: 'LiberationSans-BoldItalic.ttf'
  },
  Carlito: {
    normal: 'Carlito-Regular.ttf',
    bold: 'Carlito-Bold.ttf',
    italics: 'Carlito-Italic.ttf',
    bolditalics: 'Carlito-BoldItalic.ttf'
  },
  Caladea: {
    normal: 'Caladea-Regular.ttf',
    bold: 'Caladea-Bold.ttf',
    italics: 'Caladea-Italic.ttf',
    bolditalics: 'Caladea-BoldItalic.ttf'
  },
  'Liberation Serif': {
    normal: 'LiberationSerif-Regular.ttf',
    bold: 'LiberationSerif-Bold.ttf',
    italics: 'LiberationSerif-Italic.ttf',
    bolditalics: 'LiberationSerif-BoldItalic.ttf'
  },
  'Liberation Mono': {
    normal: 'LiberationMono-Regular.ttf',
    bold: 'LiberationMono-Bold.ttf',
    italics: 'LiberationMono-Italic.ttf',
    bolditalics: 'LiberationMono-BoldItalic.ttf'
  },
  Lato: {
    normal: 'Lato-Regular.ttf',
    bold: 'Lato-Bold.ttf',
    italics: 'Lato-Italic.ttf',
    bolditalics: 'Lato-BoldItalic.ttf'
  }
};

const aliasesFuentes = Object.fromEntries(
  Object.entries(ALIAS_FUENTES_PDF).map(([alias, familia]) => [alias, familiasFuente[familia]])
);

pdf.fonts = { ...pdf.fonts, ...familiasFuente, ...aliasesFuentes };

const cargasFuentes = new Map<string, Promise<void>>();

async function cargarFamiliaFuente(familia: string): Promise<void> {
  const archivos = urlsPorFamilia[familia];
  if (!archivos) return;

  const entradas = await Promise.all(
    Object.entries(archivos).map(async ([nombre, url]) => {
      const respuesta = await fetch(url);
      if (!respuesta.ok) {
        throw new Error(`No se pudo cargar la fuente PDF ${nombre}: ${respuesta.status}`);
      }

      const bytes = new Uint8Array(await respuesta.arrayBuffer());
      let binario = '';
      const tamanoBloque = 0x8000;
      for (let inicio = 0; inicio < bytes.length; inicio += tamanoBloque) {
        binario += String.fromCharCode(...bytes.subarray(inicio, inicio + tamanoBloque));
      }

      return [nombre, btoa(binario)] as const;
    })
  );

  pdf.addVirtualFileSystem(Object.fromEntries(entradas));
}

function buscarFuentesEnDocumento(docDefinition: TDocumentDefinitions): Set<string> {
  const fuentes = new Set<string>();
  const pendientes: unknown[] = [docDefinition];

  while (pendientes.length > 0) {
    const valor = pendientes.pop();
    if (!valor || typeof valor !== 'object') continue;

    if (Array.isArray(valor)) {
      pendientes.push(...valor);
      continue;
    }

    for (const [clave, contenido] of Object.entries(valor)) {
      if (clave === 'font' && typeof contenido === 'string') {
        fuentes.add(contenido);
      } else if (contenido && typeof contenido === 'object') {
        pendientes.push(contenido);
      }
    }
  }

  return fuentes;
}

export async function crearPdf(docDefinition: TDocumentDefinitions): Promise<ReturnType<typeof pdfMake.createPdf>> {
  const familiasUsadas = new Set<string>();
  for (const fuente of buscarFuentesEnDocumento(docDefinition)) {
    if (fuente.toLowerCase() === 'roboto') continue;

    const familia = Object.prototype.hasOwnProperty.call(familiasFuente, fuente)
      ? fuente
      : ALIAS_FUENTES_PDF[fuente];
    if (familia) familiasUsadas.add(familia);
  }

  await Promise.all([...familiasUsadas].map(familia => {
    if (!cargasFuentes.has(familia)) {
      const carga = cargarFamiliaFuente(familia).catch(error => {
        cargasFuentes.delete(familia);
        throw error;
      });
      cargasFuentes.set(familia, carga);
    }
    return cargasFuentes.get(familia);
  }));

  return pdf.createPdf(docDefinition);
}
