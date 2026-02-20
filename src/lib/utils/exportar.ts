import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// --- HELPERS ---
const check = (valor: boolean) => valor ? 'SÍ' : '-';
const estado = (txt: string) => txt === 'Confirmado' ? 'SÍ' : '-';

/**
 * EXPORTAR PROGRAMA
 * Versión ultra-estable usando únicamente writeFile.
 */
export async function exportarProgramaPDF(partes: any[], tituloDia: string) {
    // Validación para evitar errores si los datos no han cargado
    if (!partes || !Array.isArray(partes)) {
        return;
    }

    const doc = new jsPDF();
    const ordenDias = ['Viernes', 'Sábado', 'Domingo'];
    let esPrimeraPaginaGlobal = true;

    for (const dia of ordenDias) {
        const partesDelDia = partes.filter(p => p && p.dia === dia);
        if (partesDelDia.length === 0) continue;

        if (!esPrimeraPaginaGlobal) {
            doc.addPage();
        }
        esPrimeraPaginaGlobal = false;

        // --- ENCABEZADO ---
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.setFont("helvetica", "bold");
        doc.text("Programa de Asamblea", 14, 15);
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text(`Generado: ${new Date().toLocaleDateString()} - ${tituloDia}`, 14, 21);

        // --- FRANJA DEL DÍA ---
        doc.setFillColor(59, 130, 246); 
        doc.rect(0, 26, 210, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.text(dia.toUpperCase(), 105, 31.5, { align: 'center' });

        // --- TABLA ---
        autoTable(doc, {
            startY: 38,
            margin: { top: 15, bottom: 15 }, 
            head: [["Hora", "Tema", "Orador", "Bosq.", "Recib.", "Pres.", "Ens."]],
            body: partesDelDia.map(p => [
                p.hora_inicio || "-",
                p.es_video ? `(V) ${p.tema}` : (p.tema || ""),
                p.nombre_orador || "---",
                p.numero_bosquejo || "",
                estado(p.estado),
                check(p.esta_presente),
                check(p.ensayo_terminado)
            ]),
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 15 },
                2: { cellWidth: 35 },
                3: { cellWidth: 12 },
                4: { cellWidth: 12 },
                5: { cellWidth: 12 },
                6: { cellWidth: 12 }
            }
        });
    }

    // --- PROCESO DE GUARDADO CON FS ---
    try {
        const pdfArrayBuffer = doc.output('arraybuffer');
        const pdfBytes = new Uint8Array(pdfArrayBuffer);

        // 1. El diálogo para obtener la ruta
        const selectedPath = await save({
            defaultPath: `Programa_${tituloDia.replace(/ /g, '_')}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });

        // 2. La escritura directa del archivo
        if (selectedPath) {
            await writeFile(selectedPath, pdfBytes);
            alert(`✅ Archivo guardado correctamente.`);
        }
    } catch (err) {
        console.error("Error al escribir el archivo:", err);
        alert("No se pudo guardar el PDF. Verifique los permisos de carpeta.");
    }
}

/**
 * EXPORTAR OFICINA
 */
export async function exportarOficinaPDF(oficina: any, personal: any[], dia: string) {
    const doc = new jsPDF();
    doc.text(`Asignaciones de Oficina - ${dia}`, 14, 20);

    try {
        const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
        const path = await save({ defaultPath: `Oficina_${dia}.pdf` });
        if (path) await writeFile(path, pdfBytes);
    } catch (e) {
        console.error(e);
    }
}