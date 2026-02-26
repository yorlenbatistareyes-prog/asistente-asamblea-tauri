import { invoke } from '@tauri-apps/api/core';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { ContextoDocumento } from './contexto_impresion';

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

export async function generarCartaPDF(datos: ContextoDocumento, idPlantilla: string) {
    try {
        // 1. CARGAR CONFIGURACIÓN
        let configMembrete = DEFAULT_MEMBRETE;
        const configGuardada = localStorage.getItem('config_membrete');
        if (configGuardada) {
            configMembrete = { ...DEFAULT_MEMBRETE, ...JSON.parse(configGuardada) };
        }

        const sizeTitulo = configMembrete.tamanoTitulo || 24;
        const sizeContacto = configMembrete.tamanoContacto || 10;
        const sizePie = configMembrete.tamanoPiePagina || 8;

        // 2. OBTENER PLANTILLA (DIAGNÓSTICO)
        console.log(`🔍 Buscando plantilla ID: "${idPlantilla}"`);
        const plantillaData: any = await invoke('obtener_plantilla', { id: idPlantilla });
        
        if (!plantillaData) {
            alert(`⛔ ERROR: No se encontró la plantilla con ID "${idPlantilla}" en la base de datos.`);
            return;
        }

        // --- EXTRACCIÓN ROBUSTA DE CONTENIDO ---
        // Buscamos en todas las variantes posibles por si la BD cambió el nombre del campo
        let htmlContent = 
            plantillaData.cuerpo || 
            plantillaData.contenido || 
            plantillaData.body || 
            plantillaData.html || 
            plantillaData.text || 
            '';

        // Si sigue vacío, mostramos alerta de depuración para que veas qué llegó
        if (!htmlContent || htmlContent.trim() === '') {
            console.error("Objeto recibido:", plantillaData);
            alert(`⚠️ LA PLANTILLA ESTÁ VACÍA.\n\nEl sistema encontró la plantilla "${idPlantilla}", pero no tiene texto.\nDatos recibidos de la BD:\n${JSON.stringify(plantillaData)}`);
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
            '[[Estado o Provincia]]': 'Holguín',
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

        // LIMPIEZA HTML
        // Quitar estilos inline de <p> que confunden a jsPDF
        htmlContent = htmlContent.replace(/<p[^>]*style="[^"]*"[^>]*>/gi, '<p>');
        // Quitar estilos inline de <span> pero conservar el contenido
        htmlContent = htmlContent.replace(/<span[^>]*style="[^"]*"[^>]*>/gi, '<span>');
        // Reemplazar &nbsp; por espacio normal
        htmlContent = htmlContent.replace(/&nbsp;/gi, ' ');
        // Eliminar párrafos vacíos al inicio
        htmlContent = htmlContent.replace(/^\s*(<p>\s*<br\s*\/?>\s*<\/p>\s*)+/gi, '');
        htmlContent = htmlContent.replace(/^\s*(<br\s*\/?>\s*)+/gi, '');
        htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, '');
        htmlContent = htmlContent.replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<br>');
        // Eliminar espacios múltiples consecutivos
        htmlContent = htmlContent.replace(/ {2,}/g, ' ');

        // 4. CÁLCULO DE POSICIONES
        const docCalc = new jsPDF({ unit: 'mm', format: 'a4' });
        let inicioTextoY = 15; 

        if (configMembrete.usarEncabezado) {
            const alturaTituloMm = sizeTitulo * 0.352;
            docCalc.setFontSize(sizeContacto);
            const lineas = docCalc.splitTextToSize(configMembrete.contacto, 180);
            
            // Factor ajustado
            const alturaPorLinea = sizeContacto * 0.352; 
            const alturaBloqueContacto = lineas.length * alturaPorLinea;

            const lineaNegraY = 14 + alturaTituloMm + alturaBloqueContacto + 2;
            
            // TU AJUSTE MANUAL (-10mm)
            inicioTextoY = lineaNegraY - 10;
        }

        const container = document.createElement('div');

// CSS RESET (se mantiene igual)
const estilosReset = `
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        p { 
            margin: 0 0 3mm 0; 
            line-height: 1.5; 
            text-align: left; 
            word-wrap: break-word; 
            white-space: pre-wrap; 
        }
        .pdf-content > *:first-child { 
            margin-top: 0 !important; 
            padding-top: 0 !important; 
        }
    </style>
`;

container.innerHTML = `${estilosReset}<div class="pdf-content">${htmlContent}</div>`;

// ESTILOS DEL CONTENEDOR (cambios aquí)
Object.assign(container.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '1000px',                     // <-- aumentado de 800 a 1000
    padding: '0',
    margin: '0',
    backgroundColor: 'white',
    color: 'black',
    zIndex: '-9999',
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: '11pt',
    lineHeight: '1.25',
    overflowWrap: 'break-word',          // <-- añadido
    wordWrap: 'break-word'                // <-- añadido (compatibilidad)
});

        document.body.appendChild(container);
        await new Promise(resolve => setTimeout(resolve, 300));

        // MÁRGENES
        const margenSide = 8; 
        const margenBottom = configMembrete.usarPiePagina ? 20 : 15;
        // TU AJUSTE MANUAL (15mm)
        const margenTopSegundasPaginas = 15; 

        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        // --- FUNCIONES DE DIBUJO ---
        const dibujarEncabezadoP1 = (pdf: jsPDF) => {
            if (!configMembrete.usarEncabezado) return;
            const w = pdf.internal.pageSize.getWidth();
            const cx = w / 2;

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(sizeTitulo);
            pdf.setTextColor(configMembrete.colorTexto);
            pdf.text(configMembrete.titulo.toUpperCase(), cx, 14, { align: 'center' });

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(sizeContacto);
            pdf.setTextColor(configMembrete.colorTexto);

            const lineas = pdf.splitTextToSize(configMembrete.contacto, 180);
            const alturaPorLinea = sizeContacto * 0.352;
            let cursorY = 14 + (sizeTitulo * 0.352) + 1;

            lineas.forEach((line: string) => {
                pdf.text(line, cx, cursorY, { align: 'center' });
                cursorY += alturaPorLinea;
            });

            pdf.setDrawColor(configMembrete.colorLinea);
            pdf.setLineWidth(0.5);
            const lineaY = cursorY + 1;
            pdf.line(margenSide, lineaY, w - margenSide, lineaY);
        };

        const dibujarPieUltimaPagina = (pdf: jsPDF) => {
            if (!configMembrete.usarPiePagina) return;
            const w = pdf.internal.pageSize.getWidth();
            const h = pdf.internal.pageSize.getHeight();
            const cx = w / 2;

            const fY = h - 15;
            pdf.setDrawColor(configMembrete.colorLineaPie);
            pdf.setLineWidth(0.2);
            pdf.line(margenSide, fY, w - margenSide, fY);
            
            pdf.setFontSize(sizePie); 
            pdf.setTextColor(configMembrete.colorTextoPie);
            pdf.text(configMembrete.piePagina, cx, fY + 5, { align: 'center' });
        };

        // --- GENERACIÓN PDF ---
        await doc.html(container, {
            callback: async function (pdf) {
                const totalPages = pdf.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    pdf.setPage(i);
                    if (i === 1) dibujarEncabezadoP1(pdf);
                    if (i === totalPages) dibujarPieUltimaPagina(pdf);
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
            x: 4, 
            y: inicioTextoY, 
            width: 208, 
            windowWidth: 800,
            margin: [margenTopSegundasPaginas, margenSide, margenBottom, margenSide],
            autoPaging: 'text'
        });

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