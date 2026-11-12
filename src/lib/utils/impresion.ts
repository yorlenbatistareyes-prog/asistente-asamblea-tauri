import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { ContextoDocumento } from './contexto_impresion';
import { reemplazarMarcadoresPlantilla } from './marcadoresPlantillas';

import { crearPdf } from './pdfMakeConfigurado';
import { normalizarFuentesHtmlParaPdf } from './fuentesDocumento';
import { generarNombreArchivoCarta } from './nombreArchivoCarta';
import { leerMargenesPlantilla } from './margenesPlantilla';
import htmlToPdfmake from 'html-to-pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

// CONFIGURACIÓN DE TIPOS
interface MembreteConfig {
    usarEncabezado: boolean;
    usarPiePagina: boolean;
    titulo: string;
    contacto: string;
    piePagina: string;
    colorLinea: string;
    colorTexto: string;
    colorLineaPie: string;
    colorTextoPie: string;
    tamanoTitulo?: number;
    tamanoContacto?: number;
    tamanoPiePagina?: number;
}

const DEFAULT_MEMBRETE: MembreteConfig = {
    usarEncabezado: true,
    usarPiePagina: true,
    titulo: 'Presidencia de Asamblea Regional',
    contacto: '',
    piePagina: 'Información confidencial.',
    colorLinea: '#000000',
    colorTexto: '#000000',
    colorLineaPie: '#cccccc',
    colorTextoPie: '#666666',
    tamanoTitulo: 24,    
    tamanoContacto: 10,
    tamanoPiePagina: 8 
};

export async function generarCartaPDF(datos: ContextoDocumento, idPlantilla: string): Promise<void> {
    try {
        // 1. CARGAR CONFIGURACIÓN
        let configMembrete: MembreteConfig = { ...DEFAULT_MEMBRETE };
        const configGuardada = await invoke<string | null>('obtener_config_membrete');
        if (configGuardada) {
            const configParseada = JSON.parse(configGuardada) as Partial<MembreteConfig>;
            configMembrete = { ...DEFAULT_MEMBRETE, ...configParseada };
        }

        const sizeTitulo = configMembrete.tamanoTitulo || 24;
        const sizeContacto = configMembrete.tamanoContacto || 10;
        const sizePie = configMembrete.tamanoPiePagina || 8;

        // 2. OBTENER PLANTILLA
        console.log(`🔍 Buscando plantilla ID: "${idPlantilla}"`);
        const plantillaData = await invoke<any>('obtener_plantilla', { id: idPlantilla });
        
        if (!plantillaData) {
            alert(`⛔ ERROR: No se encontró la plantilla con ID "${idPlantilla}" en la base de datos.`);
            return;
        }

        let htmlContent: string = 
            plantillaData.cuerpo || 
            plantillaData.contenido || 
            plantillaData.body || 
            plantillaData.html || 
            plantillaData.text || 
            '';

        if (!htmlContent || htmlContent.trim() === '') {
            alert(`⚠️ LA PLANTILLA ESTÁ VACÍA.`);
            return;
        }

        const plantillaConMargenes = leerMargenesPlantilla(htmlContent);
        htmlContent = plantillaConMargenes.contenido;
        const margenesPagina = {
            superior: plantillaConMargenes.margenes.superior * 72 / 2.54,
            derecho: plantillaConMargenes.margenes.derecho * 72 / 2.54,
            inferior: plantillaConMargenes.margenes.inferior * 72 / 2.54,
            izquierdo: plantillaConMargenes.margenes.izquierdo * 72 / 2.54
        };
        const anchoContenido = 595.28 - margenesPagina.izquierdo - margenesPagina.derecho;
        if (anchoContenido <= 0) {
            throw new Error('Los márgenes izquierdo y derecho no dejan espacio para el contenido de la carta.');
        }

        // 3. REEMPLAZO DE MARCADORES
        htmlContent = reemplazarMarcadoresPlantilla(htmlContent, datos, true);
        htmlContent = normalizarFuentesHtmlParaPdf(htmlContent);

        // LIMPIEZA HTML BÁSICA PARA PDFMAKE
        // Dejamos los estilos intactos para que conserve el centrado y los colores del editor
        htmlContent = htmlContent.replace(/&nbsp;/gi, ' ');
        htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, '');

        // 4. CONVERSIÓN DE HTML A ESTRUCTURA NATIVA
        const htmlConvertido = htmlToPdfmake(htmlContent, {
            removeExtraBlanks: true,
            defaultStyles: {
                p: { margin: [0, 0, 0, 10], alignment: 'justify' }
            }
        }) as Content[];

        // 5. CONSTRUCCIÓN DEL DOCUMENTO NATIVO
        let contenidoDocumento: Content[] = [];

        // --- Dibujar Membrete ---
        if (configMembrete.usarEncabezado) {
            contenidoDocumento.push({
                text: configMembrete.titulo,
                fontSize: sizeTitulo,
                bold: true,
                alignment: 'center',
                color: configMembrete.colorTexto,
                margin: [0, 0, 0, 5]
            });
            contenidoDocumento.push({
                text: configMembrete.contacto,
                fontSize: sizeContacto,
                alignment: 'center',
                color: configMembrete.colorTexto,
                margin: [0, 0, 0, 10]
            });
            
            contenidoDocumento.push({
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: anchoContenido, y2: 0, lineWidth: 1, lineColor: configMembrete.colorLinea }],
                margin: [0, 0, 0, 20] 
            });
        }

        // Unimos el membrete con el texto de la carta
        contenidoDocumento = contenidoDocumento.concat(htmlConvertido);

        // --- Configuración Final de PDFMake ---
        const docDefinition: TDocumentDefinitions = {
            content: contenidoDocumento,
            pageSize: 'A4',
                pageMargins: [
                margenesPagina.izquierdo,
                margenesPagina.superior,
                margenesPagina.derecho,
                margenesPagina.inferior // Usamos el margen exacto de la plantilla
            ],
            defaultStyle: {
                font: 'Liberation Sans',
                fontSize: 11,
                lineHeight: 1.2
            },
            footer: function(currentPage: number, pageCount: number): Content | null {
                if (!configMembrete.usarPiePagina || currentPage !== pageCount) return null;
                return {
                    margin: [margenesPagina.izquierdo, 10, margenesPagina.derecho, 0],
                    stack: [
                        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: anchoContenido, y2: 0, lineWidth: 0.5, lineColor: configMembrete.colorLineaPie }], margin: [0, 0, 0, 5] },
                        { text: configMembrete.piePagina, alignment: 'center', fontSize: sizePie, color: configMembrete.colorTextoPie }
                    ]
                };
            }
        };

        // 6. GENERAR Y GUARDAR A TRAVÉS DE TAURI
        const pdfDocGenerator = await crearPdf(docDefinition);
        
        const blob = await pdfDocGenerator.getBlob();
        const arrayBuffer = await blob.arrayBuffer();
        const binary = new Uint8Array(arrayBuffer);
        try {
            const path = await save({
                defaultPath: generarNombreArchivoCarta(datos, idPlantilla),
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });
            
            if (path) {
                await writeFile(path, binary);
                alert("✅ Carta generada correctamente con motor nativo.");
            }
        } catch (e) {
            console.log("Guardado cancelado", e);
        }

    } catch (error) {
        console.error("Error PDF:", error);
        alert("Error al generar PDF: " + error);
    }
}
