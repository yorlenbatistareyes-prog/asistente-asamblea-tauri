import { invoke } from '@tauri-apps/api/core';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

export async function generarCartaPDF(datos: any, idPlantilla: string) {
    try {
        // 1. OBTENER PLANTILLA
        const plantillaData: any = await invoke('obtener_plantilla', { id: idPlantilla });
        let htmlContent = plantillaData?.cuerpo || plantillaData?.contenido;

        if (!htmlContent) {
            alert("Error: Plantilla vacía.");
            return;
        }

        // 2. REEMPLAZO DE MARCADORES (Se mantiene igual)
        const mapaReemplazo: Record<string, string> = {
            '[[Nombre]]': datos.nombre || 'Hermano',
            '[[Tema]]': datos.tema || '',
            '[[Fecha]]': datos.fecha_asignacion || '---',
            '[[Hora]]': datos.hora_asignacion || '---',
            '[[Lugar]]': datos.lugar || 'Salón de Asambleas',
            '[[Saludo según sexo]]': datos.saludo || 'Hermano'
        };

        for (const [marcador, valor] of Object.entries(mapaReemplazo)) {
            const regex = new RegExp(marcador.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
            htmlContent = htmlContent.replace(regex, valor); 
        }

        // 3. CREAR CONTENEDOR TEMPORAL (Punto crítico)
        const container = document.createElement('div');
        container.id = "temp-pdf-container";
        
        // Estilos para que jsPDF lo vea pero el usuario no
        Object.assign(container.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '180mm', // Ancho fijo para evitar que se comprima
            padding: '20mm',
            backgroundColor: 'white',
            color: 'black',
            zIndex: '-9999',
            opacity: '1',      // ¡Debe ser 1! Si es 0, sale en blanco
            visibility: 'visible'
        });

        container.innerHTML = htmlContent;
        document.body.appendChild(container);

        // --- ESPERA DE RENDERIZADO ---
        // Damos tiempo a que el navegador "dibuje" el HTML internamente
        await new Promise(resolve => setTimeout(resolve, 250));

        // 4. GENERAR DOCUMENTO
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        await doc.html(container, {
            x: 0,
            y: 0,
            width: 210, // Ancho total de la página A4
            windowWidth: 800, // Escala virtual para que no salga pequeño
            callback: async function (doc) {
                // Limpiar el DOM
                document.body.removeChild(container);

                const pdfArrayBuffer = doc.output('arraybuffer');
                const binaryData = new Uint8Array(pdfArrayBuffer);
                
                const filePath = await save({
                    defaultPath: `Carta_${datos.nombre || 'Asignacion'}.pdf`,
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                });

                if (filePath) {
                    await writeFile(filePath, binaryData);
                    alert("✅ PDF guardado con éxito.");
                }
            }
        });

    } catch (error) {
        console.error("Error:", error);
        alert("Error al generar: " + error);
    }
}