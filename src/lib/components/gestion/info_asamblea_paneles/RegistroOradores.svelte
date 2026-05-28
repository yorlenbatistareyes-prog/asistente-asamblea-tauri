<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { MessageSquare } from 'lucide-svelte';
  import { Phone, MessageCircle, Mail } from 'lucide-svelte';
  import { generarContexto } from '$lib/utils/contexto_impresion';
  import { prepararContenidoEmail, prepararAsuntoEmail } from '$lib/utils/contextoEmail';
  import { obtenerPlantillaPorId, cargarPlantillasEmail } from '$lib/utils/plantillasEmail';
  import { whatsAppTemplates, obtenerPlantillaWhatsAppPorId, cargarPlantillasWhatsApp } from '$lib/utils/plantillasWhatsApp';
  import { prepararContenidoWhatsApp } from '$lib/utils/contextoWhatsApp';
  
  import { open as openUrl } from '@tauri-apps/plugin-shell';

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
    if (!fuente) return 'InPerson';
    const f = fuente.toLowerCase();
    if (f.includes('video')) return 'Video';
    if (f.includes('stream')) return 'JWStream';
    if (f.includes('remota')) return 'Remote';
    return 'InPerson';
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
    telLimpio = telLimpio.replace(/^\+/, ''); // WhatsApp usa el número sin el '+'
    if (!telLimpio.startsWith('53') && telLimpio.length === 8) {
        telLimpio = '53' + telLimpio;
    }

    // 1. Buscar la plantilla de contacto general en el almacén de WhatsApp
    let plantilla = obtenerPlantillaWhatsAppPorId('contacto_orador');
    let cuerpoBase = plantilla?.body || "";

    if (!cuerpoBase) {
        try {
            const res: any = await invoke('obtener_plantilla_mensaje', { id: 'contacto_orador' });
            if (res && res.cuerpo) cuerpoBase = res.cuerpo;
        } catch (e) {
            console.error("Error cargando plantilla WhatsApp contacto_orador:", e);
        }
    }

    if (!cuerpoBase) cuerpoBase = "⚠️ No se ha definido una plantilla de contacto general.";

    // 2. Generar el contexto con los datos del orador actual
    const asId = asambleaActiva?.id || 0;
    const contexto = await generarContexto(parte, asId, false);
    let mensaje = prepararContenidoWhatsApp(cuerpoBase, contexto);

    try {
        // 3. Abrimos la URL incluyendo el mensaje procesado
        await openUrl(`https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`);
    } catch(e) {
        console.error("Error al abrir WhatsApp:", e);
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
    const plantilla = obtenerPlantillaPorId('masivo_general');
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
    const plantilla = obtenerPlantillaPorId('contacto_orador');
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
      
      // Llamamos a Rust para que lo guarde permanentemente
      await invoke('actualizar_check_registro', { 
        id, 
        campo, 
        valor: nuevoValor 
      });

      // Actualizamos la interfaz visualmente sin recargar todo
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
            <p class="dia-fecha">{asambleaActiva?.fecha || ''}</p>
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
     ESTRUCTURA PRINCIPAL (IGUAL A VISTA PROGRAMA)
     ======================================= */
  .vista-programa-container {
    background-color: #f8fafc;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 30px 40px 0 40px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    overflow: hidden;
  }

  .top-fijo { flex-shrink: 0; margin-bottom: 20px; }
  .header-vista h1 { font-size: 26px; font-weight: 800; color: #1e293b; margin: 0 0 5px 0; }
  .subtitle { font-size: 14px; color: #64748b; margin: 0; }

  .controles-vista {
    display: flex; gap: 10px; margin-top: 20px; align-items: center;
  }

  /* ESTILO PARA EL BOTÓN DE EMAIL MASIVO */
  .btn-email-masivo {
    background-color: #9f0d46; /* Color rojo oscuro / magenta similar a la captura */
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }
  .btn-email-masivo:hover { background-color: #7a0935; }

  .btn-pdf { background-color: #286eb4; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  .btn-pdf:hover { background-color: #1d4ed8; }
  
  .btn-pdf-outline { background-color: transparent; color: #286eb4; border: 2px solid #286eb4; padding: 6px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  .btn-pdf-outline:hover { background-color: rgba(40, 110, 180, 0.1); }

  .contenido-programa {
    flex: 1; overflow-y: auto; padding-right: 15px; padding-bottom: 40px;
  }
  .contenido-programa::-webkit-scrollbar { width: 8px; }
  .contenido-programa::-webkit-scrollbar-track { background: transparent; }
  .contenido-programa::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

  /* =======================================
     CABECERA DEL DÍA (STICKY + ENCABEZADOS DE TABLA)
     ======================================= */
  .dia-header {
    position: sticky;
    top: 0;
    background-color: #ffffff;
    z-index: 10;
    margin: 0 0 10px 0;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.03); 
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dia-titulo-wrapper { padding: 16px 24px; }
  .dia-titulo { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2; text-transform: lowercase; }
  .dia-fecha { font-size: 13px; color: #64748b; margin: 2px 0 0 0; }

  /* GRID PARA TABLAS */
  .tabla-encabezado, .fila-registro {
    display: grid;
    /* Ajustamos levemente los anchos para que todo respire mejor */
    grid-template-columns: 75px 3.5fr 2.5fr 140px 70px 70px 110px;
    gap: 15px;
    align-items: center;
  }

  .tabla-encabezado {
    background-color: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 8px 24px; /* <-- Redujimos de 12px a 8px para que sea más compacta */
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.5px;
  }

  /* Centramos los textos de "VIERNES" y "DIA DE" para que coincidan con las cajas */
  .th-check {
    text-align: center;
  }
  
  /* Mantenemos "30 MINUTOS" alineado a la izquierda para que empate con su cajita y la hora */
  .th-check30 {
    text-align: left;
  }

  /* --- CELDAS DE LAS CAJITAS (Sincronizadas con la cabecera) --- */
  .td-check { 
    display: flex; 
    justify-content: center; /* Centrado exacto bajo el texto */
  }
  
  .td-check30 { 
    display: flex; 
    align-items: center; 
    justify-content: flex-start; /* Alineado a la izquierda exacto bajo su texto */
    gap: 8px; 
  }

  /* =======================================
     FILAS DE REGISTRO (LAS TARJETAS)
     ======================================= */
  .filas-contenedor {
    display: flex;
    flex-direction: column;
    gap: 4px; /* <-- Antes era 8px, las pegamos más */
    margin-bottom: 30px;
  }

  .fila-registro {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 24px; /* <-- Antes era 16px arriba/abajo. Ahora es 8px */
    min-height: 56px; /* Asegura un alto mínimo pero compacto */
  }

 .td-tiempo { font-size: 13px; font-weight: 600; color: #475569; }
  
  .td-discurso { display: flex; flex-direction: column; gap: 1px; } /* <-- Menos gap */
  .discurso-meta strong { font-size: 13px; color: #0f172a; margin-right: 5px; } /* Fuente un poquito más pequeña */
  .fuente-tag { font-size: 11px; color: #64748b; }
  .discurso-tema { font-size: 13px; color: #334155; line-height: 1.2; } /* Interlineado más apretado */

  .td-orador { display: flex; flex-direction: column; gap: 0px; } /* <-- Quitamos el gap */
  .orador-nombre { font-size: 13px; font-weight: 600; color: #1e293b; }
  .orador-cong { font-size: 11px; color: #94a3b8; text-transform: uppercase; }

  /* BOTONES DE TELÉFONO Y WHATSAPP */
  .acciones-tel {
    display: flex;
    flex-direction: column;
    gap: 0px; /* <-- Pegamos los dos botones */
    align-items: flex-start;
  }

  .btn-celular, .btn-whatsapp {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px; /* <-- Letra más pequeña */
    font-weight: 600;
    background: transparent;
    border: 1px solid transparent;
    padding: 2px 4px; /* <-- Menos relleno interior */
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .lista-contactos {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* Estilo Email Individual (Rojo Oscuro/Magenta) */
  .btn-email-indiv {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    background: transparent;
    border: 1px solid transparent;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #9f0d46; /* El mismo color de tu botón masivo */
    text-align: left;
    word-break: break-all; /* Por si el correo es muy largo */
  }
  
  .btn-email-indiv:hover {
    background-color: rgba(159, 13, 70, 0.08);
    border-color: rgba(159, 13, 70, 0.2);
  }

  /* NUEVO CSS para el botón de Email SÓLO ICONO */
  .btn-email-indiv-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;  /* Botón pequeño y cuadrado */
    height: 28px;
    border-radius: 6px; /* Bordes redondeados sutiles */
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #9f0d46; /* Tu color rojo oscuro corporativo */
    padding: 0; /* Sin relleno para centrar el icono */
  }

  .btn-email-indiv-icon:hover {
    background-color: rgba(159, 13, 70, 0.08);
    border-color: rgba(159, 13, 70, 0.2);
  }
  
  /* Contenedor opcional para alinear el icono a la izquierda */
  .acciones-email-indiv {
    display: flex;
    justify-content: flex-start;
    align-items: center;
  }

  /* Estilo Llamada Normal (Azul) */
  .btn-celular {
    color: #286eb4;
  }
  .btn-celular:hover {
    background-color: rgba(40, 110, 180, 0.08);
    border-color: rgba(40, 110, 180, 0.2);
  }

  /* Estilo WhatsApp (Verde) */
  .btn-whatsapp {
    color: #16a34a;
  }
  .btn-whatsapp:hover {
    background-color: rgba(22, 163, 74, 0.08);
    border-color: rgba(22, 163, 74, 0.2);
  }

  .sin-datos {
    font-size: 13px;
    color: #cbd5e1;
  }

  .td-check { display: flex; justify-content: center; }
  .td-check30 { display: flex; align-items: center; gap: 8px; }
  .tiempo-30m { font-size: 12px; color: #64748b; }

  .caja-check {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #286eb4;
    margin: 0;
    /* Forzar visibilidad por encima del CSS global */
    appearance: auto !important;
    -webkit-appearance: checkbox !important;
    display: inline-block !important;
    visibility: visible !important;
    opacity: 1 !important;
  }

  /* =======================================
     DISEÑO RESPONSIVO (MÓVILES)
     ======================================= */
  @media (max-width: 768px) {
    /* 1. Ajustar el contenedor para ganar espacio en pantalla */
    .vista-programa-container {
      padding: 15px;
    }

    .controles-vista {
      flex-direction: column;
      align-items: stretch;
    }

    .btn-pdf, .btn-pdf-outline {
      width: 100%;
      justify-content: center;
      text-align: center;
    }

    /* 2. Ocultar la barra de títulos de la tabla (no cabe en móvil) */
    .tabla-encabezado {
      display: none;
    }

    /* 3. Convertir la cuadrícula horizontal en una "Tarjeta" vertical */
    .fila-registro {
      grid-template-columns: 1fr; /* Todo en 1 sola columna */
      gap: 12px;
      padding: 15px;
    }

    /* 4. Separadores visuales y ajustes de tarjeta */
    .td-tiempo {
      font-size: 16px;
      color: #286eb4;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
    }

    .td-movil {
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
    }

    /* Poner los botones de llamadas uno al lado del otro */
    .acciones-tel {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .btn-celular, .btn-whatsapp {
      padding: 8px 12px;
      font-size: 13px;
      border: 1px solid #e2e8f0; /* Borde visible para que parezcan botones táctiles */
    }

    /* 5. EL TRUCO MÁGICO: Crear etiquetas falsas para las cajitas */
    .td-check, .td-check30 {
      justify-content: flex-start; /* Alineamos a la izquierda */
      align-items: center;
    }

    /* Le inyectamos el texto "VIERNES:" al quinto elemento (la 1ra cajita) */
    .fila-registro > div:nth-child(5)::before {
      content: "VIERNES:";
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      width: 90px; /* Ancho fijo para que las cajitas queden alineadas */
    }

    /* Le inyectamos el texto "DÍA DE:" al sexto elemento (la 2da cajita) */
    .fila-registro > div:nth-child(6)::before {
      content: "DÍA DE:";
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      width: 90px;
    }

    /* Le inyectamos el texto "30 MINUTOS:" al séptimo elemento */
    .fila-registro > div:nth-child(7)::before {
      content: "30 MINUTOS:";
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      width: 90px;
    }
  }

  .lista-telefonos {
    display: flex;
    flex-direction: column;
    gap: 12px; /* Separación vertical entre diferentes números de teléfono */
  }

</style>