<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { DB } from '$lib/services/db';
  
  import { MessageSquare } from 'lucide-svelte';
  import { Phone, MessageCircle, Mail, FileText, FileCheck } from 'lucide-svelte';
  import PdfIcon from '$lib/components/ui/PdfIcon.svelte';
  import { generarContexto } from '$lib/utils/contexto_impresion';
  import { prepararContenidoEmail, prepararAsuntoEmail } from '$lib/utils/contextoEmail';
  import { obtenerPlantillaPorId, cargarPlantillasEmail } from '$lib/utils/plantillasEmail';
  import { whatsAppTemplates, obtenerPlantillaWhatsAppPorId, cargarPlantillasWhatsApp } from '$lib/utils/plantillasWhatsApp';
  import { prepararContenidoWhatsApp } from '$lib/utils/contextoWhatsApp';
  
  import { openUrl } from '@tauri-apps/plugin-opener';

  // --- IMPORTACIONES PARA PDF ---
  import { save } from '@tauri-apps/plugin-dialog';
  import { writeFile } from '@tauri-apps/plugin-fs';

  // 1. PDFMAKE (Plano)
  import pdfMake from 'pdfmake/build/pdfmake';
  import pdfFonts from 'pdfmake/build/vfs_fonts';
  import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

  // 2. PDF-LIB (Rellenable)
  import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

  // --- CONFIGURACIÓN ESTRICTA DE FUENTES PARA PDFMAKE ---
  interface CustomPdfFonts { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string>; }
  interface CustomPdfMake { vfs: Record<string, string>; createPdf: typeof pdfMake.createPdf; }
  const fonts = pdfFonts as unknown as CustomPdfFonts;
  const pdf = pdfMake as unknown as CustomPdfMake;
  pdf.vfs = fonts.pdfMake ? fonts.pdfMake.vfs : (fonts.vfs || {});

  let asambleaActiva: any = null;
  let partes: any[] = [];
  let programaAgrupado: Record<string, any[]> = {};
  let cargando = true;
  let errorCarga = '';

     onMount(async () => {
    try {
      const almacenada = localStorage.getItem('asambleaActiva');

      if (!almacenada) {
        throw new Error('No existe una asamblea activa en el almacenamiento local.');
      }

      const asamblea = JSON.parse(almacenada);
      const idAsamblea = Number(
        asamblea?.id ??
        asamblea?.asamblea_id ??
        asamblea?.asambleaId ??
        asamblea?.asamblea?.id
      );

      if (!Number.isInteger(idAsamblea) || idAsamblea <= 0) {
        throw new Error(`ID de asamblea inválido: ${JSON.stringify(asamblea)}`);
      }

      asambleaActiva = asamblea?.asamblea ?? asamblea;

      try {
        const datos = await invoke('obtener_asamblea_por_id', {
          id: idAsamblea
        });

        if (datos) {
          asambleaActiva = datos;
        }
      } catch (error) {
        console.warn('No se pudo obtener la asamblea:', error);
      }

      await Promise.all([
        cargarPlantillasEmail(),
        cargarPlantillasWhatsApp()
      ]);

      await cargarTodoElPrograma(idAsamblea);
    } catch (error) {
      console.error('Error en RegistroOradores:', error);
      errorCarga = error instanceof Error
        ? error.message
        : String(error);
    } finally {
      cargando = false;
    }
  });

    function agruparPorDia(lista: any[]) {
    programaAgrupado = {
      viernes: [],
      sábado: [],
      domingo: []
    };

    for (const parte of lista) {
      const dia = String(parte.dia ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (dia === 'viernes') {
        programaAgrupado.viernes.push(parte);
      } else if (dia === 'sabado') {
        programaAgrupado.sábado.push(parte);
      } else if (dia === 'domingo') {
        programaAgrupado.domingo.push(parte);
      }
    }
  }

  async function cargarTodoElPrograma(idAsamblea: number) {
    const dias = ['Viernes', 'Sábado', 'Domingo'];
    const todasLasPartes: any[] = [];

    for (const dia of dias) {
      const resultado: any = await invoke('obtener_programa_dia', {
        asambleaId: idAsamblea,
        dia
      });

      let lista: any[] = [];

      if (Array.isArray(resultado)) {
        lista = resultado;
      } else if (Array.isArray(resultado?.data)) {
        lista = resultado.data;
      } else if (Array.isArray(resultado?.partes)) {
        lista = resultado.partes;
      } else if (Array.isArray(resultado?.programa)) {
        lista = resultado.programa;
      } else if (resultado && typeof resultado === 'object') {
        lista = Object.values(resultado).find(Array.isArray) as any[] || [];
      }

      todasLasPartes.push(
        ...lista.map(parte => ({ ...parte, dia }))
      );
    }

    partes = todasLasPartes;
    agruparPorDia(partes);
  }

  // --- MATEMÁTICA: RESTAR 30 MINUTOS ---
  // --- MATEMÁTICA: RESTAR 30 MINUTOS ---
  function calcular30MinutosAntes(horaStr: string): string {
    if (!horaStr) return '--:--';
    
    // Busca formato con AM/PM o solo formato simple (ej: 10:10 o 14:30)
    const match = horaStr.match(/(\d+):(\d+)(?:\s*(a\.m\.|p\.m\.|am|pm))?/i);
    if (!match) return horaStr;
    
    let h = parseInt(match[1]);
    let m = parseInt(match[2]);
    let mod = match[3]; // Puede ser undefined si no usas am/pm
    
    if (mod) {
        let isPm = mod.toLowerCase().includes('p');
        if (h === 12 && !isPm) h = 0;
        if (h !== 12 && isPm) h += 12;
    }
    
    // Restar 30 minutos
    let totalMinutos = h * 60 + m - 30;
    if (totalMinutos < 0) totalMinutos += 24 * 60;
    
    let newH = Math.floor(totalMinutos / 60) % 24;
    let newM = totalMinutos % 60;
    let displayM = newM.toString().padStart(2, '0');
    
    if (mod) {
        let newMod = newH >= 12 ? 'p.m.' : 'a.m.';
        let displayH = newH % 12;
        if (displayH === 0) displayH = 12;
        return `${displayH}:${displayM} ${newMod}`;
    } else {
        // Devuelve formato 24h sin letras
        let displayH = newH.toString().padStart(2, '0');
        return `${displayH}:${displayM}`;
    }
  }

  function formatearFuente(fuente: string): string {
    if (!fuente) return 'En persona';
    const f = fuente.toLowerCase();
    if (f.includes('video')) return 'Video';
    if (f.includes('stream')) return 'JWStream';
    if (f.includes('remota')) return 'Remota';
    return 'En persona';
  }

  // --- CÁLCULO INTELIGENTE DE FECHAS POR DÍA ---
  function obtenerFechaEspecifica(fechaRango: string, diaNombre: string): string {
    if (!fechaRango) return '';
    
    // Busca el primer patrón de fecha YYYY-MM-DD en el texto (ej: "2026-12-04")
    const match = fechaRango.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!match) return fechaRango; // Si no tiene el formato esperado, devuelve lo que haya
    
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; // En JavaScript los meses van de 0 a 11
    const day = parseInt(match[3]);
    
    // Asumimos que la primera fecha es Viernes
    let fecha = new Date(year, month, day);
    
    const d = diaNombre.toLowerCase();
    if (d === 'sábado' || d === 'sabado') {
        fecha.setDate(fecha.getDate() + 1);
    } else if (d === 'domingo') {
        fecha.setDate(fecha.getDate() + 2);
    }
    
    // Formatear para que se vea bonito: "4 de diciembre de 2026"
    return fecha.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
  }

  function obtenerContactosParaPdf(parte: any): string[] {
    const contactos: string[] = [];
    const telefonos = obtenerListaTelefonos(parte.telefono_orador);
    if (telefonos.length) contactos.push(`Tel./WhatsApp: ${telefonos.join(', ')}`);
    const correo = parte.email_orador || parte.email;
    if (correo?.trim()) contactos.push(`Correo: ${correo.trim()}`);
    return contactos.length ? contactos : ['—'];
  }

  function envolverTextoPdf(
    texto: string,
    maxWidth: number,
    font: { widthOfTextAtSize: (text: string, size: number) => number },
    size: number
  ): string[] {
    const lineas: string[] = [];
    for (const parrafo of String(texto || '').split('\n')) {
      const palabras = parrafo.split(/\s+/).filter(Boolean);
      if (!palabras.length) {
        lineas.push('');
        continue;
      }
      let linea = '';
      for (const palabra of palabras) {
        const candidata = linea ? `${linea} ${palabra}` : palabra;
        if (font.widthOfTextAtSize(candidata, size) <= maxWidth || !linea) {
          linea = candidata;
        } else {
          lineas.push(linea);
          linea = palabra;
        }
      }
      if (linea) lineas.push(linea);
    }
    return lineas.length ? lineas : [''];
  }

