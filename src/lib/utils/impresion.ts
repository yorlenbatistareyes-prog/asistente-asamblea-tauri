import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { ContextoDocumento } from './contexto_impresion';

// 1. IMPORTACIONES DE PDFMAKE (Estándar ES6 puro para Svelte/Vite)
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import htmlToPdfmake from 'html-to-pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

// 2. INYECCIÓN DE FUENTES (TypeScript Estricto Puro)
// Creamos interfaces formales para declarar las propiedades que le faltan a @types/pdfmake
interface CustomPdfFonts {
    pdfMake?: { vfs: Record<string, string> };
    vfs?: Record<string, string>;
}

interface CustomPdfMake {
    vfs: Record<string, string>;
    createPdf: typeof pdfMake.createPdf;
}

// Convertimos los módulos importados a nuestras interfaces seguras
const fonts = pdfFonts as unknown as CustomPdfFonts;
const pdf = pdfMake as unknown as CustomPdfMake;

// Ahora TypeScript reconoce 'vfs' perfectamente
pdf.vfs = fonts.pdfMake ? fonts.pdfMake.vfs : (fonts.vfs || {});

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
    usarEncabezado: false,
    usarPiePagina: false,
    titulo: '',
    contacto: '',
    piePagina: '',
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
        let configMembrete: MembreteConfig = DEFAULT_MEMBRETE;
        const configGuardada = localStorage.getItem('config_membrete');
        if (configGuardada) {
            configMembrete = { ...DEFAULT_MEMBRETE, ...JSON.parse(configGuardada) };
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

        // 3. REEMPLAZO DE MARCADORES
        const mapaReemplazo: Record<string, string> = {
            '[[Saludo según sexo]]': datos.saludo,
            '[[Designación del Circuito]]': datos.circuito,
            '[[Fecha Actual Completa]]': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
            '[[Fecha Actual Mediana]]': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
            '[[Hora]]': datos.hora,
            '[[Tema]]': datos.tema_asignacion,
            '[[Número de Bosquejo]]': datos.num_bosquejo,
            '[[Tipo de asignación]]': datos.tipo_asignacion,
            '[[Enlace(s) del Bosquejo]]': '',
            '[[Notas]]': datos.nota_asignacion,
            '[[Nombre]]': datos.nombre_pila,
            '[[Segundo nombre]]': datos.segundo_nombre,
            '[[Apellidos]]': datos.apellidos,
            '[[Nombre Completo]]': datos.nombre_completo,
            '[[Nombre del lugar]]': datos.lugar_nombre,
            '[[Dirección]]': datos.lugar_direccion,
            '[[Ciudad]]': datos.ciudad,
            '[[Estado o Provincia]]': datos.estado || '', 
            '[[Fecha]]': datos.fecha_evento_texto,
            '[[Tipo de Evento]]': datos.tipo_evento,
            '[[Tema del Evento]]': datos.tema_evento,
            '[[Información completa de los ensayos]]': generarInfoEnsayos(datos),
            '[[Lugar de los ensayos]]': construirLugarEnsayo(datos),
            '[[Fecha y hora del ensayo]]': `${datos.ensayo_fecha} a las ${datos.ensayo_hora}`,
            '[[Fecha de ensayos]]': datos.ensayo_fecha,
            '[[Hora de ensayos]]': datos.ensayo_hora,
            '[[Notas para los ensayos]]': datos.ensayo_notas,
            '[[Información de orientaciones]]': datos.orientaciones || 'No hay orientaciones específicas.',
            '[[Instrucciones Especiales]]': datos.instrucciones || 'Ninguna.',
            '[[correo electrónico jwpub del Presidente de la asamblea]]': datos.email_presidente,
            '[[Teléfono del Presidente de la asamblea]]': datos.tel_presidente
        };

        for (const [marcador, valor] of Object.entries(mapaReemplazo)) {
            const regex = new RegExp(marcador.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
            htmlContent = htmlContent.replace(regex, String(valor || ''));
        }

        // LIMPIEZA HTML BÁSICA PARA PDFMAKE
        // Dejamos los estilos intactos para que conserve el centrado y los colores del editor
        htmlContent = htmlContent.replace(/&nbsp;/gi, ' ');
        htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, '');

        // 4. CONVERSIÓN DE HTML A ESTRUCTURA NATIVA
        const htmlConvertido = htmlToPdfmake(htmlContent, {
            defaultStyles: {
                p: { margin: [0, 0, 0, 10], alignment: 'justify' }
            }
        }) as Content[];

        // 5. CONSTRUCCIÓN DEL DOCUMENTO NATIVO
        let contenidoDocumento: Content[] = [];

        // --- Dibujar Membrete ---
        if (configMembrete.usarEncabezado) {
            contenidoDocumento.push({
                text: configMembrete.titulo.toUpperCase(),
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
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: configMembrete.colorLinea }],
                margin: [0, 0, 0, 20] 
            });
        }

        // Unimos el membrete con el texto de la carta
        contenidoDocumento = contenidoDocumento.concat(htmlConvertido);

        // --- Configuración Final de PDFMake ---
        const docDefinition: TDocumentDefinitions = {
            content: contenidoDocumento,
            pageSize: 'A4',
            pageMargins: [40, 40, 40, configMembrete.usarPiePagina ? 60 : 40], // Izq, Arriba, Der, Abajo
            defaultStyle: {
                font: 'Roboto', 
                fontSize: 11,
                lineHeight: 1.2
            },
            footer: function(currentPage: number, pageCount: number): Content | null {
                if (!configMembrete.usarPiePagina || currentPage !== pageCount) return null;
                return {
                    margin: [40, 10, 40, 0],
                    stack: [
                        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: configMembrete.colorLineaPie }], margin: [0, 0, 0, 5] },
                        { text: configMembrete.piePagina, alignment: 'center', fontSize: sizePie, color: configMembrete.colorTextoPie }
                    ]
                };
            }
        };

        // 6. GENERAR Y GUARDAR A TRAVÉS DE TAURI
        // Usamos nuestro objeto 'pdf' estrictamente tipado
        const pdfDocGenerator = pdf.createPdf(docDefinition);
        
        const blob = await pdfDocGenerator.getBlob();
        const arrayBuffer = await blob.arrayBuffer();
        const binary = new Uint8Array(arrayBuffer);
        const safeName = (datos.nombre_completo || 'Documento').replace(/[^a-z0-9]/gi, '_');

        try {
            const path = await save({
                defaultPath: `Carta_${safeName}.pdf`,
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

// Helpers
function generarInfoEnsayos(d: ContextoDocumento): string {
    if (!d.ensayo_fecha || d.ensayo_fecha === '---') return "No se requiere ensayo.";
    let lugar = construirLugarEnsayo(d);
    return `Su ensayo está programado para el ${d.ensayo_fecha} a las ${d.ensayo_hora || ''} en ${lugar}.`;
}

function construirLugarEnsayo(d: ContextoDocumento): string {
    let lugar = d.ensayo_lugar || 'Salón de Asambleas';
    if (d.ensayo_direccion && d.ensayo_direccion.trim() !== '' && !lugar.includes(d.ensayo_direccion)) {
        return `${lugar} (${d.ensayo_direccion})`;
    }
    return lugar;
}