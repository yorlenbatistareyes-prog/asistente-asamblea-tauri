import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import type { ConfiguracionPDF } from '../../stores/pdfConfigStore';

export function generarPlantillaPresidenteDia(
    partesDia: any[], 
    asamblea: any,
    config: ConfiguracionPDF,
    dia: string
): TDocumentDefinitions {

    const contenidoDoc: Content[] = [];

    // --- DIMENSIONES A ESCALA 3x (PÓSTER 24x36) ---
    const anchoPulgadas = config.ajustesTablero?.anchoPulgadas || 24;
    const altoPulgadas = config.ajustesTablero?.altoPulgadas || 36;
    const anchoPuntos = anchoPulgadas * 72;
    const altoPuntos = altoPulgadas * 72;

    // Escalas de fuente
    const T_TITULO_DIA = 120; 
    const T_TEMA = 45;
    const T_FECHA = 24;
    const T_SESION = 65;
    const T_TEXTO = 36;

    // --- LÓGICA DE FECHAS ---
    const obtenerFechaDelDia = (fechaBase: string, diaNombre: string) => {
        if (!fechaBase) return '';
        const base = new Date(fechaBase.split('T')[0] + 'T12:00:00Z');
        if (isNaN(base.getTime())) return fechaBase; 
        
        let offset = 0;
        const d = diaNombre.toLowerCase();
        if (d === 'sábado' || d === 'sabado') offset = 1;
        if (d === 'domingo') offset = 2;
        
        base.setDate(base.getDate() + offset);
        
        const day = String(base.getDate()).padStart(2, '0');
        const month = String(base.getMonth() + 1).padStart(2, '0');
        const year = base.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const fechaEspecifica = obtenerFechaDelDia(asamblea?.fecha, dia);

    // --- FUNCIONES DE FORMATO (CORREGIDO HORARIO 12H) ---
    const formatearHora = (hora: string) => {
        if (!hora) return '--:--';
        const [h, m] = hora.split(':');
        const horaNum = parseInt(h, 10);
        
        // SIEMPRE convertimos a formato 12 horas (ej. 14 -> 2, 13 -> 1)
        const hora12 = horaNum % 12 || 12;
        
        // Solo agregamos las letras AM/PM si el usuario lo marcó en la interfaz
        if (config.mostrarAMPM) {
            const ampm = horaNum >= 12 ? 'PM' : 'AM';
            return `${hora12}:${m} ${ampm}`;
        }
        
        // Si está desmarcado, devuelve solo el número limpio (ej. "1:50")
        return `${hora12}:${m}`;
    };

    const formatearNumero = (num: string | number) => {
        if (!num) return '';
        return String(num).replace(/[^0-9]/g, '').padStart(2, '0');
    };

    // --- COLORES ---
    const diaLower = dia.toLowerCase();
    const diaClave = (diaLower === 'sábado' ? 'sabado' : diaLower) as 'viernes' | 'sabado' | 'domingo';
    const colorDelDia = config.coloresPorDia[diaClave] || '#2a9d8f';

    // 1. EL ENCABEZADO "DEGRADADO"
    const altoEncabezado = 280; 
    const tercios = anchoPuntos / 3;
    const svgEncabezado = `
        <svg viewBox="0 0 ${anchoPuntos} ${altoEncabezado}" width="${anchoPuntos}" height="${altoEncabezado}" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${tercios}" height="${altoEncabezado}" fill="${colorDelDia}" />
            <rect x="${tercios}" y="0" width="${tercios}" height="${altoEncabezado}" fill="${colorDelDia}" opacity="0.85" />
            <rect x="${tercios * 2}" y="0" width="${tercios + 5}" height="${altoEncabezado}" fill="${colorDelDia}" opacity="0.7" />
        </svg>
    `;

    contenidoDoc.push({
        svg: svgEncabezado,
        absolutePosition: { x: 0, y: 0 },
        width: anchoPuntos
    });

   // 1.5. IMAGEN PERSONALIZADA (Auto-calculada a la esquina superior derecha)
    if (config.ajustesTablero?.imagenEncabezado) {
        contenidoDoc.push({
            absolutePosition: { 
                // La imagen parte de la posición 0,0 (esquina absoluta)
                // Los desplazamientos solo se aplican si el usuario quiere moverla manualmente
                x: config.ajustesTablero.desplazamientoX || 0, 
                y: config.ajustesTablero.desplazamientoY || 0 
            },
            // Usamos una tabla invisible que ocupa exactamente el 100% del ancho del póster
            table: {
                widths: [anchoPuntos],
                body: [
                    [
                        {
                            image: config.ajustesTablero.imagenEncabezado,
                            // MAGIA: 'fit' escala cualquier imagen proporcionalmente. 
                            // Límite ancho: Mitad de la hoja. Límite alto: altoEncabezado (280)
                            fit: [anchoPuntos / 2, altoEncabezado], 
                            alignment: 'right' // Empuja la imagen contra el borde derecho
                        }
                    ]
                ]
            },
            // Eliminamos todos los rellenos de la tabla para que toque los bordes 100%
            layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0
            }
        });
    }

    // 2. TEXTOS DEL ENCABEZADO
    contenidoDoc.push({
        text: dia.toUpperCase(),
        fontSize: T_TITULO_DIA,
        bold: true,
        color: '#ffffff',
        margin: [0, -10, 0, 5] 
    });

    contenidoDoc.push({
        text: asamblea?.tema ? asamblea.tema : 'ASAMBLEA',
        fontSize: T_TEMA,
        color: '#ffffff',
        margin: [0, 0, 0, 15] 
    });

    contenidoDoc.push({
        text: `Fecha: ${fechaEspecifica}  |  Número de Asamblea: ${asamblea?.identificador || '000'}`,
        fontSize: T_FECHA,
        color: '#ffffff',
        opacity: 0.9,
        margin: [0, 0, 0, 80] 
    });

    // 3. AGRUPAR PROGRAMA
    const programaAgrupado: Record<string, any[]> = { 'MAÑANA': [], 'TARDE': [] };
    partesDia.forEach(p => {
        if (!p) return;
        const sesion = (p.sesion || 'Mañana').toUpperCase();
        if (sesion === 'MAÑANA' || sesion === 'MANANA') programaAgrupado['MAÑANA'].push(p);
        else if (sesion === 'TARDE') programaAgrupado['TARDE'].push(p);
    });

    // 4. CONSTRUIR TABLAS
    ['MAÑANA', 'TARDE'].forEach(sesion => {
        if (programaAgrupado[sesion].length > 0) {
            
            contenidoDoc.push({ 
                text: sesion, 
                fontSize: T_SESION, 
                bold: true, 
                color: colorDelDia, 
                margin: [0, 20, 0, 30] 
            });

            const tableBody: TableCell[][] = [];
            
            programaAgrupado[sesion].forEach((p: any) => {
                const isVideo = p.es_video || (p.fuente && p.fuente.toLowerCase().includes('video'));
                const temaFinal = isVideo ? `(Video) ${p.tema || ""}` : (p.tema || "");
                
                const temaLower = temaFinal.toLowerCase();
                const esCancionOracion = /(^|\s)(canción|cancion|oración|oracion)(\s|$|\.|,|:|;)/i.test(temaLower);
                
                const colorTexto = esCancionOracion ? (config.ajustesTablero?.colorCancionOracion || '#9b2226') : '#111827';
                const colorNumeros = '#374151';

                const mFila: [number, number, number, number] = [0, 20, 0, 20]; 

                tableBody.push([
                    { text: formatearHora(p.hora_inicio), bold: true, fontSize: T_TEXTO, color: colorNumeros, margin: mFila },
                    { text: temaFinal, fontSize: T_TEXTO, color: colorTexto, margin: mFila },
                    { text: formatearNumero(p.numero_bosquejo), fontSize: T_TEXTO, bold: true, color: colorNumeros, alignment: 'center', margin: mFila },
                    { text: `${p.nombre_orador || p.orador || ''}`, fontSize: T_TEXTO, bold: true, color: colorTexto, margin: mFila },
                    {
                        canvas: [
                            { type: 'rect', x: 0, y: 5, w: 36, h: 36, lineWidth: 3, lineColor: '#000000' },
                            { type: 'rect', x: 55, y: 5, w: 36, h: 36, lineWidth: 3, lineColor: '#000000' },
                            { type: 'rect', x: 110, y: 5, w: 36, h: 36, lineWidth: 3, lineColor: '#000000' }
                        ],
                        margin: [0, 15, 0, 15],
                        alignment: 'right'
                    }
                ]);
            });

            contenidoDoc.push({
                table: {
                    headerRows: 0,
                    widths: [150, '*', 110, 'auto', 180], 
                    dontBreakRows: true,
                    body: tableBody
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 60]
            });
        }
    });

    // 5. CONFIGURACIÓN DEL DOCUMENTO
    return {
        pageSize: { width: anchoPuntos, height: altoPuntos },
        pageOrientation: 'portrait',
        pageMargins: [120, 80, 120, 100], 
        content: contenidoDoc,
        defaultStyle: { 
            font: 'Roboto',
            color: '#111827'
        }
    };
}