// --- LLAMADAS Y WHATSAPP ---
  function limpiarTelefono(tel: string): string {
    return tel.replace(/[\s\-\(\)]/g, ''); // Quita espacios y guiones
  }

  // --- SEPARADOR INTELIGENTE DE MÚLTIPLES TELÉFONOS (CON FILTRO DE DUPLICADOS) ---
  function obtenerListaTelefonos(telefonosStr: string): string[] {
    if (!telefonosStr) return [];
    
    let listaCruda: string[] = [];
    
    // Si usaste comas o slashes para separar, es fácil:
    if (telefonosStr.includes(',') || telefonosStr.includes('/')) {
      listaCruda = telefonosStr.split(/[,/]/).map(t => t.trim()).filter(t => t.length > 4);
    } else {
      // Si están separados por espacios, procesamos con cuidado
      let partes = telefonosStr.trim().split(/\s+/);
      let temporal = "";
      
      for (let parte of partes) {
        temporal += (temporal.length > 0 ? " " : "") + parte;
        let digitos = temporal.replace(/\D/g, '');
        if (digitos.length >= 8) {
            listaCruda.push(temporal);
            temporal = ""; 
        }
      }
      if (temporal.replace(/\D/g, '').length > 4) {
          listaCruda.push(temporal);
      }
    }

    if (listaCruda.length === 0) listaCruda = [telefonosStr];

    // DEDUPLICAR: Elimina números repetidos (ej: "05 8606589" y "58606589")
    let unicos: string[] = [];
    let firmas = new Set();
    
    for (let tel of listaCruda) {
      let digitos = tel.replace(/\D/g, '');
      // Tomamos los últimos 8 dígitos reales para comparar
      let firma = digitos.length >= 8 ? digitos.slice(-8) : digitos;
      
      if (!firmas.has(firma)) {
          firmas.add(firma);
          unicos.push(tel);
      }
    }

    return unicos;
  } 

  async function llamarCelular(telefono: string) {
    let telLimpio = limpiarTelefono(telefono);
    // Si es un número de Cuba sin código (ej. 53359097), le añade el +53
    if (telLimpio.length === 8 && telLimpio.startsWith('5')) {
        telLimpio = '+53' + telLimpio;
    }
    try {
        await openUrl(`tel:${telLimpio}`);
    } catch(e) {
        console.error("Error al abrir teléfono:", e);
    }
  }

