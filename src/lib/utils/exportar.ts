import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// 1. IMPORTACIONES DE PDFMAKE (Nativo y limpio)
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';

// 2. INYECCIÓN DE FUENTES (TypeScript Estricto Puro)
interface CustomPdfFonts {
    pdfMake?: { vfs: Record<string, string> };
    vfs?: Record<string, string>;
}
interface CustomPdfMake {
    vfs: Record<string, string>;
    createPdf: typeof pdfMake.createPdf;
}

const fonts = pdfFonts as unknown as CustomPdfFonts;
const pdf = pdfMake as unknown as CustomPdfMake;
pdf.vfs = fonts.pdfMake ? fonts.pdfMake.vfs : (fonts.vfs || {});

// --- HELPERS ---
const check = (valor: boolean) => valor ? 'SÍ' : '-';
const estado = (txt: string) => txt === 'Confirmado' ? 'SÍ' : '-';

/**
 * EXPORTAR PROGRAMA
 * Genera el PDF del programa (Orientación Horizontal para que quepan las columnas)
 */
export async function exportarProgramaPDF(partes: any[], tituloDia: string) {
    if (!partes || !Array.isArray(partes) || partes.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    // 1. Obtener Datos
    let asamblea = { tema: 'Asamblea', fecha: '', nombre: 'Asamblea Regional' };
    const guardadoAsamblea = localStorage.getItem('asambleaActiva');
    if (guardadoAsamblea) asamblea = { ...asamblea, ...JSON.parse(guardadoAsamblea) };

    let pieDePagina = "";
    const guardadoMembrete = localStorage.getItem('config_membrete');
    if (guardadoMembrete) {
        try {
            const configMembrete = JSON.parse(guardadoMembrete);
            if (configMembrete.usarPiePagina && configMembrete.piePagina) {
                pieDePagina = configMembrete.piePagina;
            }
        } catch (e) { console.error("Error al leer config_membrete:", e); }
    }

    let textoObjetivo = tituloDia.toUpperCase();
    if (!textoObjetivo.includes("PROGRAMA")) textoObjetivo = "PROGRAMA DEL DÍA: " + textoObjetivo;

    const contenidoDoc: Content[] = [];
    const ordenDias = ['Viernes', 'Sábado', 'Domingo'];
    let esPrimeraPagina = true;

    for (const dia of ordenDias) {
        const partesDelDia = partes.filter(p => p && p.dia === dia);
        if (partesDelDia.length === 0) continue;

        // Si no es la primera página, forzamos un salto de página
        const pageBreakConfig = !esPrimeraPagina ? { pageBreak: 'before' as const } : {};

        // --- ENCABEZADO (Solo en la primera página) ---
        if (esPrimeraPagina) {
            contenidoDoc.push({ text: (asamblea.nombre || "ASAMBLEA REGIONAL").toUpperCase(), fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 4] });
            contenidoDoc.push({ text: (asamblea.tema || "").toUpperCase(), fontSize: 12, color: '#4b5563', alignment: 'center', margin: [0, 0, 0, 4] });
            contenidoDoc.push({ text: asamblea.fecha || "", fontSize: 10, alignment: 'center', margin: [0, 0, 0, 6] });
            contenidoDoc.push({ text: textoObjetivo, fontSize: 11, bold: true, color: '#3b82f6', alignment: 'center', margin: [0, 0, 0, 15] });
            esPrimeraPagina = false;
        }

        // --- PÍLDORA DEL DÍA ---
        contenidoDoc.push({
            ...pageBreakConfig, // Aquí se aplica el salto de página si corresponde
            table: {
                widths: ['auto'],
                body: [[{ text: dia.toUpperCase(), bold: true, color: 'white', fillColor: '#3b82f6', margin: [10, 4, 10, 4] }]]
            },
            layout: 'noBorders',
            margin: [0, 10, 0, 5]
        });

        // --- TABLA DEL PROGRAMA ---
        const tableBody: TableCell[][] = [
            // Cabecera
            [
                { text: 'Hora', style: 'th' }, { text: 'Tema', style: 'th' }, { text: 'Orador', style: 'th' }, 
                { text: 'Bosq.', style: 'th' }, { text: 'Recib.', style: 'th', alignment: 'center' }, 
                { text: 'Pres.', style: 'th', alignment: 'center' }, { text: 'Ens.', style: 'th', alignment: 'center' }
            ]
        ];

        partesDelDia.forEach(p => {
            const isVideo = p.es_video || (p.fuente && p.fuente.toLowerCase().includes('video'));
            const temaFinal = isVideo ? `(V) ${p.tema || ""}` : (p.tema || "");
            
            tableBody.push([
                { text: p.hora_inicio || "-", style: 'td' },
                { text: temaFinal, style: 'td' },
                { text: p.nombre_orador || "---", style: 'td', bold: true },
                { text: p.numero_bosquejo || "", style: 'td' },
                { text: estado(p.estado), style: 'td', alignment: 'center' },
                { text: check(p.esta_presente), style: 'td', alignment: 'center' },
                { text: check(p.ensayo_terminado), style: 'td', alignment: 'center' }
            ]);
        });

        contenidoDoc.push({
            table: {
                headerRows: 1,
                widths: ['auto', '*', '25%', 'auto', 'auto', 'auto', 'auto'],
                body: tableBody
            },
            layout: {
                fillColor: (rowIndex) => rowIndex === 0 ? '#475569' : (rowIndex % 2 === 0 ? '#f8fafc' : null),
                hLineWidth: () => 0.5,
                vLineWidth: () => 0,
                hLineColor: () => '#e2e8f0'
            },
            margin: [0, 0, 0, 20]
        });
    }

    const docDefinition: TDocumentDefinitions = {
        pageSize: 'A4',
        pageOrientation: 'landscape', // Horizontal para que quepa bien la tabla
        pageMargins: [30, 30, 30, pieDePagina ? 40 : 30],
        content: contenidoDoc,
        footer: pieDePagina ? function(currentPage, pageCount) {
            if (currentPage !== pageCount) return null; // Solo en la última página
            return { text: pieDePagina, alignment: 'center', fontSize: 8, color: '#6b7280', margin: [40, 10, 40, 0], italics: true };
        } : undefined,
        styles: {
            th: { bold: true, fontSize: 9, color: 'white', margin: [0, 4, 0, 4] },
            td: { fontSize: 9, color: '#1f2937', margin: [0, 4, 0, 4] }
        },
        defaultStyle: { font: 'Roboto' }
    };

    generarYGuardarPDF(docDefinition, `Programa_${tituloDia.replace(/ /g, '_')}`);
}

