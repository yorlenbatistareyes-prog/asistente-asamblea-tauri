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

        // 2. REEMPLAZO DE MARCADORES (ACTUALIZADO COMPLETO)
        const mapaReemplazo: Record<string, string> = {
            '[[Fecha Actual Completa]]': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
            '[[Saludo según sexo]]': datos.saludo || 'Hermano',
            '[[Nombre]]': datos.nombre || '',
            '[[Apellidos]]': datos.apellidos || '',
            
            // Datos del Evento
            '[[Fecha]]': datos.fecha_asignacion || '---', 
            '[[Tipo de Evento]]': datos.tipo_evento || 'Asamblea Regional',
            '[[Tema del Evento]]': datos.tema_evento || '',
            
            // Datos del Lugar
            '[[Nombre del lugar]]': datos.lugar || '',
            '[[Dirección]]': datos.direccion || '',
            '[[Ciudad]]': datos.ciudad || '',
            '[[Estado o Provincia]]': datos.estado || '',

            // Datos de la Asignación
            '[[Número de Bosquejo]]': datos.numero_bosquejo || '---',
            '[[Tema]]': datos.tema || '', 
            '[[Hora]]': datos.hora_asignacion || '',
            '[[Tipo de asignación]]': datos.tipo_asignacion || 'Discurso',
            '[[Enlace(s) del Bosquejo]]': datos.enlace_bosquejo || '',

            // Datos de Ensayos e Instrucciones
            '[[Fecha de ensayos]]': datos.fecha_ensayo || '---',
            '[[Hora de ensayos]]': datos.hora_ensayo || '---',
            '[[Lugar de los ensayos]]': datos.lugar_ensayo || '',
            '[[Información de orientaciones]]': datos.orientaciones || '',
            '[[Instrucciones Especiales]]': datos.instrucciones || ''
        };

        for (const [marcador, valor] of Object.entries(mapaReemplazo)) {
            // Aseguramos que el valor sea una cadena y manejamos caracteres especiales de Regex
            const valStr = valor ? String(valor) : "";
            const regex = new RegExp(marcador.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
            htmlContent = htmlContent.replace(regex, valStr); 
        }

        // 3. CREAR CONTENEDOR TEMPORAL
        const container = document.createElement('div');
        container.id = "temp-pdf-container";
        
        Object.assign(container.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '180mm',
            padding: '20mm',
            backgroundColor: 'white',
            color: 'black',
            zIndex: '-9999',
            opacity: '1',
            visibility: 'visible'
        });

        container.innerHTML = htmlContent;
        document.body.appendChild(container);

        // Espera de renderizado para asegurar que las fuentes y estilos se apliquen
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
            width: 210,
            windowWidth: 800,
            callback: async function (doc) {
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