async function abrirWhatsApp(telefono: string, parte: any) {
    let telLimpio = limpiarTelefono(telefono);
    telLimpio = telLimpio.replace(/^\+/, ''); 
    if (!telLimpio.startsWith('53') && telLimpio.length === 8) {
        telLimpio = '53' + telLimpio;
    }

    // 1. Buscar la plantilla específica de registro
    let plantilla = obtenerPlantillaWhatsAppPorId('registro_orador');
    let cuerpoBase = plantilla?.body || "";

    if (!cuerpoBase) {
        try {
            // Nota: Aquí pedimos 'registro_orador' a Rust también
            const res: any = await invoke('obtener_plantilla_mensaje', { id: 'registro_orador' });
            if (res && res.cuerpo) cuerpoBase = res.cuerpo;
        } catch (e) {
            console.error("Error cargando plantilla WhatsApp registro_orador:", e);
        }
    }

    if (!cuerpoBase) cuerpoBase = "⚠️ No se ha definido una plantilla de asignación.";

    // 2. Generar el contexto
    const asId = asambleaActiva?.id || 0;
    const contexto = await generarContexto(parte, asId, true);
    let mensaje = prepararContenidoWhatsApp(cuerpoBase, contexto);

    // 3. LÓGICA DE OPENER: Construimos ambas URLs
    const nativeUrl = `whatsapp://send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`;
    const webUrl = `https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`;

    try {
        // Intento 1: App Nativa
        await openUrl(nativeUrl);
    } catch (error) {
        console.warn("App nativa no encontrada, usando fallback web:", error);
        try {
            // Intento 2: Fallback Web
            await openUrl(webUrl);
        } catch (fallbackError) {
            console.error("Error al abrir WhatsApp:", fallbackError);
            alert("No se pudo abrir WhatsApp. Verifica tu navegador predeterminado.");
        }
    }
  }

// --- EMAIL MASIVO A TODOS LOS ORADORES ---
  async function enviarEmailMasivo() {
    const emailsUnicos = new Set<string>();
    
    // 1. Recorremos todas las partes cargadas
    partes.forEach(p => {
      const correo = p.email_orador || p.email;
      if (correo && correo.trim() !== '' && p.fuente !== 'Video' && p.fuente !== 'video') {
        emailsUnicos.add(correo.trim());
      }
    });

    const listaCorreos = Array.from(emailsUnicos).join(';');
    
    if (listaCorreos.length === 0) {
      return alert("⚠️ No se encontraron correos. Verifica que los oradores tengan un email asignado en la base de datos.");
    }

    // 2. Extraer la plantilla masiva
    const plantilla = obtenerPlantillaPorId('registro_orador');
    const asuntoBase = plantilla?.subject || "Información de la Asamblea";
    const cuerpoBase = plantilla?.body || "Estimados hermanos, información importante sobre el registro.";

    // 3. Crear contexto simulado (sin datos personales porque es para muchos a la vez)
    const asId = asambleaActiva?.id || 0;
    const objetoSimulado = {
        nombre_orador: 'Hermanos', 
        tema: 'Asignaciones de la Asamblea', 
        tipo_asignacion: 'General'
    };

    const contexto = await generarContexto(objetoSimulado, asId, false);
    const asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
    const cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);

    try {
      const url = `https://mail.jwpub.org/owa/?path=/mail/action/compose` +
                  `&to=${encodeURIComponent(listaCorreos)}` +
                  `&subject=${encodeURIComponent(asuntoFinal)}` +
                  `&body=${encodeURIComponent(cuerpoFinal)}`;
                  
      await openUrl(url);
      console.log("Correos masivos enviados a:", listaCorreos);
    } catch (e) {
      console.error("Error al abrir JWPUB:", e);
      alert("Error al intentar abrir el cliente de correo.");
    }
  }

// --- EMAIL INDIVIDUAL ---
  async function abrirEmailIndividual(parte: any) {
    const correo = parte.email_orador || parte.email;
    
    if (!correo || correo.trim() === '') {
      return alert("Este orador no tiene correo electrónico registrado.");
    }
    
    // 1. Extraer la plantilla de contacto general
    const plantilla = obtenerPlantillaPorId('registro_orador');
    const asuntoBase = plantilla?.subject || "Asignación de Asamblea";
    const cuerpoBase = plantilla?.body || "Le escribimos en relación a su asignación.";

    // 2. Generar el contexto dinámico real del hermano
    const asId = asambleaActiva?.id || 0;
    const contexto = await generarContexto(parte, asId, false);
    
    const asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
    const cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);
    
    try {
      const url = `https://mail.jwpub.org/owa/?path=/mail/action/compose` +
                  `&to=${encodeURIComponent(correo.trim())}` +
                  `&subject=${encodeURIComponent(asuntoFinal)}` +
                  `&body=${encodeURIComponent(cuerpoFinal)}`;
                  
      await openUrl(url);
    } catch(e) {
      console.error(e);
      alert("Error al abrir JWPUB");
    }
  }

  async function toggleCheck(id: number, campo: string, valorActual: boolean) {
    try {
      // Invertimos el valor al hacer clic
      const nuevoValor = !valorActual;
      
      // 1. Llamamos al EMBUDO en lugar de usar invoke directo
      await DB.actualizarCheckRegistro(id, campo, nuevoValor);

      // 2. Actualizamos la interfaz visualmente sin recargar todo
      partes = partes.map(p => {
        if (p.id === id) {
          return { ...p, [campo]: nuevoValor };
        }
        return p;
      });
      agruparPorDia(partes);
      
    } catch (e) {
      console.error("Error al guardar en BD:", e);
      alert("No se pudo guardar el cambio.");
    }
  }

