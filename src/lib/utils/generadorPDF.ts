// src/lib/utils/generadorPDF.ts
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

import { crearPdf } from './pdfMakeConfigurado';
import { normalizarFuentesHtmlParaPdf } from './fuentesDocumento';
import htmlToPdfmake from 'html-to-pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

/**
 * Convierte código HTML a estructura nativa de pdfMake
 */
export function convertirHtmlAPdf(htmlContent: string): Content[] {
    if (!htmlContent || htmlContent.trim() === '') return [];
    
    // Limpieza básica (mantiene los estilos)
    const htmlLimpio = normalizarFuentesHtmlParaPdf(
        htmlContent.replace(/&nbsp;/gi, ' ').replace(/<p>\s*<\/p>/g, '')
    );
    
    return htmlToPdfmake(htmlLimpio, {
        removeExtraBlanks: true,
        defaultStyles: {
            p: { margin: [0, 0, 0, 10], alignment: 'justify' }
        }
    }) as Content[];
}

/**
 * Transforma "2026-12-04 a 2026-12-06" en "04/12/2026 - 06/12/2026"
 */
export function formatearFechaGlobal(fechaRaw: string): string {
    if (!fechaRaw) return 'Sin fecha';
    try {
        if (fechaRaw.includes(' a ')) {
            const fechas = fechaRaw.split(' a ');
            const f1 = fechas[0].trim().split('-').reverse().join('/');
            const f2 = fechas[1].trim().split('-').reverse().join('/');
            return `${f1} - ${f2}`;
        }
        return fechaRaw.split('-').reverse().join('/');
    } catch (e) {
        return fechaRaw.replace(/-/g, '/').replace(' a ', ' - ');
    }
}

/**
 * Función maestra para guardar usando pdfMake
 */
export async function generarYGuardarPdfMake(docDefinition: TDocumentDefinitions, nombreArchivo: string): Promise<void> {
    try {
        const pdfDocGenerator = await crearPdf(docDefinition);
        const blob = await pdfDocGenerator.getBlob();
        const arrayBuffer = await blob.arrayBuffer();
        const binary = new Uint8Array(arrayBuffer);

        await guardarBytesEnDisco(binary, nombreArchivo);
    } catch (error) {
        console.error("Error interno en pdfMake:", error);
        throw error;
    }
}

/**
 * Función genérica para guardar los bytes directamente 
 * (Muy útil para cuando usemos pdf-lib en el Formulario Rellenable)
 */
export async function guardarBytesEnDisco(binary: Uint8Array, nombreSugerido: string): Promise<void> {
    const safeName = nombreSugerido.replace(/[^a-zA-Z0-9_\-\s]/g, '');

    const path = await save({
        defaultPath: `${safeName}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (path) {
        await writeFile(path, binary);
        console.log(`✅ PDF guardado exitosamente en: ${path}`);
    }
}