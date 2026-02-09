import { invoke } from '@tauri-apps/api/core';
import { jsPDF } from 'jspdf';
// Importamos las herramientas nativas de Tauri para guardar archivos
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

export async function generarCartaPDF(datos: any, idPlantilla: string) {
    console.log("🚀 Iniciando proceso de impresión...", { datos, idPlantilla });

    try {
        if (!idPlantilla) {
            alert("Error: ID de plantilla no especificado.");
            return;
        }

        // 1. OBTENER PLANTILLA
        console.log("1. Buscando plantilla en DB...");
        const plantillaData: any = await invoke('obtener_plantilla', { id: idPlantilla });
        
        if (!plantillaData || (!plantillaData.cuerpo && !plantillaData.contenido)) {
            console.error("❌ Plantilla no encontrada:", plantillaData);
            alert(`Error: No existe la plantilla "${idPlantilla}" en la sección Correspondencia. Por favor, ve y guárdala.`);
            return;
        }
        
        let htmlContent = plantillaData.cuerpo || plantillaData.contenido;
        console.log("✅ Plantilla cargada.");

        // 2. REEMPLAZAR DATOS
        const mapaReemplazo: Record<string, string> = {
            '[[Nombre]]': datos.nombre || 'Hermano',
            '[[Apellidos]]': datos.apellidos || '', 
            '[[Tema]]': datos.tema || '',
            '[[Bosquejo]]': datos.numero_bosquejo || '',
            '[[Fecha]]': datos.fecha_asignacion || '---',
            '[[Hora]]': datos.hora_asignacion || '---',
            '[[Congregación]]': datos.congregacion || '',
            '[[Lugar]]': datos.lugar || '',
            '[[Dirección]]': datos.direccion || '',
            '[[FechaEnsayo]]': datos.fecha_ensayo || '---',
            '[[HoraEnsayo]]': datos.hora_ensayo || '---'
        };

        for (const [marcador, valor] of Object.entries(mapaReemplazo)) {
            const valStr = valor ? String(valor) : "";
            // Reemplazo global escapando corchetes
            const regex = new RegExp(marcador.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
            htmlContent = htmlContent.replace(regex, valStr); 
        }

        // 3. PREPARAR CONTENEDOR OCULTO
        // Creamos el div visible pero detrás de todo (z-index negativo)
        const container = document.createElement('div');
        container.innerHTML = htmlContent;
        
        Object.assign(container.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '210mm',     // Ancho A4 exacto
            minHeight: '297mm', // Alto A4
            padding: '20mm',
            fontSize: '12pt',
            fontFamily: 'Arial, Helvetica, sans-serif',
            lineHeight: '1.5',
            backgroundColor: 'white',
            zIndex: '-1000',    // Detrás de todo
            color: 'black'
        });
        
        // Estilos internos básicos para asegurar formato
        const style = document.createElement('style');
        style.innerHTML = `
            p { margin-bottom: 14px; }
            ul, ol { margin-left: 24px; margin-bottom: 14px; }
            li { margin-bottom: 5px; }
            strong, b { font-weight: bold; }
            em, i { font-style: italic; }
            h1 { font-size: 18pt; margin-bottom: 20px; }
            h2 { font-size: 16pt; margin-bottom: 15px; }
        `;
        container.appendChild(style);
        document.body.appendChild(container);

        console.log("3. Generando PDF en memoria...");

        // 4. GENERAR PDF Y GUARDAR
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            putOnlyUsedFonts: true
        });

        // Envolvemos en promesa para esperar a que html2canvas termine
        await new Promise<void>((resolve, reject) => {
            doc.html(container, {
                callback: async function (doc) {
                    try {
                        // Limpiamos el DOM
                        document.body.removeChild(container);
                        
                        // --- LÓGICA DE GUARDADO NATIVO TAURI ---
                        
                        // A. Convertir PDF a binario
                        const pdfArrayBuffer = doc.output('arraybuffer');
                        const binaryData = new Uint8Array(pdfArrayBuffer);

                        // B. Calcular nombre de archivo
                        const nombreLimpio = (datos.nombre || 'Carta').replace(/[^a-zA-Z0-9]/g, '_');
                        const nombreArchivo = `Carta_${nombreLimpio}.pdf`;

                        console.log("4. Abriendo diálogo de guardar...");

                        // C. Abrir ventana "Guardar como..."
                        const filePath = await save({
                            defaultPath: nombreArchivo,
                            filters: [{
                                name: 'Documento PDF',
                                extensions: ['pdf']
                            }]
                        });

                        // D. Escribir el archivo si el usuario eligió una ruta
                        if (filePath) {
                            await writeFile(filePath, binaryData);
                            console.log("✅ Archivo guardado en:", filePath);
                            alert("Carta guardada exitosamente.");
                        } else {
                            console.log("⚠️ Guardado cancelado por el usuario.");
                        }
                        
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                },
                x: 0,
                y: 0,
                width: 210, // Ancho en mm
                windowWidth: 800, // Ancho en px simulado
                autoPaging: 'text'
            });
        });

    } catch (error) {
        console.error("❌ CRASH en generarCartaPDF:", error);
        alert("Hubo un error al generar el PDF: " + error);
    }
}