async function generarPDFPlano() {
    try {
      const docDefinition: TDocumentDefinitions = {
        pageOrientation: 'landscape',
        pageSize: 'A4',
        pageMargins: [32, 38, 32, 38],
        content: [
          { text: 'REGISTRO DE ORADORES', style: 'header' },
          { text: `${asambleaActiva?.tema || 'Sin tema'}   •   Número: ${asambleaActiva?.identificador || '000'}`, style: 'subheader' }
        ],
        footer: (pagina: number, paginas: number) => ({
          columns: [
            { text: 'RAssembly · Registro de oradores', alignment: 'left' },
            { text: `${pagina} / ${paginas}`, alignment: 'right' }
          ],
          margin: [32, 0, 32, 16],
          fontSize: 8,
          color: '#64748b'
        }),
        styles: {
          header: { fontSize: 18, bold: true, color: '#17324d', margin: [0, 0, 0, 4] },
          subheader: { fontSize: 9, color: '#64748b', margin: [0, 0, 0, 12] },
          diaTitulo: { fontSize: 11, bold: true, color: '#17324d', fillColor: '#eaf2f8', margin: [0, 4, 0, 4] },
          tablaHeader: { bold: true, fontSize: 7.5, color: '#334155', fillColor: '#f1f5f9', alignment: 'center', margin: [0, 4, 0, 4] },
          celdaNormal: { fontSize: 8, margin: [0, 5, 0, 5], color: '#334155', lineHeight: 1.15 },
          celdaCentro: { fontSize: 8, margin: [0, 5, 0, 5], alignment: 'center', bold: true, color: '#334155' },
          textoBold: { bold: true, color: '#17324d' },
          textoGris: { fontSize: 7, color: '#64748b' },
          checkLabel: { fontSize: 7, color: '#334155', alignment: 'center' }
        }
      };

      const dias = ['viernes', 'sábado', 'domingo'];

      dias.forEach(dia => {
        if (programaAgrupado[dia] && programaAgrupado[dia].length > 0) {
          const body: any[] = [];

          body.push([
            { text: `${dia.toUpperCase()}   ·   ${obtenerFechaEspecifica(asambleaActiva?.fecha, dia)}`, style: 'diaTitulo', colSpan: 7, alignment: 'left' },
            {}, {}, {}, {}, {}, {}
          ]);
          body.push([
            { text: 'TIEMPO', style: 'tablaHeader' },
            { text: 'DISCURSO', style: 'tablaHeader', alignment: 'left' },
            { text: 'ORADOR', style: 'tablaHeader', alignment: 'left' },
            { text: 'CONTACTOS', style: 'tablaHeader', alignment: 'left' },
            { text: 'VIERNES', style: 'tablaHeader' },
            { text: 'DÍA DE\nDISCURSO', style: 'tablaHeader' },
            { text: '30 MINUTOS\nANTES', style: 'tablaHeader' }
          ]);

          programaAgrupado[dia].forEach((p: any, indice: number) => {
            const numBosquejo = p.numero_bosquejo ? `${p.numero_bosquejo} ` : '';
            const fillColor = indice % 2 === 0 ? '#ffffff' : '#f8fafc';
            const contactos = obtenerContactosParaPdf(p).join('\n');
            const estiloCelda = (text: any, extra: Record<string, unknown> = {}) => ({
              text,
              style: 'celdaNormal',
              fillColor,
              ...extra
            });
            body.push([
              estiloCelda(p.hora_inicio || '--:--', { bold: true, alignment: 'center', color: '#17324d' }),
              estiloCelda([{ text: numBosquejo, style: 'textoBold' }, { text: p.tema || 'Sin tema' }]),
              estiloCelda([
                { text: `${p.nombre_orador || 'Sin asignar'}\n`, style: 'textoBold' },
                { text: p.congregacion_orador || 'Congregación no indicada', style: 'textoGris' }
              ]),
              estiloCelda(contactos, { fontSize: 7.5, color: '#475569' }),
              estiloCelda(p.check_viernes ? '[ X ]' : '[   ]', { style: 'celdaCentro', color: p.check_viernes ? '#15803d' : '#64748b' }),
              estiloCelda(p.check_dia ? '[ X ]' : '[   ]', { style: 'celdaCentro', color: p.check_dia ? '#15803d' : '#64748b' }),
              estiloCelda(`${p.check_30m ? '[ X ]' : '[   ]'}\n${calcular30MinutosAntes(p.hora_inicio)}`, { style: 'celdaCentro', color: p.check_30m ? '#15803d' : '#64748b' })
            ]);
          });

          (docDefinition.content as Content[]).push({
            table: {
              headerRows: 2,
              keepWithHeaderRows: 2,
              dontBreakRows: true,
              widths: [45, 204, 135, 145, 64, 84, 100],
              body: body
            },
            layout: {
              hLineColor: (indice: number) => indice === 1 ? '#cbd5e1' : '#e2e8f0',
              hLineWidth: (indice: number) => indice === 1 ? 0.8 : 0.45,
              vLineWidth: () => 0,
              paddingLeft: () => 7,
              paddingRight: () => 7,
              paddingTop: () => 2,
              paddingBottom: () => 2
            },
            margin: [0, 0, 0, 12]
          });
        }
      });

      // Generación y guardado usando Tauri Dialog
      const pdfDocGenerator = pdf.createPdf(docDefinition);
      const blob = await pdfDocGenerator.getBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const binary = new Uint8Array(arrayBuffer);

      const path = await save({
        defaultPath: `Registro_Oradores_${asambleaActiva?.identificador || '000'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (path) {
        await writeFile(path, binary);
        alert("✅ PDF Plano generado y guardado correctamente.");
      }

    } catch (e) {
      console.error("Error al generar PDF plano:", e);
      alert("Error al generar el PDF: " + e);
    }
  }

  async function generarPDFRellenable() {
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const form = pdfDoc.getForm();
      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const left = 32;
      const right = pageWidth - 32;
      const pageBottom = 34;
      const pages = [];
      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(page);
      let yPos = 0;

      const drawPageHeader = (pagina: typeof page) => {
        pagina.drawText('REGISTRO DE ORADORES', {
          x: left, y: pageHeight - 34, size: 17, font: fontBold, color: rgb(0.09, 0.2, 0.31)
        });
        pagina.drawText(
          `${asambleaActiva?.tema || 'Sin tema'}   |   Número: ${asambleaActiva?.identificador || '000'}`,
          { x: left, y: pageHeight - 51, size: 9, font, color: rgb(0.38, 0.45, 0.53) }
        );
        pagina.drawLine({
          start: { x: left, y: pageHeight - 62 },
          end: { x: right, y: pageHeight - 62 },
          thickness: 1,
          color: rgb(0.86, 0.89, 0.92)
        });
        return pageHeight - 80;
      };

      const drawSectionHeading = (pagina: typeof page, dia: string, y: number) => {
        const fecha = obtenerFechaEspecifica(asambleaActiva?.fecha, dia);
        pagina.drawRectangle({
          x: left, y: y - 7, width: right - left, height: 22,
          color: rgb(0.91, 0.95, 0.98)
        });
        pagina.drawText(dia.toUpperCase(), {
          x: left + 8, y, size: 10, font: fontBold, color: rgb(0.09, 0.32, 0.52)
        });
        pagina.drawText(fecha, {
          x: left + 76, y, size: 9, font, color: rgb(0.38, 0.45, 0.53)
        });

        const headers = [
          { lineas: ['HORA'], x: 40 },
          { lineas: ['DISCURSO'], x: 85 },
          { lineas: ['ORADOR'], x: 289 },
          { lineas: ['CONTACTOS'], x: 424 },
          { lineas: ['VIERNES'], centro: 593 },
          { lineas: ['DÍA DE', 'DISCURSO'], centro: 667 },
          { lineas: ['30 MINUTOS', 'ANTES'], centro: 759 }
        ] as const;
        const headerY = y - 25;
        for (const encabezado of headers) {
          encabezado.lineas.forEach((linea, indice) => {
            const x = 'centro' in encabezado
              ? encabezado.centro - fontBold.widthOfTextAtSize(linea, 6) / 2
              : encabezado.x;
            pagina.drawText(linea, {
              x,
              y: headerY - indice * 7,
              size: 6,
              font: fontBold,
              color: rgb(0.31, 0.38, 0.45)
            });
          });
        }
        pagina.drawLine({
          start: { x: left, y: headerY - 13 },
          end: { x: right, y: headerY - 13 },
          thickness: 0.8,
          color: rgb(0.76, 0.81, 0.86)
        });
        return headerY - 26;
      };

      const beginNewPage = (dia: string) => {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        pages.push(page);
        yPos = drawPageHeader(page);
        yPos = drawSectionHeading(page, dia, yPos);
      };

      yPos = drawPageHeader(page);
      const dias = ['viernes', 'sábado', 'domingo'];
      const posiciones = {
        hora: 40, discurso: 85, orador: 289, contactos: 424,
        viernes: 587, dia: 661, treinta: 753
      };
      const anchos = {
        discurso: 189, orador: 124, contactos: 134
      };

      for (const dia of dias) {
        const lista = programaAgrupado[dia] || [];
        if (!lista.length) continue;
        if (yPos < 90) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          pages.push(page);
          yPos = drawPageHeader(page);
        }
        yPos = drawSectionHeading(page, dia, yPos);

        for (let indice = 0; indice < lista.length; indice++) {
          const p = lista[indice];
          const tema = `${p.numero_bosquejo ? `${p.numero_bosquejo} ` : ''}${p.tema || 'Sin tema'}`;
          const lineasTema = envolverTextoPdf(tema, anchos.discurso, font, 8);
          const lineasOrador = envolverTextoPdf(p.nombre_orador || 'Sin asignar', anchos.orador, fontBold, 8);
          const congregacion = p.congregacion_orador || 'Congregación no indicada';
          const lineasCongregacion = p.congregacion_orador
            ? envolverTextoPdf(congregacion, anchos.orador, font, 7)
            : [];
          const lineasContactos = obtenerContactosParaPdf(p).flatMap(linea =>
            envolverTextoPdf(linea, anchos.contactos, font, 6.5)
          );
          const lineCount = Math.max(
            lineasTema.length,
            lineasOrador.length + lineasCongregacion.length,
            lineasContactos.length,
            1
          );
          const rowHeight = Math.max(27, lineCount * 10 + 11);

          if (yPos - rowHeight < pageBottom) beginNewPage(dia);

          if (indice % 2 === 1) {
            page.drawRectangle({
              x: left, y: yPos - rowHeight + 2, width: right - left, height: rowHeight,
              color: rgb(0.97, 0.98, 0.99)
            });
          }

          const textY = yPos - 11;
          page.drawText(p.hora_inicio || '--:--', {
            x: posiciones.hora, y: textY, size: 8, font: fontBold, color: rgb(0.09, 0.2, 0.31)
          });
          lineasTema.forEach((linea, i) => page.drawText(linea, {
            x: posiciones.discurso, y: textY - i * 10, size: 8, font, color: rgb(0.18, 0.24, 0.3)
          }));
          lineasOrador.forEach((linea, i) => page.drawText(linea, {
            x: posiciones.orador, y: textY - i * 10, size: 8, font: fontBold, color: rgb(0.09, 0.2, 0.31)
          }));
          lineasCongregacion.forEach((linea, i) => page.drawText(linea, {
            x: posiciones.orador, y: textY - (lineasOrador.length + i) * 10,
            size: 7, font, color: rgb(0.42, 0.48, 0.54)
          }));
          lineasContactos.forEach((linea, i) => page.drawText(linea, {
            x: posiciones.contactos, y: textY - i * 9, size: 6.5, font, color: rgb(0.28, 0.34, 0.4)
          }));

          const checkboxY = yPos - Math.max(11, (rowHeight + 12) / 2);
          const cbViernes = form.createCheckBox(`v_${p.id}`);
          cbViernes.addToPage(page, { x: posiciones.viernes, y: checkboxY, width: 12, height: 12 });
          if (p.check_viernes) cbViernes.check();

          const cbDia = form.createCheckBox(`d_${p.id}`);
          cbDia.addToPage(page, { x: posiciones.dia, y: checkboxY, width: 12, height: 12 });
          if (p.check_dia) cbDia.check();

          const cb30m = form.createCheckBox(`m_${p.id}`);
          cb30m.addToPage(page, { x: posiciones.treinta, y: checkboxY, width: 12, height: 12 });
          if (p.check_30m) cb30m.check();
          page.drawText(calcular30MinutosAntes(p.hora_inicio), {
            x: posiciones.treinta + 15, y: checkboxY + 2, size: 6.5, font, color: rgb(0.38, 0.45, 0.53)
          });

          yPos -= rowHeight;
          page.drawLine({
            start: { x: left, y: yPos },
            end: { x: right, y: yPos },
            thickness: 0.45,
            color: rgb(0.87, 0.89, 0.91)
          });
          yPos -= 2;
        }
        yPos -= 9;
      }

      const totalPaginas = pages.length;
      pages.forEach((pagina, indice) => {
        pagina.drawText(`RAssembly · Registro de oradores`, {
          x: left, y: 18, size: 7, font, color: rgb(0.45, 0.5, 0.56)
        });
        pagina.drawText(`${indice + 1} / ${totalPaginas}`, {
          x: right - 30, y: 18, size: 7, font, color: rgb(0.45, 0.5, 0.56)
        });
      });

      // Generación y guardado usando Tauri Dialog
      const pdfBytes = await pdfDoc.save(); // pdf-lib ya devuelve un Uint8Array nativo

      const path = await save({
        defaultPath: `Formulario_Registro_${asambleaActiva?.identificador || '000'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (path) {
        await writeFile(path, pdfBytes);
        alert("✅ PDF Rellenable generado y guardado correctamente.");
      }

    } catch (e) {
      console.error("Error al generar PDF rellenable:", e);
      alert("Error al generar el PDF rellenable: " + e);
    }
  }


</script>

<div class="vista-programa-container">
  
  <div class="top-fijo">
    <header class="header-vista">
      <h1>Registro de oradores</h1>
      <p class="subtitle">
        {asambleaActiva?.tema || 'Sin tema'} • Número: {asambleaActiva?.identificador || '000'}
      </p>
    </header>

    <div class="controles-vista">

      <button class="btn-email-masivo" on:click={enviarEmailMasivo} title="Enviar correo a todos los oradores" aria-label="Enviar correo a todos los oradores">
        <Mail size={16}/> <span>Email a todos los oradores</span>
      </button>

      <button class="btn-pdf" on:click={generarPDFPlano} title="Generar PDF" aria-label="Generar PDF">
        <PdfIcon /> <span>Generar PDF</span>
      </button>
      
      <button class="btn-pdf-outline" on:click={generarPDFRellenable} title="Generar PDF rellenable" aria-label="Generar PDF rellenable">
        <FileCheck size={18}/> <span>Generar PDF rellenable</span>
      </button>
    </div>
  </div>

  <div class="contenido-programa">
    {#each ['viernes', 'sábado', 'domingo'] as dia}
      {#if programaAgrupado[dia] && programaAgrupado[dia].length > 0}
        
        <div class="dia-header"
             class:dia-viernes={dia === 'viernes'}
             class:dia-sabado={dia === 'sábado'}
             class:dia-domingo={dia === 'domingo'}>
          <div class="dia-titulo-wrapper">
            <h2 class="dia-titulo">{dia}</h2>
            <p class="dia-fecha">{obtenerFechaEspecifica(asambleaActiva?.fecha, dia)}</p>
          </div>
          
          <div class="tabla-encabezado">
            <div class="th-tiempo">TIEMPO</div>
            <div class="th-discurso">DISCURSO</div>
            <div class="th-orador">ORADOR</div>
            <div class="th-movil">CONTACTOS</div>
            <div class="th-check" title="Marcar si se confirmó la asistencia del viernes">VIERNES</div>
            <div class="th-check" title="Marcar si se confirmó la asistencia el día del discurso">DÍA DE DISCURSO</div>
            <div class="th-check30" title="Marcar si se envió el recordatorio 30 minutos antes">30 MINUTOS ANTES</div>
          </div>
        </div>

        <div class="filas-contenedor"
             class:dia-viernes={dia === 'viernes'}
             class:dia-sabado={dia === 'sábado'}
             class:dia-domingo={dia === 'domingo'}>
          {#each programaAgrupado[dia] as parte}
            <div class="fila-registro">
              <div class="td-tiempo">{parte.hora_inicio || '--:--'}</div>
              
              <div class="td-discurso">
                <div class="discurso-meta">
                  <strong>{parte.numero_bosquejo || ''}</strong> 
                  <span class="fuente-tag">{formatearFuente(parte.fuente)}</span>
                </div>
                <div class="discurso-tema">{parte.tema || 'Sin tema'}</div>
              </div>

              <div class="td-orador">
                <div class="orador-nombre">{parte.nombre_orador || '---'}</div>
                <div class="orador-cong">{parte.congregacion_orador || ''}</div>
              </div>

              <div class="td-movil">
                <div class="lista-contactos">
                  
                  {#if parte.telefono_orador && parte.telefono_orador.trim() !== ''}
                    <div class="lista-telefonos">
                      {#each obtenerListaTelefonos(parte.telefono_orador) as tel}
                        <div class="acciones-tel">
                          <button class="btn-celular" on:click={() => llamarCelular(tel)} title={`Llamar ${tel}`} aria-label={`Llamar ${tel}`}>
                            <Phone size={13}/> <span class="etiqueta-contacto">{tel}</span>
                          </button>
                          <button class="btn-whatsapp" on:click={() => abrirWhatsApp(tel, parte)} title={`Mensaje por WhatsApp a ${tel}`} aria-label={`Mensaje por WhatsApp a ${tel}`}>
                            <MessageCircle size={13}/> <span class="etiqueta-contacto">WhatsApp</span>
                          </button>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  {#if (parte.email_orador && parte.email_orador.trim() !== '') || (parte.email && parte.email.trim() !== '')}
                    <div class="acciones-email-indiv" style="margin-top: 4px;">
                      <button class="btn-email-indiv-icon" on:click={() => abrirEmailIndividual(parte)} title="jwpub.org" aria-label="Enviar correo jwpub.org">
                        <Mail size={16}/> <span class="etiqueta-contacto">jwpub.org</span>
                      </button>
                    </div>
                  {/if}

                  {#if (!parte.telefono_orador || parte.telefono_orador.trim() === '') && (!parte.email_orador || parte.email_orador.trim() === '') && (!parte.email || parte.email.trim() === '')}
                    <span class="sin-datos">---</span>
                  {/if}

                </div>
              </div>

              <div class="td-check">
                <input 
                  type="checkbox" 
                  class="caja-check" 
                  checked={parte.check_viernes === 1 || parte.check_viernes === true} 
                  on:change={() => toggleCheck(parte.id, 'check_viernes', parte.check_viernes)} 
                />
              </div>

              <div class="td-check">
                <input 
                  type="checkbox" 
                  class="caja-check" 
                  checked={parte.check_dia === 1 || parte.check_dia === true} 
                  on:change={() => toggleCheck(parte.id, 'check_dia', parte.check_dia)} 
                />
              </div>
              
              <div class="td-check30">
                <input 
                  type="checkbox" 
                  class="caja-check" 
                  checked={parte.check_30m === 1 || parte.check_30m === true} 
                  on:change={() => toggleCheck(parte.id, 'check_30m', parte.check_30m)} 
                />
                <span class="tiempo-30m">{calcular30MinutosAntes(parte.hora_inicio)}</span>
              </div>
            </div>
          {/each}
        </div>

      {/if}
    {/each}
  </div>
</div>

<style>
/* =======================================
   ESTRUCTURA PRINCIPAL
   ======================================= */
.vista-programa-container {
  background-color: var(--bg-body);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px 24px 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.top-fijo {
  flex-shrink: 0;
  margin-bottom: 14px;
  padding: 0 2px 12px;
  border-bottom: 1px solid var(--border);
}
.header-vista h1 { font-size: 20px; font-weight: 700; color: var(--text-main); margin: 0 0 2px 0; }
.subtitle { font-size: 14px; color: var(--text-sec); margin: 0; }

.controles-vista {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
  align-items: center;
}

/* BOTONES */
.btn-email-masivo {
  background-color: #ea580c;
  color: #ffffff;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}
.btn-email-masivo:hover { background-color: #c2410c; }

.btn-pdf, .btn-pdf-outline {
  color: #ffffff;
  border: 1px solid transparent;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: filter 0.18s, transform 0.18s;
}
.btn-pdf { background: #701c35; }
.btn-pdf-outline { background: #b42332; }
.btn-pdf:hover, .btn-pdf-outline:hover {
  filter: brightness(0.9);
  transform: translateY(-1px);
}

/* TABLA Y GRID */
.contenido-programa { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 40px; }
.dia-header {
  position: sticky; top: 0;
  background-color: var(--bg-card);
  z-index: 10;
  margin: 0 0 8px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  display: flex; flex-direction: column;
  overflow: hidden;
  border-top: 4px solid var(--dia-acento, var(--primary));
}

.dia-viernes { --dia-acento: #0284c7; }
.dia-sabado { --dia-acento: #d66aa6; }
.dia-domingo { --dia-acento: #f59e0b; }

.dia-titulo-wrapper {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 10px 18px;
}
.dia-titulo { font-size: 20px; font-weight: 750; color: var(--text-main); margin: 0; text-transform: capitalize; }
.dia-fecha { font-size: 12px; color: var(--text-sec); margin: 0; }

.tabla-encabezado, .fila-registro {
  display: grid;
  grid-template-columns: 75px minmax(240px, 3.5fr) minmax(170px, 2.5fr) minmax(190px, 1.8fr) 65px 75px 120px;
  gap: 12px; align-items: center;
}

.tabla-encabezado {
  background-color: var(--bg-body);
  border-top: 1px solid var(--border);
  padding: 9px 18px;
  font-size: 10px; font-weight: 750; color: var(--text-sec);
  letter-spacing: 0.035em;
}

.fila-registro {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 18px;
  min-height: 62px;
  margin-bottom: 7px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.035);
  transition: border-color 0.18s, box-shadow 0.18s;
}
.fila-registro:hover {
  border-color: color-mix(in srgb, var(--dia-acento, var(--primary)) 42%, var(--border));
  box-shadow: var(--shadow-sm);
}

/* CHECKBOXES - RESTAURADOS */
.td-check { display: flex; justify-content: center; }
.td-check30 { display: flex; align-items: center; gap: 8px; justify-content: flex-start; }

.caja-check {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--primary);
  display: inline-block !important;
  appearance: auto !important;
  -webkit-appearance: checkbox !important;
  visibility: visible !important;
  opacity: 1 !important;
}

.tiempo-30m { font-size: 12px; color: var(--text-sec); }

/* TEXTOS Y ACCIONES */
.td-tiempo { font-size: 13px; font-weight: 600; color: var(--text-sec); }
.discurso-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 3px; }
.discurso-meta strong { font-size: 12px; color: var(--text-main); }
.fuente-tag {
  color: var(--text-sec);
  background: var(--bg-body);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 10px;
  line-height: 1.3;
}
.discurso-tema { font-size: 13px; line-height: 1.4; color: var(--text-main); }
.orador-nombre { font-size: 13px; font-weight: 600; color: var(--text-main); }
.orador-cong { font-size: 11px; color: var(--text-sec); }

.lista-contactos,
.lista-telefonos {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px 8px;
}
.lista-contactos, .lista-telefonos { min-width: 0; }
.acciones-tel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.acciones-email-indiv { display: inline-flex; align-items: center; margin-top: 0 !important; }
.etiqueta-contacto { display: inline; }

.btn-celular, .btn-whatsapp {
  display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600;
  background: transparent; border: 1px solid transparent; padding: 2px 4px; border-radius: 4px; cursor: pointer;
}
.btn-celular { min-width: 0; text-align: left; }
.btn-celular :global(svg) { flex: 0 0 auto; }
.btn-celular .etiqueta-contacto { min-width: 0; overflow-wrap: anywhere; }
.btn-whatsapp { flex: 0 0 auto; white-space: nowrap; }
.btn-celular { color: var(--primary); }
.btn-whatsapp { color: var(--accent-success); }
.btn-celular:hover, .btn-whatsapp:hover { background-color: var(--border); }

.btn-email-indiv-icon {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  min-height: 28px; border-radius: 6px; padding: 3px 5px;
  background: transparent; border: 1px solid transparent; cursor: pointer;
  font-size: 11px; font-weight: 600;
  color: var(--accent-danger);
}
.btn-email-indiv-icon:hover { background-color: var(--border); }

/* RESPONSIVO */
@media (max-width: 768px) {
  .vista-programa-container { padding: 12px 12px 0; }
  .top-fijo { margin-bottom: 12px; padding-bottom: 10px; }
  .header-vista h1 { font-size: 18px; }
  .subtitle { font-size: 12px; }
  .controles-vista {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .controles-vista button {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
    padding: 8px;
    font-size: 11px;
    justify-content: center;
    white-space: normal;
  }
  .controles-vista button span { display: inline; }
  .controles-vista .btn-pdf,
  .controles-vista .btn-pdf-outline {
    flex: 0 0 44px;
    width: 44px;
    padding: 8px;
  }
  .controles-vista .btn-pdf span,
  .controles-vista .btn-pdf-outline span { display: none; }
  .controles-vista .btn-pdf :global(svg),
  .controles-vista .btn-pdf-outline :global(svg) {
    width: 19px;
    height: 19px;
    flex: 0 0 auto;
  }
  .dia-titulo-wrapper { gap: 8px; padding: 9px 12px; }
  .dia-titulo { font-size: 18px; }
  .dia-fecha { font-size: 11px; }
  .tabla-encabezado { display: none; }
  .fila-registro {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 8px;
    padding: 12px;
    margin-bottom: 10px;
  }
  .fila-registro > .td-tiempo {
    grid-column: 1 / -1;
    color: var(--dia-acento, var(--primary));
    font-weight: 750;
    font-size: 12px;
  }
  .fila-registro > .td-discurso,
  .fila-registro > .td-orador,
  .fila-registro > .td-movil { grid-column: 1 / -1; }
  .td-discurso, .td-orador, .td-movil { min-width: 0; }
  .td-orador {
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .td-movil {
    padding-top: 7px;
    border-top: 1px solid var(--border);
  }
  .lista-contactos,
  .lista-telefonos {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .btn-celular, .btn-whatsapp, .btn-email-indiv-icon {
    box-sizing: border-box;
    width: 34px;
    min-width: 34px;
    height: 34px;
    min-height: 34px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-card);
  }
  .btn-celular :global(svg),
  .btn-whatsapp :global(svg),
  .btn-email-indiv-icon :global(svg) {
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
  }
  .etiqueta-contacto { display: none; }
  .fila-registro > .td-check,
  .fila-registro > .td-check30 {
    box-sizing: border-box;
    height: 72px;
    display: grid;
    grid-template-columns: auto auto;
    grid-template-rows: minmax(26px, 1fr) 20px;
    align-content: space-between;
    align-items: center;
    justify-content: center;
    gap: 4px 6px;
    padding: 6px 4px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-body);
    text-align: center;
  }
  .fila-registro > .td-check::before,
  .fila-registro > .td-check30::before {
    grid-column: 1 / -1;
    align-self: end;
    line-height: 1.15;
  }
  .fila-registro > .td-check > .caja-check {
    grid-column: 1 / -1;
    justify-self: center;
  }
  .fila-registro > .td-check30 > .caja-check {
    justify-self: end;
  }
  .fila-registro > .td-check30 > .tiempo-30m {
    justify-self: start;
    font-size: 9px;
    white-space: nowrap;
  }
  .fila-registro > .td-check:nth-child(5)::before {
    content: "Viernes";
    font-size: 10px;
    font-weight: 700;
    color: var(--text-sec);
  }
  .fila-registro > .td-check:nth-child(6)::before {
    content: "Día de discurso";
    font-size: 10px;
    font-weight: 700;
    color: var(--text-sec);
  }
  .fila-registro > .td-check30::before {
    content: "30 minutos antes";
    font-size: 10px;
    font-weight: 700;
    color: var(--text-sec);
  }
  .caja-check { width: 20px; height: 20px; }
}
</style>