/**
 * EXPORTAR OFICINA
 * Personal en página 1, y cada día de asignación en una página nueva.
 */
export async function exportarOficinaPDF(datosDias: any, personal: any[], titulo: string) {
    let asamblea = { tema: 'Asamblea', fecha: '', nombre: 'Asamblea Regional' };
    const guardadoAsamblea = localStorage.getItem('asambleaActiva');
    if (guardadoAsamblea) asamblea = { ...asamblea, ...JSON.parse(guardadoAsamblea) };

    const contenidoDoc: Content[] = [];

    // --- PÁGINA 1: ENCABEZADO Y PERSONAL DE OFICINA ---
    contenidoDoc.push({ text: (asamblea.nombre || "ASAMBLEA REGIONAL").toUpperCase(), fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 4] });
    contenidoDoc.push({ text: (asamblea.tema || "").toUpperCase(), fontSize: 12, color: '#4b5563', alignment: 'center', margin: [0, 0, 0, 4] });
    contenidoDoc.push({ text: asamblea.fecha || "", fontSize: 10, alignment: 'center', margin: [0, 0, 0, 6] });
    contenidoDoc.push({ text: "RESUMEN GENERAL DE OFICINA", fontSize: 11, bold: true, color: '#3b82f6', alignment: 'center', margin: [0, 0, 0, 20] });

    // Píldora Auxiliares
    contenidoDoc.push({
        table: { widths: ['auto'], body: [[{ text: 'PERSONAL REGISTRADO', bold: true, color: 'white', fillColor: '#475569', margin: [10, 4, 10, 4] }]] },
        layout: 'noBorders', margin: [0, 0, 0, 5]
    });

    const bodyPersonal: TableCell[][] = [
        [ { text: 'Nombre Completo', style: 'th' }, { text: 'Congregación', style: 'th' }, { text: 'Teléfono', style: 'th' } ]
    ];

    // Mostrar filas de auxiliares o un mensaje si está vacío
    if (personal.length === 0) {
        bodyPersonal.push([{ text: 'No hay personal asignado a la oficina', style: 'td', colSpan: 3, alignment: 'center' }, {}, {}]);
    } else {
        personal.forEach(p => {
            bodyPersonal.push([
                { text: p.nombre_completo || '-', style: 'td' },
                { text: p.nombre_congregacion || '-', style: 'td' },
                { text: p.telefono || 'Sin registrar', style: 'td' }
            ]);
        });
    }

    contenidoDoc.push({
        table: { headerRows: 1, widths: ['*', 'auto', 'auto'], body: bodyPersonal },
        layout: { fillColor: (i) => i === 0 ? '#475569' : (i % 2 === 0 ? '#f8fafc' : null), hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => '#e2e8f0' }
    });

    // --- PÁGINAS SIGUIENTES: ASIGNACIONES DIARIAS ---
    const dias = ['Viernes', 'Sábado', 'Domingo'];
    
    for (const dia of dias) {
        const d = datosDias[dia] || {}; 

        // Píldora Día (CON SALTO DE PÁGINA ANTES)
        contenidoDoc.push({
            pageBreak: 'before',
            table: { widths: ['auto'], body: [[{ text: `HORARIO: ${dia.toUpperCase()}`, bold: true, color: 'white', fillColor: '#3b82f6', margin: [10, 4, 10, 4] }]] },
            layout: 'noBorders', margin: [0, 0, 0, 10]
        });

        // Diseño en 3 columnas: Rol | Mañana | Tarde
        const rowsAsignaciones: TableCell[][] = [
            [ 
                { text: 'Responsabilidad', style: 'thOficina' }, 
                { text: 'Sesión de Mañana', style: 'thOficina', alignment: 'center' }, 
                { text: 'Sesión de Tarde', style: 'thOficina', alignment: 'center' } 
            ],
            [ 
                { text: 'Presidente de sesión', style: 'tdLabel' }, 
                { text: d.presidente_manana?.nombre_completo || '---', style: 'tdValue' }, 
                { text: d.presidente_tarde?.nombre_completo || '---', style: 'tdValue' } 
            ],
            [ 
                { text: 'Mesa de Registro', style: 'tdLabel' }, 
                { text: d.registro_manana?.nombre_completo || '---', style: 'tdValue' }, 
                { text: d.registro_tarde?.nombre_completo || '---', style: 'tdValue' } 
            ],
            [ 
                { text: 'Ensayos y Sonido', style: 'tdLabel' }, 
                { text: d.ensayos_manana?.nombre_completo || '---', style: 'tdValue' }, 
                { text: d.ensayos_tarde?.nombre_completo || '---', style: 'tdValue' } 
            ],
            [ 
                { text: 'Orientaciones', style: 'tdLabel' }, 
                { text: d.orientaciones_manana?.nombre_completo || '---', style: 'tdValue' }, 
                { text: d.orientaciones_tarde?.nombre_completo || '---', style: 'tdValue' } 
            ],
            [ 
                { text: 'Acompañante Plataforma', style: 'tdLabel' }, 
                { text: d.plataforma_manana?.nombre_completo || '---', style: 'tdValue' }, 
                { text: d.plataforma_tarde?.nombre_completo || '---', style: 'tdValue' } 
            ]
        ];

        contenidoDoc.push({
            table: { headerRows: 1, widths: ['34%', '33%', '33%'], body: rowsAsignaciones },
            layout: { 
                fillColor: (i) => i === 0 ? '#3b82f6' : (i % 2 === 0 ? '#f8fafc' : null), 
                hLineWidth: () => 0.5, vLineWidth: () => 0.5, vLineColor: () => '#e2e8f0', hLineColor: () => '#e2e8f0' 
            }
        });
    }

    const docDefinition: TDocumentDefinitions = {
        pageSize: 'A4',
        pageOrientation: 'portrait', // Vertical para la oficina
        pageMargins: [40, 40, 40, 40],
        content: contenidoDoc,
        styles: {
            th: { bold: true, fontSize: 10, color: 'white', margin: [0, 4, 0, 4] },
            td: { fontSize: 10, color: '#1f2937', margin: [0, 4, 0, 4] },
            thOficina: { bold: true, fontSize: 11, color: 'white', margin: [0, 6, 0, 6] },
            tdLabel: { bold: true, fontSize: 10, color: '#4b5563', margin: [0, 8, 0, 8] },
            tdValue: { fontSize: 10, color: '#1f2937', margin: [0, 8, 0, 8], alignment: 'center' }
        },
        defaultStyle: { font: 'Roboto' }
    };

    generarYGuardarPDF(docDefinition, `Horario_Oficina`);
}

// --- FUNCIÓN REUTILIZABLE PARA GUARDAR EL PDF ---
async function generarYGuardarPDF(docDefinition: TDocumentDefinitions, nombreBase: string) {
    try {
        const pdfDocGenerator = pdf.createPdf(docDefinition);
        const blob = await pdfDocGenerator.getBlob();
        const arrayBuffer = await blob.arrayBuffer();
        const binary = new Uint8Array(arrayBuffer);

        const selectedPath = await save({
            defaultPath: `${nombreBase}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });

        if (selectedPath) {
            await writeFile(selectedPath, binary);
            alert(`✅ Documento exportado correctamente.`);
        }
    } catch (err: any) {
        console.error("Error al exportar PDF:", err);
        alert("⚠️ Error al generar PDF. Asegúrate de no tener un archivo con el mismo nombre abierto.");
    }
}