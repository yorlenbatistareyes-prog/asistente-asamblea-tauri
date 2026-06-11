<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { DB } from '$lib/services/db';
  
  import { MessageSquare } from 'lucide-svelte';
  import { Phone, MessageCircle, Mail } from 'lucide-svelte';
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

  onMount(async () => {
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
      const asamblea = JSON.parse(datosGuardados);
      asambleaActiva = await invoke('obtener_asamblea_por_id', { id: asamblea.id });
      
      // Aseguramos que las plantillas se cargan desde Rust a Svelte
      await cargarPlantillasEmail();
      await cargarPlantillasWhatsApp();
      
      await cargarTodoElPrograma(asamblea.id);
    }
  });

  async function cargarTodoElPrograma(idAsamblea: number) {
    try {
      const dias = ['Viernes', 'Sábado', 'Domingo'];
      let todasLasPartes: any[] = [];
      
      for (const dia of dias) {
        const res = await invoke('obtener_programa_dia', { asambleaId: idAsamblea, dia }) as any[];
        // Filtrar partes que no son videos puros (opcional, si quieres que los videos también salgan, quita el filter)
        const partesConDia = res.map(p => ({ ...p, dia }));
        todasLasPartes = [...todasLasPartes, ...partesConDia];
      }
      
      partes = todasLasPartes.sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
      agruparPorDia(partes);
    } catch (e) { console.error(e); }
  }

  function agruparPorDia(lista: any[]) {
    const grupos: Record<string, any[]> = {};
    lista.forEach(parte => {
      const dia = parte.dia.toLowerCase();
      if (!grupos[dia]) grupos[dia] = [];
      grupos[dia].push(parte);
    });
    programaAgrupado = grupos;
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
        pageMargins: [30, 40, 30, 40],
        content: [
          { text: 'Registro de Oradores', style: 'header' },
          { text: `${asambleaActiva?.tema || 'Sin tema'} • Número: ${asambleaActiva?.identificador || '000'}`, style: 'subheader' }
        ],
        styles: {
          header: { fontSize: 20, bold: true, color: '#1e293b', margin: [0, 0, 0, 4] },
          subheader: { fontSize: 11, color: '#64748b', margin: [0, 0, 0, 15] },
          diaTitulo: { fontSize: 14, bold: true, color: '#286eb4', margin: [0, 15, 0, 5] },
          tablaHeader: { bold: true, fontSize: 9, color: 'white', fillColor: '#286eb4', alignment: 'center', margin: [0, 4, 0, 4] },
          celdaNormal: { fontSize: 8, margin: [0, 4, 0, 4], color: '#334155' },
          celdaCentro: { fontSize: 8, margin: [0, 4, 0, 4], alignment: 'center', bold: true },
          textoBold: { bold: true, color: '#0f172a' },
          textoGris: { fontSize: 7, color: '#94a3b8' }
        }
      };

      const dias = ['viernes', 'sábado', 'domingo'];
      
      dias.forEach(dia => {
        if (programaAgrupado[dia] && programaAgrupado[dia].length > 0) {
          (docDefinition.content as Content[]).push({ text: dia.toUpperCase(), style: 'diaTitulo' });

          const body: any[] = [];
          
          body.push([
            { text: 'TIEMPO', style: 'tablaHeader' },
            { text: 'DISCURSO', style: 'tablaHeader', alignment: 'left' },
            { text: 'ORADOR', style: 'tablaHeader', alignment: 'left' },
            { text: 'MÓVIL', style: 'tablaHeader', alignment: 'left' },
            { text: 'VIE', style: 'tablaHeader' },
            { text: 'DÍA', style: 'tablaHeader' },
            { text: '30 MINUTOS', style: 'tablaHeader' }
          ]);

          programaAgrupado[dia].forEach((p: any) => {
            const numBosquejo = p.numero_bosquejo ? `${p.numero_bosquejo} ` : '';
            const telefonos = obtenerListaTelefonos(p.telefono_orador).join('\n');

            body.push([
              { text: p.hora_inicio || '--:--', style: 'celdaNormal', bold: true, alignment: 'center' },
              { text: [{ text: numBosquejo, style: 'textoBold' }, { text: p.tema || '' }], style: 'celdaNormal' },
              { text: [{ text: `${p.nombre_orador || '---'}\n`, style: 'textoBold' }, { text: p.congregacion_orador || '', style: 'textoGris' }], style: 'celdaNormal' },
              { text: telefonos, style: 'celdaNormal' },
              { text: p.check_viernes ? '[ X ]' : '[   ]', style: 'celdaCentro', color: p.check_viernes ? '#16a34a' : '#cbd5e1' },
              { text: p.check_dia ? '[ X ]' : '[   ]', style: 'celdaCentro', color: p.check_dia ? '#16a34a' : '#cbd5e1' },
              { text: `${p.check_30m ? '[ X ]' : '[   ]'}  ${calcular30MinutosAntes(p.hora_inicio)}`, style: 'celdaNormal' }
            ]);
          });

          (docDefinition.content as Content[]).push({
            table: {
              headerRows: 1,
              widths: ['auto', '*', '*', 'auto', 'auto', 'auto', 'auto'],
              body: body
            },
            layout: 'lightHorizontalLines'
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

      let page = pdfDoc.addPage([841.89, 595.28]); // A4 Apaisado
      let { width, height } = page.getSize();
      let yPos = height - 40;

      // Cabecera principal
      page.drawText('Registro de Oradores (Formulario Interactivo)', { x: 30, y: yPos, size: 18, font: fontBold });
      yPos -= 15;
      page.drawText(`${asambleaActiva?.tema || 'Sin tema'} • Número: ${asambleaActiva?.identificador || '000'}`, { x: 30, y: yPos, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
      yPos -= 30;

      const dias = ['viernes', 'sábado', 'domingo'];

      for (const dia of dias) {
        if (programaAgrupado[dia] && programaAgrupado[dia].length > 0) {
          
          if (yPos < 100) {
            page = pdfDoc.addPage([841.89, 595.28]);
            yPos = height - 50;
          }

          page.drawText(dia.toUpperCase(), { x: 30, y: yPos, size: 12, font: fontBold, color: rgb(0.15, 0.43, 0.7) });
          yPos -= 20;

          // Cabeceras de tabla
          page.drawText('HORA', { x: 30, y: yPos, size: 8, font: fontBold });
          page.drawText('DISCURSO', { x: 80, y: yPos, size: 8, font: fontBold });
          page.drawText('ORADOR', { x: 350, y: yPos, size: 8, font: fontBold });
          page.drawText('VIE', { x: 620, y: yPos, size: 8, font: fontBold });
          page.drawText('DÍA', { x: 680, y: yPos, size: 8, font: fontBold });
          page.drawText('30 MIN', { x: 740, y: yPos, size: 8, font: fontBold });
          
          yPos -= 8;
          page.drawLine({ start: { x: 30, y: yPos }, end: { x: width - 30, y: yPos }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
          yPos -= 15;

          for (const p of programaAgrupado[dia]) {
            if (yPos < 40) {
              page = pdfDoc.addPage([841.89, 595.28]);
              yPos = height - 50;
            }

            page.drawText(p.hora_inicio || '--:--', { x: 30, y: yPos, size: 9, font: fontBold });
            
            // Truncar textos largos para que quepan
            const temaTxt = `${p.numero_bosquejo ? p.numero_bosquejo + ' ' : ''}${p.tema || ''}`;
            page.drawText(temaTxt.substring(0, 60), { x: 80, y: yPos, size: 9, font });
            
            const oradorTxt = p.nombre_orador ? p.nombre_orador.substring(0, 45) : '---';
            page.drawText(oradorTxt, { x: 350, y: yPos, size: 9, font: fontBold });

            // Creación de Checkboxes Interactivos
            const cbViernes = form.createCheckBox(`v_${p.id}`);
            cbViernes.addToPage(page, { x: 620, y: yPos - 2, width: 12, height: 12 });
            if (p.check_viernes) cbViernes.check();

            const cbDia = form.createCheckBox(`d_${p.id}`);
            cbDia.addToPage(page, { x: 680, y: yPos - 2, width: 12, height: 12 });
            if (p.check_dia) cbDia.check();

            const cb30m = form.createCheckBox(`m_${p.id}`);
            cb30m.addToPage(page, { x: 740, y: yPos - 2, width: 12, height: 12 });
            if (p.check_30m) cb30m.check();

            page.drawText(calcular30MinutosAntes(p.hora_inicio), { x: 760, y: yPos, size: 8, font });

            yPos -= 20; // Siguiente fila
          }
          yPos -= 10; // Espacio entre días
        }
      }

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

      <button class="btn-email-masivo" on:click={enviarEmailMasivo} title="Enviar correo a todos los oradores">
        <Mail size={16} style="margin-right: 6px;"/> Email a todos los oradores
      </button>

      <button class="btn-pdf" on:click={generarPDFPlano}>Generar PDF</button>
      
      <button class="btn-pdf-outline" on:click={generarPDFRellenable}>Generar PDF rellenable</button>
    </div>
  </div>

  <div class="contenido-programa">
    {#each ['viernes', 'sábado', 'domingo'] as dia}
      {#if programaAgrupado[dia] && programaAgrupado[dia].length > 0}
        
        <div class="dia-header">
          <div class="dia-titulo-wrapper">
            <h2 class="dia-titulo">{dia}</h2>
            <p class="dia-fecha">{obtenerFechaEspecifica(asambleaActiva?.fecha, dia)}</p>
          </div>
          
          <div class="tabla-encabezado">
            <div class="th-tiempo">TIEMPO</div>
            <div class="th-discurso">DISCURSO</div>
            <div class="th-orador">ORADOR</div>
            <div class="th-movil">MÓVIL</div>
            <div class="th-check">VIERNES</div>
            <div class="th-check">DIA DE</div>
            <div class="th-check30">30 MINUTOS</div>
          </div>
        </div>

        <div class="filas-contenedor">
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
                          <button class="btn-celular" on:click={() => llamarCelular(tel)} title="Llamar">
                            <Phone size={13}/> {tel}
                          </button>
                          <button class="btn-whatsapp" on:click={() => abrirWhatsApp(tel, parte)} title="Mensaje por WhatsApp">
                            <MessageCircle size={13}/> WhatsApp
                          </button>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  {#if (parte.email_orador && parte.email_orador.trim() !== '') || (parte.email && parte.email.trim() !== '')}
                    <div class="acciones-email-indiv" style="margin-top: 4px;">
                      <button class="btn-email-indiv-icon" on:click={() => abrirEmailIndividual(parte)} title="Enviar Email JWPUB a ${parte.nombre_orador || 'orador'} (${parte.email_orador || parte.email})">
                        <Mail size={16}/> </button>
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
  padding: 0px 0px 0 0px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.top-fijo { flex-shrink: 0; margin-bottom: 10px; }
.header-vista h1 { font-size: 20px; font-weight: 700; color: var(--text-main); margin: 0 0 2px 0; }
.subtitle { font-size: 14px; color: var(--text-sec); margin: 0; }

.controles-vista { display: flex; gap: 10px; margin-top: 20px; align-items: center; }

/* BOTONES */
.btn-email-masivo {
  background-color: var(--accent-danger);
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background 0.2s;
}
.btn-email-masivo:hover { background-color: var(--accent-danger-hover); }

.btn-pdf { background-color: var(--primary); color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn-pdf:hover { background-color: var(--primary-hover); }

.btn-pdf-outline { 
  background-color: transparent; color: var(--primary); 
  border: 2px solid var(--primary); padding: 6px 16px; border-radius: 6px; 
  font-size: 14px; font-weight: 600; cursor: pointer; 
}
.btn-pdf-outline:hover { background-color: rgba(0, 120, 212, 0.1); }

/* TABLA Y GRID */
.contenido-programa { flex: 1; overflow-y: auto; padding-right: 15px; padding-bottom: 40px; }
.dia-header {
  position: sticky; top: 0;
  background-color: var(--bg-card);
  z-index: 10;
  margin: 0 0 10px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  display: flex; flex-direction: column;
}

.dia-titulo-wrapper { padding: 16px 24px; }
.dia-titulo { font-size: 24px; font-weight: 800; color: var(--text-main); margin: 0; }
.dia-fecha { font-size: 13px; color: var(--text-sec); }

.tabla-encabezado, .fila-registro {
  display: grid;
  grid-template-columns: 75px 3.5fr 2.5fr 140px 70px 70px 110px;
  gap: 15px; align-items: center;
}

.tabla-encabezado {
  background-color: var(--bg-body);
  border-top: 1px solid var(--border);
  padding: 8px 24px;
  font-size: 11px; font-weight: 700; color: var(--text-sec);
}

.fila-registro {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 24px;
  min-height: 56px;
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
.discurso-tema { font-size: 13px; color: var(--text-main); }
.orador-nombre { font-size: 13px; font-weight: 600; color: var(--text-main); }
.orador-cong { font-size: 11px; color: var(--text-sec); }

.btn-celular, .btn-whatsapp {
  display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600;
  background: transparent; border: 1px solid transparent; padding: 2px 4px; border-radius: 4px; cursor: pointer;
}
.btn-celular { color: var(--primary); }
.btn-whatsapp { color: var(--accent-success); }
.btn-celular:hover, .btn-whatsapp:hover { background-color: var(--border); }

.btn-email-indiv-icon {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  background: transparent; border: 1px solid transparent; cursor: pointer;
  color: var(--accent-danger);
}
.btn-email-indiv-icon:hover { background-color: var(--border); }

/* RESPONSIVO */
@media (max-width: 768px) {
  .vista-programa-container { padding: 15px; }
  .controles-vista { flex-direction: column; align-items: stretch; }
  .tabla-encabezado { display: none; }
  .fila-registro { grid-template-columns: 1fr; gap: 12px; padding: 15px; }
  .fila-registro > div:nth-child(5)::before { content: "VIERNES: "; font-weight: 700; color: var(--text-sec); }
  .fila-registro > div:nth-child(6)::before { content: "DÍA DE: "; font-weight: 700; color: var(--text-sec); }
  .fila-registro > div:nth-child(7)::before { content: "30 MIN: "; font-weight: 700; color: var(--text-sec); }
}
</style>