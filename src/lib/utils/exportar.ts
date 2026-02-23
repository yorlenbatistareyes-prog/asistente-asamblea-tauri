import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// --- HELPERS ---
const check = (valor: boolean) => valor ? 'SÍ' : '-';
const estado = (txt: string) => txt === 'Confirmado' ? 'SÍ' : '-';

/**
 * EXPORTAR PROGRAMA
 * Versión con Encabezado y Pie de Página desde localStorage
 */
export async function exportarProgramaPDF(partes: any[], tituloDia: string) {
    if (!partes || !Array.isArray(partes)) {
        return;
    }

    // 1. OBTENER DATOS DE LA ASAMBLEA (Para el Encabezado)
    let asamblea = { tema: 'Asamblea', fecha: '', nombre: 'Asamblea Regional' };
    const guardadoAsamblea = localStorage.getItem('asambleaActiva');
    if (guardadoAsamblea) {
        asamblea = { ...asamblea, ...JSON.parse(guardadoAsamblea) };
    }

    // 2. OBTENER PIE DE PÁGINA (Desde la Configuración del Membrete en LocalStorage)
    let pieDePagina = "";
    const guardadoMembrete = localStorage.getItem('config_membrete');
    if (guardadoMembrete) {
        try {
            const configMembrete = JSON.parse(guardadoMembrete);
            // Solo lo usamos si el interruptor "usarPiePagina" está encendido
            if (configMembrete.usarPiePagina && configMembrete.piePagina) {
                pieDePagina = configMembrete.piePagina;
            }
        } catch (e) {
            console.error("Error al leer config_membrete:", e);
        }
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

        let startY = 15; 

        // --- ENCABEZADO (SOLO EN LA PRIMERA PÁGINA) ---
        if (esPrimeraPaginaGlobal) {
            // 1. Título principal (Asamblea)
            doc.setFontSize(14);
            doc.setTextColor(40);
            doc.setFont("helvetica", "bold");
            doc.text((asamblea.nombre || "ASAMBLEA REGIONAL").toUpperCase(), 105, 15, { align: 'center' });
            
            // 2. Tema
            doc.setFontSize(12);
            doc.setTextColor(80);
            doc.text((asamblea.tema || "").toUpperCase(), 105, 21, { align: 'center' });

            // 3. Fecha
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(asamblea.fecha || "", 105, 26, { align: 'center' });

            // 4. NUEVO: Subtítulo del objetivo del documento
            doc.setFontSize(11);
            doc.setTextColor(59, 130, 246); // El mismo azul de los botones para que combine
            doc.setFont("helvetica", "bold");
            
            // Verificamos si la variable ya trae la palabra "Programa"
            let textoObjetivo = tituloDia.toUpperCase();
            if (!textoObjetivo.includes("PROGRAMA")) {
                textoObjetivo = "PROGRAMA DEL DÍA: " + textoObjetivo;
            }
            
            doc.text(textoObjetivo, 105, 34, { align: 'center' });

            // Empujamos el inicio del primer día más abajo
            startY = 44; 
        }

        esPrimeraPaginaGlobal = false;

       // --- ETIQUETA DEL DÍA (Alineada al margen izquierdo) ---
        const margenIzquierdo = 14; // El mismo margen donde empieza la tabla
        const anchoBoton = 35;      // Ancho suficiente para la palabra más larga ("DOMINGO")
        
        doc.setFillColor(59, 130, 246); // Color azul
        doc.roundedRect(margenIzquierdo, startY, anchoBoton, 7, 3.5, 3.5, 'F'); 
        
        // Texto del día centrado justo en el medio del botón
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(dia.toUpperCase(), margenIzquierdo + (anchoBoton / 2), startY + 5, { align: 'center' });
        
        // --- TABLA ---
        autoTable(doc, {
            startY: startY + 10,
            margin: { top: 15, bottom: 20 }, 
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

    // --- PIE DE PÁGINA (SOLO EN LA ÚLTIMA PÁGINA) ---
    if (pieDePagina) {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.setFont("helvetica", "italic");
        
        const textLines = doc.splitTextToSize(pieDePagina, 180);
        doc.text(textLines, 105, pageHeight - 12, { align: 'center' });
    }

    // --- PROCESO DE GUARDADO CON FS ---
    try {
        const pdfArrayBuffer = doc.output('arraybuffer');
        const pdfBytes = new Uint8Array(pdfArrayBuffer);

        const selectedPath = await save({
            defaultPath: `Programa_${tituloDia.replace(/ /g, '_')}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });

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