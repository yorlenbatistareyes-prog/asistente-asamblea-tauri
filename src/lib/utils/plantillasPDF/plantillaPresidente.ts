import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import type { ConfiguracionPDF } from '../../stores/pdfConfigStore';

// Función auxiliar para extraer la base de una serie (copiada del programa principal)
function extraerBaseSerie(tema: string): string | null {
    if (!tema) return null;
    const patron = /\s*\([Pp]arte\s*\d+\)|\s*\(\s*\d+\s*\)|\s*\([IVXLCDM]+\)|\s*\([Ss]erie\s+de\s+discursos\)/;
    const base = tema.split(patron)[0]?.trim();
    if (base && base.length > 10 && base !== tema) return base;
    return null;
}

// Función para obtener el color hexadecimal a partir del nombre
function getColorHex(colorName: string): string {
    const mapa: Record<string, string> = {
        'naranja': '#f97316',
        'azul': '#3b82f6',
        'verde': '#10b981',
        'morado': '#8b5cf6',
        'rojo': '#ef4444',
        'gris': '#64748b'
    };
    return mapa[colorName] || '';
}

export function generarPlantillaPresidenteDia(
    partesDia: any[], 
    asamblea: any,
    config: ConfiguracionPDF,
    dia: string,
    coloresSeries?: Map<string, string>
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

    // --- FUNCIONES DE FORMATO (HORARIO 12H) ---
    const formatearHora = (hora: string) => {
        if (!hora) return '--:--';
        const [h, m] = hora.split(':');
        const horaNum = parseInt(h, 10);
        const hora12 = horaNum % 12 || 12;
        if (config.mostrarAMPM) {
            const ampm = horaNum >= 12 ? 'PM' : 'AM';
            return `${hora12}:${m} ${ampm}`;
        }
        return `${hora12}:${m}`;
    };

    const formatearNumero = (num: string | number) => {
        if (!num) return '';
        return String(num).replace(/[^0-9]/g, '').padStart(2, '0');
    };

    // --- COLORES DEL DÍA ---
    const diaLower = dia.toLowerCase();
    const diaClave = (diaLower === 'sábado' ? 'sabado' : diaLower) as 'viernes' | 'sabado' | 'domingo';
    const colorDelDia = config.coloresPorDia[diaClave] || '#2a9d8f';

    // --- FUNCIÓN DE AGRUPACIÓN (similar a la del programa principal) ---
    interface GrupoPDF {
        tipo: 'normal' | 'serie';
        cabecera?: any;
        partes: any[];
    }

    function agruparPartesDia(partes: any[], coloresMap: Map<string, string>): GrupoPDF[] {
        const grupos: GrupoPDF[] = [];
        let i = 0;
        const total = partes.length;
        while (i < total) {
            const parte = partes[i];
            // Series manuales
            if (parte.tipo === 'Serie') {
                let grupoManual: GrupoPDF = { tipo: 'serie', cabecera: parte, partes: [] };
                let j = i + 1;
                while (j < total && partes[j].tipo === 'Discurso' && partes[j].dia === parte.dia && partes[j].sesion === parte.sesion) {
                    grupoManual.partes.push(partes[j]);
                    j++;
                }
                grupos.push(grupoManual);
                i = j;
                continue;
            }
            // Detección automática
            if (parte.tipo === 'Discurso' && !parte.es_video) {
                const baseActual = extraerBaseSerie(parte.tema);
                if (baseActual) {
                    let j = i + 1;
                    while (j < total && partes[j].tipo === 'Discurso' && extraerBaseSerie(partes[j].tema) === baseActual) {
                        j++;
                    }
                    if (j - i >= 2) {
                        const discursosSerie = partes.slice(i, j);
                        const claveSerie = `${parte.dia}|${parte.sesion}|${baseActual}`;
                        const cabeceraVirtual = {
                            ...parte,
                            tema: baseActual,
                            hora_inicio: parte.hora_inicio,
                            color_destacado: coloresMap.get(claveSerie) || ''
                        };
                        grupos.push({ tipo: 'serie', cabecera: cabeceraVirtual, partes: discursosSerie });
                        i = j;
                        continue;
                    }
                }
            }
            grupos.push({ tipo: 'normal', partes: [parte] });
            i++;
        }
        return grupos;
    }

    // --- ENCABEZADO DEGRADADO E IMAGEN (sin cambios) ---
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

    if (config.ajustesTablero?.imagenEncabezado) {
        contenidoDoc.push({
            absolutePosition: { 
                x: config.ajustesTablero.desplazamientoX || 0, 
                y: config.ajustesTablero.desplazamientoY || 0 
            },
            table: {
                widths: [anchoPuntos],
                body: [
                    [
                        {
                            image: config.ajustesTablero.imagenEncabezado,
                            fit: [anchoPuntos / 2, altoEncabezado], 
                            alignment: 'right'
                        }
                    ]
                ]
            },
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

    // 3. AGRUPAR PROGRAMA POR SESIÓN
    const programaAgrupado: Record<string, any[]> = { 'MAÑANA': [], 'TARDE': [] };
    partesDia.forEach(p => {
        if (!p) return;
        const sesion = (p.sesion || 'Mañana').toUpperCase();
        if (sesion === 'MAÑANA' || sesion === 'MANANA') programaAgrupado['MAÑANA'].push(p);
        else if (sesion === 'TARDE') programaAgrupado['TARDE'].push(p);
    });

    // 4. CONSTRUCCIÓN DE TABLAS CON AGRUPACIÓN Y COLORES
    ['MAÑANA', 'TARDE'].forEach(sesion => {
        const partesSesion = programaAgrupado[sesion];
        if (partesSesion.length === 0) return;

        contenidoDoc.push({ 
            text: sesion, 
            fontSize: T_SESION, 
            bold: true, 
            color: colorDelDia, 
            margin: [0, 20, 0, 30] 
        });

        const grupos = agruparPartesDia(partesSesion, coloresSeries || new Map());
        const tableBody: TableCell[][] = [];

        for (const grupo of grupos) {
            // Título de serie (si corresponde)
            if (grupo.tipo === 'serie' && grupo.cabecera) {
                const tituloSerie = `📚 SERIE DE DISCURSOS: ${grupo.cabecera.tema}`;
                const colorHex = getColorHex(grupo.cabecera.color_destacado) || colorDelDia;
                tableBody.push([
                    { text: tituloSerie, colSpan: 5, style: 'serieTitle', color: colorHex, bold: true, margin: [0, 2, 0, 2] },
                    {}, {}, {}, {}
                ]);
            }
            // Partes individuales (dentro o fuera de serie)
            for (const p of grupo.partes) {
                const isVideo = p.es_video || (p.fuente && p.fuente.toLowerCase().includes('video'));
                const temaFinal = isVideo ? `(Video) ${p.tema || ""}` : (p.tema || "");
                const temaLower = temaFinal.toLowerCase();
                const esCancionOracion = /(^|\s)(canción|cancion|oración|oracion)(\s|$|\.|,|:|;)/i.test(temaLower);
                
                // Color del texto: prioriza color_destacado de la parte, después la regla de canción/oración
                let colorTexto = '#111827';
                if (p.color_destacado) {
                    const hex = getColorHex(p.color_destacado);
                    if (hex) colorTexto = hex;
                } else if (esCancionOracion) {
                    colorTexto = config.ajustesTablero?.colorCancionOracion || '#9b2226';
                }
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
            }
        }

        contenidoDoc.push({
            table: {
                headerRows: 0,
                widths: [150, '*', 110, 'auto', 180], // 5 columnas con los cuadros
                dontBreakRows: true,
                body: tableBody
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 60]
        });
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
        },
        styles: {
            serieTitle: { fontSize: T_TEXTO, bold: true, margin: [0, 4, 0, 4], italics: true }
        }
    };
}