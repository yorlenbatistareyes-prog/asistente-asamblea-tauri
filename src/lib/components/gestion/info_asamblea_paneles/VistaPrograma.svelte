<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { FileUp } from 'lucide-svelte';

  // --- IMPORTACIONES PARA PDF ---
  import { save } from '@tauri-apps/plugin-dialog';
  import { writeFile } from '@tauri-apps/plugin-fs';
  import pdfMake from 'pdfmake/build/pdfmake';
  import pdfFonts from 'pdfmake/build/vfs_fonts';
  import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

  // Configuración estricta de fuentes
  interface CustomPdfFonts { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string>; }
  interface CustomPdfMake { vfs: Record<string, string>; createPdf: typeof pdfMake.createPdf; }
  const fonts = pdfFonts as unknown as CustomPdfFonts;
  const pdf = pdfMake as unknown as CustomPdfMake;
  pdf.vfs = fonts.pdfMake ? fonts.pdfMake.vfs : (fonts.vfs || {});


  // --- ESTADO ---
  let asambleaActiva: any = null;
  let partes: any[] = [];
  let filtroDia = 'Todos los dias';

  // --- CARGA DE DATOS ---
  onMount(async () => {
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
      const asamblea = JSON.parse(datosGuardados);
      // Obtenemos los detalles de la asamblea para el encabezado (Tema y Número)
      asambleaActiva = await invoke('obtener_asamblea_por_id', { id: asamblea.id });
      await cargarTodoElPrograma(asamblea.id);
    }
  });

  async function cargarTodoElPrograma(idAsamblea: number) {
    try {
      const dias = ['Viernes', 'Sábado', 'Domingo'];
      let todasLasPartes: any[] = [];
      
      for (const dia of dias) {
        const res = await invoke('obtener_programa_dia', { asambleaId: idAsamblea, dia }) as any[];
        const partesConDia = res.map(p => ({ ...p, dia }));
        todasLasPartes = [...todasLasPartes, ...partesConDia];
      }
      
      // Ordenamos por hora para asegurarnos de que la secuencia es correcta
      partes = todasLasPartes.sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
    } catch (e) {
      console.error("Error al cargar programa:", e);
    }
  }

  // --- LÓGICA DE AGRUPACIÓN Y FILTRADO ---
  // 1. Filtramos por el select superior
  $: partesFiltradas = filtroDia === 'Todos los dias' 
      ? partes 
      : partes.filter(p => p.dia.toLowerCase() === filtroDia.toLowerCase());

  // 2. Agrupamos por Día -> Sesión (Mañana/Tarde)
  $: programaAgrupado = agruparPrograma(partesFiltradas);

  function agruparPrograma(lista: any[]) {
    const grupos: Record<string, Record<string, any[]>> = {};
    
    lista.forEach(parte => {
      const dia = parte.dia.toLowerCase();
      const sesion = (parte.sesion || 'Mañana').toUpperCase();

      if (!grupos[dia]) grupos[dia] = {};
      if (!grupos[dia][sesion]) grupos[dia][sesion] = [];

      grupos[dia][sesion].push(parte);
    });

    return grupos;
  }

  // --- UTILIDADES DE FORMATO ---
  function formatearFuente(fuente: string): string {
    if (!fuente) return 'InPerson';
    const f = fuente.toLowerCase();
    if (f.includes('video')) return 'Video';
    if (f.includes('stream')) return 'JWStream';
    if (f.includes('remota')) return 'Remote';
    return 'InPerson';
  }

