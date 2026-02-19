import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const check = (valor: boolean) => valor ? 'SÍ' : '-';
const estado = (txt: string) => txt === 'Confirmado' ? 'SÍ' : '-';

// ICONO AZUL PROFESIONAL (Base64 Real)
const ICONO_AZUL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABy0lEQVR4nO2XvUoDQRSFv80asRE7S0mXIn0AsRE7S8UHsLNSfAA7K8UHsLNSfAA7K8UHsLNSLMRKEUUkSByInS0WyXInyY8mInInA8vunp2537m7M3NnZpIkSZIkSZIkSZL0X6oA90AX6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AH6ADfQAfoAN9AB+gA30AHeAZe6Rdu+vI9fwH5tB0z5U9HcwAAAABJRU5ErkJggg==";

export async function exportarProgramaPDF(partes: any[], tituloDia: string) {
    const doc = new jsPDF();
    const ordenDias = ['Viernes', 'Sábado', 'Domingo'];
    let esPrimeraPagina = true;

    for (const dia of ordenDias) {
        const partesDelDia = partes.filter(p => p.dia === dia);
        if (partesDelDia.length === 0) continue;

        if (!esPrimeraPagina) {
            doc.addPage();
        }

        // --- ENCABEZADO Y TÍTULOS ---
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.setFont("helvetica", "bold");
        doc.text("Programa de Asamblea", 14, 15);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text(`Generado el: ${new Date().toLocaleDateString()} - ${tituloDia}`, 14, 22);

        // --- FRANJA AZUL DEL DÍA ---
        doc.setFillColor(59, 130, 246); 
        doc.rect(0, 30, 210, 10, 'F'); // Un poco más delgada para ganar espacio
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(dia.toUpperCase(), 105, 36.5, { align: 'center' });

        // --- TABLA DE DATOS ---
        // Abreviamos algunos títulos para que quepan mejor
        const columnas = ["Hora", "Tema", "Orador", "Bosq.", "Recib.", "Pres.", "Ens."];
        const filas = partesDelDia.map(p => [
            p.hora_inicio,
            p.es_video ? `(V) ${p.tema}` : p.tema,
            p.nombre_orador || "---",
            p.numero_bosquejo || "",
            estado(p.estado),
            check(p.esta_presente),
            check(p.ensayo_terminado)
        ]);

        autoTable(doc, {
    startY: 45, // Solo afecta a la primera página de cada día
    // ESTA ES LA CLAVE:
    margin: { top: 15, left: 14, right: 14, bottom: 15 }, 
    
    head: [columnas],
    body: filas,
    theme: 'grid',
    
    // Ajuste de los títulos de las columnas para que quepan
    headStyles: { 
        fillColor: [71, 85, 105], 
        fontSize: 7.5, // Bajamos un poco el tamaño para que no se corten
        halign: 'center',
        cellPadding: 1.5
    },
    
    styles: { 
        fontSize: 8, 
        cellPadding: 2,
        overflow: 'linebreak' // Permite que el texto largo salte de línea en lugar de cortarse
    },
    
    columnStyles: {
        0: { cellWidth: 15 }, // Hora
        1: { cellWidth: 'auto' }, // Tema (se expande)
        2: { cellWidth: 35 }, // Orador
        3: { cellWidth: 12 }, // Bosq.
        4: { cellWidth: 12 }, // Recib.
        5: { cellWidth: 12 }, // Pres.
        6: { cellWidth: 12 }, // Ens.
    },

    // Esto se ejecuta en cada página nueva
    didDrawPage: function (data) {
        // Si quieres que el logo o el título se repitan en cada hoja, 
        // deberías poner el código del encabezado aquí también.
        // Si lo dejas vacío, la tabla empezará en el margen top: 15 definido arriba.
    }
});

        esPrimeraPagina = false;
    }

    // --- GUARDADO ---
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBytes = new Uint8Array(pdfArrayBuffer);
    const defaultPath = `Programa_${tituloDia.replace(/ /g, '_')}.pdf`;

    const selectedPath = await save({
        defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (selectedPath) {
        await writeFile(selectedPath, pdfBytes);
        alert(`✅ PDF guardado exitosamente.`);
    }
}