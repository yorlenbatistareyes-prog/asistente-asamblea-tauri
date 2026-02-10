import { invoke } from '@tauri-apps/api/core';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

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

export async function generarCartaPDF(datos: any, idPlantilla: string) {
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

        // 3. MAPA DE REEMPLAZO (Con todos los datos asegurados)
        const mapaReemplazo: Record<string, string> = {
            // --- DATOS PERSONALES ---
            '[[Saludo según sexo]]': datos.saludo || 'Estimado(a)',
            '[[Nombre]]': datos.nombre || '',
            '[[Apellidos]]': datos.apellidos || '',
            '[[Nombre Completo]]': datos.nombre_completo || '',
            '[[Designación del Circuito]]': 'HG-06',

            // --- FECHAS CARTA ---
            '[[Fecha Actual Completa]]': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
            '[[Fecha Actual Mediana]]': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),

            // --- ASIGNACIÓN ---
            '[[Hora]]': datos.hora_asignacion || '---',
            '[[Tema]]': datos.tema || '',
            '[[Número de Bosquejo]]': datos.numero_bosquejo || '',
            '[[Tipo de asignación]]': datos.tipo_asignacion || 'Discurso',
            '[[Enlace(s) del Bosquejo]]': '',
            '[[Notas]]': '',

            // --- LUGAR Y EVENTO ---
            '[[Nombre del lugar]]': datos.lugar || 'Salón de Asambleas',
            '[[Dirección]]': datos.direccion || '', // Dirección del Salón de Asambleas
            '[[Ciudad]]': datos.ciudad || '',
            '[[Estado o Provincia]]': 'Holguín',
            
            // Usamos la fecha del evento (Octubre)
            '[[Fecha]]': datos.fecha_evento_texto || '---', 
            '[[Tipo de Evento]]': 'Asamblea Regional',
            '[[Tema del Evento]]': datos.tema_evento || '',

            // --- ENSAYOS ---
            '[[Información completa de los ensayos]]': generarInfoEnsayos(datos),
            // "Lugar de los ensayos" debe mostrar el nombre del local + direccion si hay
            '[[Lugar de los ensayos]]': construirLugarEnsayo(datos), 
            '[[Fecha y hora del ensayo]]': `${datos.fecha_ensayo} a las ${datos.hora_ensayo}`,
            '[[Fecha de ensayos]]': datos.fecha_ensayo || '---',
            '[[Hora de ensayos]]': datos.hora_ensayo || '---',
            '[[Notas para los ensayos]]': datos.notas_ensayo || '',

            // --- INSTRUCCIONES ---
            '[[Información de orientaciones]]': datos.orientaciones || 'No hay orientaciones específicas.',
            '[[Instrucciones Especiales]]': datos.instrucciones || 'Ninguna.'
        };

        // 4. REEMPLAZO DE MARCADORES
        for (const [marcador, valor] of Object.entries(mapaReemplazo)) {
            const regex = new RegExp(marcador.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
            htmlContent = htmlContent.replace(regex, String(valor || '')); 
        }

        // 5. PREPARAR CONTENEDOR SIN MARGEN EXTRA
        const container = document.createElement('div');
        container.innerHTML = `<div style="margin-top:0; padding-top:0;">${htmlContent}</div>`;
        
        Object.assign(container.style, {
            position: 'absolute', top: '0', left: '0',
            width: '170mm', padding: '0', margin: '0',
            backgroundColor: 'white', color: 'black', zIndex: '-9999',
            fontFamily: '"Times New Roman", Times, serif', 
            fontSize: '11pt', lineHeight: '1.3', textAlign: 'justify'
        });

        document.body.appendChild(container);
        await new Promise(resolve => setTimeout(resolve, 300));

        // 6. MÁRGENES VISUALES
        // 22mm para subir el texto
        const margenTopStart = configMembrete.usarEncabezado ? 22 : 15;
        // 28mm para paginación (para que no tape el encabezado en pag 2)
        const margenTopPaging = configMembrete.usarEncabezado ? 28 : 15;
        const margenBottom = configMembrete.usarPiePagina ? 25 : 15;
        const margenSide = 20;

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
                const lineas = pdf.splitTextToSize(configMembrete.contacto, 160);
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

        // 7. GENERAR
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
                const safeName = (datos.nombre || 'Documento').replace(/[^a-z0-9]/gi, '_');
                
                try {
                    const path = await save({
                        defaultPath: `Carta_${safeName}.pdf`,
                        filters: [{ name: 'PDF', extensions: ['pdf'] }]
                    });
                    if (path) {
                        await writeFile(path, binary);
                        alert("✅ Carta generada correctamente.");
                    }
                } catch (e) { console.log("Guardado cancelado", e); }
            },
            x: margenSide,
            y: margenTopStart, // INICIO DEL TEXTO
            width: 170,
            windowWidth: 800,
            margin: [margenTopPaging, margenSide, margenBottom, margenSide], // MARGENES PÁGINA
            autoPaging: 'text'
        });

    } catch (error) {
        console.error("Error PDF:", error);
        alert("Error al generar PDF: " + error);
    }
}

// Genera la frase completa del ensayo
function generarInfoEnsayos(d: any): string {
    if (!d.fecha_ensayo || d.fecha_ensayo === '---') return "No se requiere ensayo.";
    
    // Aquí usamos el helper de abajo para obtener "Lugar (Dirección)"
    let lugarCompleto = construirLugarEnsayo(d);
    
    return `Su ensayo está programado para el ${d.fecha_ensayo} a las ${d.hora_ensayo || ''} en ${lugarCompleto}.`;
}

// Construye "Salón X (Calle Y)" o solo "Salón X" si no hay dirección o es la misma
function construirLugarEnsayo(d: any): string {
    let lugar = d.lugar_ensayo || 'Salón de Asambleas'; // Nombre del lugar (ej. SAN RAFAEL)
    let direccion = d.direccion || ''; // Dirección del evento (ej. Carretera Mayarí)

    // Si tenemos dirección y el nombre del lugar no la incluye ya
    if (direccion && direccion.trim() !== '' && !lugar.includes(direccion)) {
        return `${lugar} (${direccion})`;
    }
    return lugar;
}