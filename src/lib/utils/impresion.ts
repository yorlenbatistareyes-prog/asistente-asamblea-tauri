import { invoke } from '@tauri-apps/api/core';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// Importamos la interfaz del archivo vecino
import type { ContextoDocumento } from './contexto_impresion';

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
    colorTextoPie: '#666666'
};

// Recibe 'datos' con tipo ContextoDocumento
export async function generarCartaPDF(datos: ContextoDocumento, idPlantilla: string) {
    try {
        // 1. CARGAR CONFIGURACIÓN
        let configMembrete = DEFAULT_MEMBRETE;
        const configGuardada = localStorage.getItem('config_membrete');
        if (configGuardada) configMembrete = { ...DEFAULT_MEMBRETE, ...JSON.parse(configGuardada) };

        // 2. OBTENER PLANTILLA
        const plantillaData: any = await invoke('obtener_plantilla', { id: idPlantilla });
        let htmlContent = plantillaData?.cuerpo || plantillaData?.contenido;

        if (!htmlContent) {
            alert("Error: Plantilla vacía.");
            return;
        }

        // 3. MAPA DE REEMPLAZO MAESTRO
        const mapaReemplazo: Record<string, string> = {
            // RÁPIDA
            '[[Saludo según sexo]]': datos.saludo,
            '[[Designación del Circuito]]': datos.circuito,

            // FECHAS
            '[[Fecha Actual Completa]]': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
            '[[Fecha Actual Mediana]]': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),

            // ASIGNACIÓN
            '[[Hora]]': datos.hora,
            '[[Tema]]': datos.tema_asignacion,
            '[[Número de Bosquejo]]': datos.num_bosquejo,
            '[[Tipo de asignación]]': datos.tipo_asignacion,
            '[[Enlace(s) del Bosquejo]]': '', 
            '[[Notas]]': datos.nota_asignacion,

            // ORADOR
            '[[Nombre]]': datos.nombre_pila,
            '[[Segundo nombre]]': datos.segundo_nombre,
            '[[Apellidos]]': datos.apellidos,
            '[[Nombre Completo]]': datos.nombre_completo,

            // LUGAR
            '[[Nombre del lugar]]': datos.lugar_nombre,
            '[[Dirección]]': datos.lugar_direccion,
            '[[Ciudad]]': datos.ciudad,
            '[[Estado o Provincia]]': datos.estado,

            // EVENTO
            '[[Fecha]]': datos.fecha_evento_texto,
            '[[Tipo de Evento]]': datos.tipo_evento,
            '[[Tema del Evento]]': datos.tema_evento,

            // ENSAYOS
            '[[Información completa de los ensayos]]': generarInfoEnsayos(datos),
            '[[Lugar de los ensayos]]': construirLugarEnsayo(datos), 
            '[[Fecha y hora del ensayo]]': `${datos.ensayo_fecha} a las ${datos.ensayo_hora}`,
            '[[Fecha de ensayos]]': datos.ensayo_fecha,
            '[[Hora de ensayos]]': datos.ensayo_hora,
            '[[Notas para los ensayos]]': datos.ensayo_notas,

            // INSTRUCCIONES
            '[[Información de orientaciones]]': datos.orientaciones || 'No hay orientaciones específicas.',
            '[[Instrucciones Especiales]]': datos.instrucciones || 'Ninguna.',
            
            // PRESIDENTE
            '[[correo electrónico jwpub del Presidente de la asamblea]]': datos.email_presidente,
            '[[Teléfono del Presidente de la asamblea]]': datos.tel_presidente
        };

        // 4. REEMPLAZO
        for (const [marcador, valor] of Object.entries(mapaReemplazo)) {
            const regex = new RegExp(marcador.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
            htmlContent = htmlContent.replace(regex, String(valor || '')); 
        }

        // LIMPIEZA VISUAL
        htmlContent = htmlContent.replace(/^\s*(<p>\s*<br\s*\/?>\s*<\/p>\s*)+/i, '');

        // 5. CÁLCULO DE POSICIÓN
        const docCalc = new jsPDF({ unit: 'mm', format: 'a4' });
        let inicioTextoY = 15; 

        if (configMembrete.usarEncabezado) {
            const lineas = docCalc.splitTextToSize(configMembrete.contacto, 180);
            const alturaContacto = lineas.length * 3;
            // Cálculo exacto: Línea base + altura contacto + 6mm espacio
            inicioTextoY = 21 + alturaContacto + 6; 
        }

        // 6. CONTENEDOR HTML
        const container = document.createElement('div');
        const estilosReset = `
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; padding: 0; }
                p { margin: 0 0 8px 0; line-height: 1.25; }
                p:first-child, div:first-child { margin-top: 0 !important; padding-top: 0 !important; }
            </style>
        `;
        
        container.innerHTML = `${estilosReset}<div class="pdf-content">${htmlContent}</div>`;
        
        // ANCHO: A4 (210) - 12 - 12 = 186mm
        Object.assign(container.style, {
            position: 'absolute', top: '0', left: '0',
            width: '186mm', 
            padding: '0', margin: '0',
            backgroundColor: 'white', color: 'black', zIndex: '-9999',
            fontFamily: '"Times New Roman", Times, serif', 
            fontSize: '11pt', lineHeight: '1.2', textAlign: 'justify'
        });

        document.body.appendChild(container);
        await new Promise(resolve => setTimeout(resolve, 300));

        // 7. GENERAR PDF
        const margenSide = 12; // 1.2cm
        const margenBottom = configMembrete.usarPiePagina ? 20 : 15;
        const margenTopPaging = configMembrete.usarEncabezado ? 28 : 15;

        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        const dibujarMembrete = (pdf: jsPDF) => {
            const w = pdf.internal.pageSize.getWidth();
            const h = pdf.internal.pageSize.getHeight();
            const cx = w / 2;

            if (configMembrete.usarEncabezado) {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(12);
                pdf.setTextColor(configMembrete.colorTexto);
                pdf.text(configMembrete.titulo.toUpperCase(), cx, 14, { align: 'center' });

                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(8);
                pdf.setTextColor(configMembrete.colorTexto);
                const lineas = pdf.splitTextToSize(configMembrete.contacto, 180);
                pdf.text(lineas, cx, 19, { align: 'center' });

                pdf.setDrawColor(configMembrete.colorLinea);
                pdf.setLineWidth(0.5);
                const lY = 21 + (lineas.length * 3);
                pdf.line(margenSide, lY, w - margenSide, lY);
            }

            if (configMembrete.usarPiePagina) {
                const fY = h - 15;
                pdf.setDrawColor(configMembrete.colorLineaPie);
                pdf.setLineWidth(0.2);
                pdf.line(margenSide, fY, w - margenSide, fY);
                pdf.setFontSize(7);
                pdf.setTextColor(configMembrete.colorTextoPie);
                pdf.text(configMembrete.piePagina, cx, fY + 5, { align: 'center' });
            }
        };

        await doc.html(container, {
            callback: async function (pdf) {
                const totalPages = pdf.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    pdf.setPage(i);
                    dibujarMembrete(pdf);
                }
                document.body.removeChild(container);
                
                const pdfData = pdf.output('arraybuffer');
                const binary = new Uint8Array(pdfData);
                const safeName = (datos.nombre_completo || 'Documento').replace(/[^a-z0-9]/gi, '_');
                
                try {
                    const path = await save({
                        defaultPath: `Carta_${safeName}.pdf`,
                        filters: [{ name: 'PDF', extensions: ['pdf'] }]
                    });
                    if (path) {
                        await writeFile(path, binary);
                        alert("✅ Carta generada correctamente.");
                    }
                } catch (e) { console.log("Cancelado", e); }
            },
            x: margenSide,
            y: inicioTextoY, 
            width: 186,
            windowWidth: 800,
            margin: [margenTopPaging, margenSide, margenBottom, margenSide], 
            autoPaging: 'text'
        });

    } catch (error) {
        console.error("Error PDF:", error);
        alert("Error al generar PDF: " + error);
    }
}

// Helpers que usan la interfaz tipada
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