async function generarPDFPrograma() {
    try {
      // --- HELPER PARA LA FECHA ---
      // Convierte "2026-04-15" a "15 de abril de 2026". Si no es una fecha estándar, la deja como el usuario la escribió.
      // --- HELPER PARA LA FECHA ---
      const formatearFecha = (fechaRaw: string) => {
        if (!fechaRaw) return 'Sin fecha';
        
        try {
          // 1. Verificamos si es un rango que contiene " a "
          if (fechaRaw.includes(' a ')) {
            const fechas = fechaRaw.split(' a ');
            
            // Invertimos YYYY-MM-DD a DD/MM/YYYY para cada lado
            const f1 = fechas[0].trim().split('-').reverse().join('/');
            const f2 = fechas[1].trim().split('-').reverse().join('/');
            
            // Los unimos con el guion que pediste
            return `${f1} - ${f2}`;
          } 
          
          // 2. Si es una sola fecha (sin la "a")
          return fechaRaw.split('-').reverse().join('/');
          
        } catch (e) {
          // Si algo falla, aplicamos tu reemplazo literal por seguridad
          return fechaRaw.replace(/-/g, '/').replace(' a ', ' - ');
        }
      };

      const fechaElegante = formatearFecha(asambleaActiva?.fecha);

      // 1. Definición general del documento y estilos
      const docDefinition: TDocumentDefinitions = {
        pageSize: 'A4',
        pageMargins: [50, 60, 50, 60],
        
        // 2. Cabecera repetitiva
        header: function(currentPage, pageCount, pageSize) {
            if (currentPage > 1) {
                return {
                    text: `${asambleaActiva?.tema || 'Programa'} - Pág. ${currentPage} de ${pageCount}`,
                    alignment: 'right',
                    margin: [0, 20, 50, 0],
                    fontSize: 9,
                    color: '#94a3b8'
                };
            }
            return null;
        },

        content: [
          // 3. Título Principal Centrado
          { text: 'PROGRAMA DE ASAMBLEA', style: 'header', alignment: 'center' },
          { text: asambleaActiva?.tema || 'Sin tema', style: 'subHeaderTema', alignment: 'center' },
          { 
              // 👉 AQUÍ USAMOS LA FECHA FORMATEADA
              text: `Número: ${asambleaActiva?.identificador || '000'} | Fecha: ${fechaElegante}`, 
              style: 'subHeaderMeta', 
              alignment: 'center' 
          },
          // Línea decorativa
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1, lineColor: '#cbd5e1' }], margin: [0, 10, 0, 30] }
        ],

        // 4. Diccionario de Estilos
        styles: {
          header: { fontSize: 24, bold: true, color: '#0f172a', margin: [0, 0, 0, 8], characterSpacing: 1 },
          subHeaderTema: { fontSize: 16, bold: true, color: '#334155', margin: [0, 0, 0, 5] },
          subHeaderMeta: { fontSize: 11, color: '#64748b', margin: [0, 0, 0, 0] },
          
          diaTitulo: { fontSize: 18, bold: true, color: '#2563eb', margin: [0, 20, 0, 10] },
          sesionTitulo: { fontSize: 12, bold: true, color: '#ffffff', background: '#475569', margin: [0, 15, 0, 10], padding: [5, 2, 5, 2], alignment: 'center' },
          
          tablaHeader: { bold: true, fontSize: 10, color: '#1e293b', fillColor: '#f8fafc', margin: [0, 8, 0, 8] },
          celdaHora: { fontSize: 10, bold: true, color: '#334155', margin: [0, 6, 0, 6] },
          celdaNormal: { fontSize: 10, color: '#0f172a', margin: [0, 6, 0, 6], lineHeight: 1.2 },
          textoGris: { fontSize: 8, color: '#64748b', italics: true }
        },
        
        defaultStyle: {
            columnGap: 20
        }
      };

      const diasAImprimir = filtroDia === 'Todos los dias' 
        ? ['viernes', 'sábado', 'domingo'] 
        : [filtroDia.toLowerCase()];

      diasAImprimir.forEach(dia => {
        if (programaAgrupado[dia]) {
         (docDefinition.content as Content[]).push({ text: dia.toUpperCase(), style: 'diaTitulo', pageBreak: 'before' });

          ['MAÑANA', 'TARDE'].forEach(sesion => {
            if (programaAgrupado[dia][sesion] && programaAgrupado[dia][sesion].length > 0) {
              
              (docDefinition.content as Content[]).push({ text: `SESIÓN DE LA ${sesion}`, style: 'sesionTitulo' });

              const body: any[] = [];
              
              body.push([
                { text: 'HORA', style: 'tablaHeader' },
                { text: 'TEMA DEL DISCURSO', style: 'tablaHeader' },
                { text: 'ORADOR', style: 'tablaHeader' }
              ]);

              programaAgrupado[dia][sesion].forEach((p: any) => {
                const numBosquejo = p.numero_bosquejo ? `[${p.numero_bosquejo}] ` : '';
                const fuenteTag = formatearFuente(p.fuente);

                body.push([
                  { text: p.hora_inicio || '--:--', style: 'celdaHora' },
                  { text: [{ text: numBosquejo, bold: true, color: '#2563eb' }, { text: p.tema || '' }], style: 'celdaNormal' },
                  { text: [{ text: `${p.nombre_orador || '---'}\n`, bold: true }, { text: fuenteTag, style: 'textoGris' }], style: 'celdaNormal' }
                ]);
              });

              (docDefinition.content as Content[]).push({
                table: {
                  headerRows: 1,
                  widths: [40, '*', 160], 
                  // 👉 AQUÍ ESTÁ LA MAGIA: Evita que un discurso se corte a la mitad en dos páginas
                  dontBreakRows: true,
                  body: body
                },
                layout: {
                    hLineWidth: function (i: number, node: any) { return (i === 0 || i === node.table.body.length) ? 1 : 0.5; },
                    vLineWidth: function (i: number, node: any) { return 0; },
                    hLineColor: function (i: number, node: any) { return '#e2e8f0'; },
                    paddingTop: function(i: number, node: any) { return 4; },
                    paddingBottom: function(i: number, node: any) { return 4; }
                },
                margin: [0, 0, 0, 25]
              });
            }
          });
        }
      });

      if (docDefinition.content && Array.isArray(docDefinition.content)) {
          const primerDiaIndex = docDefinition.content.findIndex((c: any) => c.style === 'diaTitulo');
          if(primerDiaIndex !== -1) {
              delete (docDefinition.content[primerDiaIndex] as any).pageBreak;
          }
      }

      if (partesFiltradas.length === 0) {
          (docDefinition.content as Content[]).push({ text: 'No hay datos del programa para mostrar en este filtro.', margin: [0, 20, 0, 0], italics: true, color: 'gray' });
      }

      const pdfDocGenerator = pdf.createPdf(docDefinition);
      const blob = await pdfDocGenerator.getBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const binary = new Uint8Array(arrayBuffer);

      let sufijoDia = filtroDia === 'Todos los dias' ? 'Completo' : filtroDia;
      
      const path = await save({
        defaultPath: `Programa_${sufijoDia}_${asambleaActiva?.identificador || '000'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (path) {
        await writeFile(path, binary);
        alert("✅ Programa guardado correctamente.");
      }

    } catch (e) {
      console.error("Error al generar PDF del programa:", e);
      alert("Error al generar el PDF: " + e);
    }
  }
  
</script>

<div class="vista-programa-container">
  
  <div class="top-fijo">
    <header class="header-vista">
      <h1>Programa</h1>
      <p class="subtitle">
        {asambleaActiva?.tema || 'Sin tema'} • Número: {asambleaActiva?.identificador || '000'}
      </p>
    </header>

    <div class="controles-vista">
      <select class="select-dias" bind:value={filtroDia}>
        <option value="Todos los dias">Todos los dias</option>
        <option value="viernes">Viernes</option>
        <option value="sábado">Sábado</option>
        <option value="domingo">Domingo</option>
      </select>

      <button class="btn-pdf" on:click={generarPDFPrograma}>Generar PDF</button>
    </div>
  </div>
  <div class="contenido-programa">
    
    {#each ['viernes', 'sábado', 'domingo'] as dia}
      {#if programaAgrupado[dia]}
        
        <div class="dia-header">
          <h2 class="dia-titulo">{dia}</h2>
          <p class="dia-fecha">{asambleaActiva?.fecha || ''}</p>
        </div>

        {#each ['MAÑANA', 'TARDE'] as sesion}
          {#if programaAgrupado[dia][sesion] && programaAgrupado[dia][sesion].length > 0}
            
            <div class="sesion-header">{sesion}</div>

            {#each programaAgrupado[dia][sesion] as parte}
              <div class="parte-card">
                <div class="parte-info-izq">
                  <span class="parte-hora">{parte.hora_inicio || '--:--'}</span>
                  <span class="parte-tema">{parte.tema || 'Sin tema'}</span>
                  <span class="parte-orador">{parte.nombre_orador || '---'}</span>
                </div>
                
                <div class="parte-info-der">
                  <span class="parte-meta">
                    {formatearFuente(parte.fuente)} {parte.numero_bosquejo ? parte.numero_bosquejo.padStart(2, '0') : ''}
                  </span>
                </div>
              </div>
            {/each}
            
          {/if}
        {/each}

      {/if}
    {/each}

    {#if partesFiltradas.length === 0}
      <div class="empty-state">No hay datos del programa para mostrar.</div>
    {/if}

  </div>
</div>

<style>
  /* =======================================
     ESTRUCTURA PRINCIPAL (PANTALLA FIJA)
     ======================================= */
  .vista-programa-container {
    background-color: var(--bg-body);
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 30px 40px 0 40px;
    overflow: hidden;
  }

  .top-fijo {
    flex-shrink: 0;
    margin-bottom: 10px;
  }

  /* ENCABEZADO */
  .header-vista h1 { font-size: 26px; font-weight: 800; color: var(--text-main); margin: 0 0 5px 0; }
  .subtitle { font-size: 14px; color: var(--text-sec); margin: 0; }

  /* CONTROLES */
  .controles-vista {
    display: flex;
    gap: 15px;
    margin-top: 25px;
    align-items: center;
  }
  .select-dias { 
    padding: 8px 16px; border: 1px solid var(--border); border-radius: 6px; 
    background-color: var(--input-bg); color: var(--text-main); font-size: 14px; 
    outline: none; min-width: 200px; 
  }
  .select-dias:focus { border-color: var(--primary); }
  .btn-pdf { 
    background-color: var(--primary); color: #ffffff; border: none; 
    padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; 
    cursor: pointer; transition: background 0.2s; 
  }
  .btn-pdf:hover { background-color: var(--primary-hover); }

  /* =======================================
     LA LISTA CON SCROLL INDEPENDIENTE
     ======================================= */
  .contenido-programa {
    flex: 1;
    overflow-y: auto;
    padding-right: 15px;
    padding-bottom: 40px;
  }

  /* =======================================
     DÍAS PEGAJOSOS
     ======================================= */
  .dia-header {
    position: sticky;
    top: 0;
    background-color: var(--bg-card);
    z-index: 10;
    padding: 16px 24px;
    margin: 0 0 20px 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
  }

  .dia-titulo { 
    font-size: 24px; font-weight: 800; color: var(--text-main); 
    margin: 0; line-height: 1.2; text-transform: lowercase;
  }

  .dia-fecha { font-size: 13px; color: var(--text-sec); margin: 2px 0 0 0; }
  .sesion-header { font-size: 13px; font-weight: 600; color: var(--text-sec); margin: 5px 0 10px 5px; letter-spacing: 0.5px; }

  /* TARJETA DE CADA PARTE */
  .parte-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .parte-info-izq { display: flex; flex-direction: column; gap: 4px; }
  .parte-hora { font-size: 13px; font-weight: 700; color: var(--text-sec); margin-bottom: 2px; }
  .parte-tema { font-size: 15px; font-weight: 500; color: var(--text-main); }
  .parte-orador { font-size: 13px; color: var(--text-sec); margin-top: 2px; }
  .parte-info-der { display: flex; align-items: flex-start; }
  .parte-meta { font-size: 12px; color: var(--text-sec); font-weight: 500; }
  .empty-state { color: var(--text-sec); font-style: italic; margin-top: 20px; }

  /* RESPONSIVO */
  @media (max-width: 768px) {
    .vista-programa-container { padding: 20px; }
    .controles-vista { flex-direction: column; align-items: stretch; }
    .select-dias { width: 100%; }
  }
</style>