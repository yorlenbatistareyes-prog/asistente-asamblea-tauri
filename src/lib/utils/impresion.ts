import { invoke } from '@tauri-apps/api/core';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// --- DEFINICIÓN DEL MEMBRETE (Debe coincidir con MembreteConfig) ---
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
        // 1. CARGAR CONFIGURACIÓN DE MEMBRETE
        let configMembrete = DEFAULT_MEMBRETE;
        const configGuardada = localStorage.getItem('config_membrete');
        if (configGuardada) {
            configMembrete = { ...DEFAULT_MEMBRETE, ...JSON.parse(configGuardada) };
        }

        // 2. OBTENER PLANTILLA HTML
        const plantillaData: any = await invoke('obtener_plantilla', { id: idPlantilla });
        let htmlContent = plantillaData?.cuerpo || plantillaData?.contenido;

        if (!htmlContent) {
            alert("Error: Plantilla vacía o no encontrada.");
            return;
        }

        // 3. MAPA DE REEMPLAZO (Basado en tu Correspondencia.svelte)
        const mapaReemplazo: Record<string, string> = {
            // --- GRUPO: RÁPIDA ---
            '[[Saludo según sexo]]': datos.saludo || (datos.sexo === 'M' ? 'Estimado hermano' : 'Estimada hermana') || 'Estimado(a) hermano(a)',
            '[[Designación del Circuito]]': datos.designacion_circuito || 'HG-06', // Valor por defecto o dato

            // --- GRUPO: FECHAS ---
            '[[Fecha Actual Mediana]]': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
            '[[Fecha Actual Completa]]': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),

            // --- GRUPO: ASIGNACIÓN ---
            '[[Hora]]': datos.hora_asignacion || datos.hora || '---',
            '[[Duración]]': datos.duracion ? `${datos.duracion} min` : '---',
            '[[Tema]]': datos.tema || '---',
            '[[Número de Bosquejo]]': datos.numero_bosquejo || datos.bosquejo_numero || '---',
            '[[Tipo de asignación]]': datos.tipo_asignacion || 'Discurso',
            '[[Enlace(s) del Bosquejo]]': datos.enlace_bosquejo || '',
            '[[Notas]]': datos.notas || '',

            // --- GRUPO: ORADOR ---
            '[[Nombre]]': datos.nombre_pila || datos.nombre || '', // Intenta nombre de pila primero
            '[[Segundo nombre]]': datos.segundo_nombre || '',
            '[[Apellidos]]': datos.apellidos || '',
            '[[Nombre Completo]]': datos.nombre_completo || `${datos.nombre || ''} ${datos.apellidos || ''}`.trim(),

            // --- GRUPO: LUGAR ---
            '[[Nombre del lugar]]': datos.lugar || datos.nombre_lugar || 'Salón de Asambleas',
            '[[Dirección]]': datos.direccion || '',
            '[[Ciudad]]': datos.ciudad || 'Holguín',
            '[[Estado o Provincia]]': datos.estado || datos.provincia || '',

            // --- GRUPO: EVENTO ---
            '[[Fecha]]': datos.fecha_evento_texto || datos.fecha_asignacion || '---', // Fecha del evento, no la actual
            '[[Tipo de Evento]]': datos.tipo_evento || 'Asamblea Regional',
            '[[Tema del Evento]]': datos.tema_evento || datos.tema_asamblea || '',

            // --- GRUPO: ENSAYO ---
            '[[Información completa de los ensayos]]': generarInfoEnsayos(datos),
            '[[Notas para los ensayos]]': datos.notas_ensayo || '',
            '[[Lugar de los ensayos]]': datos.lugar_ensayo || datos.lugar || '',
            '[[Fecha y hora del ensayo]]': `${datos.fecha_ensayo || '--'} a las ${datos.hora_ensayo || '--'}`,
            '[[Fecha de ensayos]]': datos.fecha_ensayo || '---',
            '[[Hora de ensayos]]': datos.hora_ensayo || '---',

            // --- GRUPO: PRESIDENTE ---
            '[[correo electrónico jwpub del Presidente de la asamblea]]': datos.email_presidente || '',
            '[[Teléfono del Presidente de la asamblea]]': datos.telefono_presidente || '',

            // --- GRUPO: INSTRUCCIONES ---
            // Aquí usamos || para buscar en varias propiedades posibles
            '[[Información de orientaciones]]': datos.orientaciones || datos.orientaciones_plataforma || 'Ninguna especificada.',
            '[[Instrucciones Especiales]]': datos.instrucciones || datos.instrucciones_especiales || 'Ninguna especificada.'
        };

        // 4. EJECUTAR REEMPLAZO
        for (const [marcador, valor] of Object.entries(mapaReemplazo)) {
            // Escapar corchetes para Regex
            const regex = new RegExp(marcador.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
            htmlContent = htmlContent.replace(regex, String(valor || '')); 
        }

        // 5. PREPARAR CONTENEDOR TEMPORAL
        const container = document.createElement('div');
        container.id = "temp-pdf-container";
        
        // Estilos para simular la hoja A4
        Object.assign(container.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '170mm', // 210mm - 40mm márgenes laterales
            padding: '0',   // El padding lo maneja jsPDF con 'margin'
            backgroundColor: 'white',
            color: 'black',
            zIndex: '-9999',
            fontFamily: '"Times New Roman", Times, serif', // Fuente formal por defecto
            fontSize: '11pt',
            lineHeight: '1.4',
            textAlign: 'justify'
        });

        container.innerHTML = htmlContent;
        document.body.appendChild(container);

        // Espera para cargar estilos
        await new Promise(resolve => setTimeout(resolve, 300));

        // 6. CONFIGURAR MÁRGENES PDF
        // Si hay encabezado, dejamos más espacio arriba (35mm), si no, estándar (15mm)
        const margenTop = configMembrete.usarEncabezado ? 35 : 15;
        const margenBottom = configMembrete.usarPiePagina ? 25 : 15;
        const margenSide = 20;

        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        // --- FUNCIÓN DIBUJAR MEMBRETE ---
        const dibujarMembrete = (pdf: jsPDF) => {
            const width = pdf.internal.pageSize.getWidth();
            const height = pdf.internal.pageSize.getHeight();
            const centerX = width / 2;

            // DIBUJAR ENCABEZADO
            if (configMembrete.usarEncabezado) {
                // Título (Negrita, Color Configurado)
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(12);
                pdf.setTextColor(configMembrete.colorTexto);
                pdf.text(configMembrete.titulo.toUpperCase(), centerX, 14, { align: 'center' });

                // Contacto (Normal, Color Configurado)
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(8);
                pdf.setTextColor(configMembrete.colorTexto);
                
                const lineasContacto = pdf.splitTextToSize(configMembrete.contacto, 160);
                pdf.text(lineasContacto, centerX, 19, { align: 'center' });

                // Línea Divisoria
                pdf.setDrawColor(configMembrete.colorLinea);
                pdf.setLineWidth(0.5);
                const lineaY = 21 + (lineasContacto.length * 3);
                pdf.line(margenSide, lineaY, width - margenSide, lineaY);
            }

            // DIBUJAR PIE DE PÁGINA
            if (configMembrete.usarPiePagina) {
                const footerY = height - 15;

                // Línea Pie
                pdf.setDrawColor(configMembrete.colorLineaPie);
                pdf.setLineWidth(0.2);
                pdf.line(margenSide, footerY, width - margenSide, footerY);

                // Texto Pie
                pdf.setFontSize(7);
                pdf.setTextColor(configMembrete.colorTextoPie);
                pdf.text(configMembrete.piePagina, centerX, footerY + 5, { align: 'center' });
            }
        };

        // 7. GENERAR PDF
        await doc.html(container, {
            callback: async function (pdf) {
                // Dibujar membrete en todas las páginas generadas
                const totalPages = pdf.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    pdf.setPage(i);
                    dibujarMembrete(pdf);
                }

                document.body.removeChild(container);

                // Guardar Archivo
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
                        alert("✅ Carta exportada correctamente.");
                    }
                } catch (e) { console.log("Guardado cancelado", e); }
            },
            x: margenSide,
            y: margenTop - 5, // Ajuste fino para pegar texto al encabezado
            width: 170, // Ancho de contenido
            windowWidth: 800,
            // MARGENES AUTOMATICOS (Esto evita el solapamiento en pag 2)
            margin: [margenTop, margenSide, margenBottom, margenSide],
            autoPaging: 'text'
        });

    } catch (error) {
        console.error("Error PDF:", error);
        alert("Error al generar PDF: " + error);
    }
}

// Helper para generar texto compuesto de ensayos
function generarInfoEnsayos(d: any): string {
    if (!d.fecha_ensayo && !d.hora_ensayo) return "No se requiere ensayo.";
    return `Su ensayo está programado para el ${d.fecha_ensayo || ''} a las ${d.hora_ensayo || ''} en ${d.lugar_ensayo || 'la plataforma principal'}.`;
}