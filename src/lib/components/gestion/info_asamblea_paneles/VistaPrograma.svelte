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
      const docDefinition: TDocumentDefinitions = {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 40],
        content: [
          { text: 'Programa de Asamblea', style: 'header' },
          { text: `${asambleaActiva?.tema || 'Sin tema'} • Número: ${asambleaActiva?.identificador || '000'}`, style: 'subheader' }
        ],
        styles: {
          header: { fontSize: 22, bold: true, color: '#1e293b', margin: [0, 0, 0, 4] },
          subheader: { fontSize: 12, color: '#64748b', margin: [0, 0, 0, 20] },
          diaTitulo: { fontSize: 16, bold: true, color: '#2563eb', margin: [0, 15, 0, 5] },
          sesionTitulo: { fontSize: 11, bold: true, color: '#475569', margin: [0, 10, 0, 5], characterSpacing: 1 },
          tablaHeader: { bold: true, fontSize: 10, color: '#64748b', margin: [0, 4, 0, 4] },
          celdaHora: { fontSize: 10, bold: true, color: '#475569', margin: [0, 4, 0, 4] },
          celdaNormal: { fontSize: 10, margin: [0, 4, 0, 4], color: '#0f172a' },
          textoGris: { fontSize: 8, color: '#94a3b8' }
        }
      };

      // Si hay un día específico seleccionado, imprimimos solo ese. Si no, todos.
      const diasAImprimir = filtroDia === 'Todos los dias' 
        ? ['viernes', 'sábado', 'domingo'] 
        : [filtroDia.toLowerCase()];

      diasAImprimir.forEach(dia => {
        if (programaAgrupado[dia]) {
         (docDefinition.content as Content[]).push({ text: dia.toUpperCase(), style: 'diaTitulo' });

          ['MAÑANA', 'TARDE'].forEach(sesion => {
            if (programaAgrupado[dia][sesion] && programaAgrupado[dia][sesion].length > 0) {
              
              (docDefinition.content as Content[]).push({ text: sesion, style: 'sesionTitulo' });

              const body: any[] = [];
              
              // No le ponemos fondo a la cabecera para que se vea más como un programa clásico
              body.push([
                { text: 'HORA', style: 'tablaHeader' },
                { text: 'DISCURSO', style: 'tablaHeader' },
                { text: 'ORADOR', style: 'tablaHeader' }
              ]);

              programaAgrupado[dia][sesion].forEach((p: any) => {
                const numBosquejo = p.numero_bosquejo ? `${p.numero_bosquejo} ` : '';
                const fuenteTag = formatearFuente(p.fuente);

                body.push([
                  { text: p.hora_inicio || '--:--', style: 'celdaHora' },
                  { text: [{ text: numBosquejo, bold: true }, { text: p.tema || '' }], style: 'celdaNormal' },
                  { text: [{ text: `${p.nombre_orador || '---'}\n`, bold: true }, { text: fuenteTag, style: 'textoGris' }], style: 'celdaNormal' }
                ]);
              });

              (docDefinition.content as Content[]).push({
                table: {
                  headerRows: 1,
                  widths: ['auto', '*', '*'],
                  body: body
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 15]
              });
            }
          });
        }
      });

      // Si no hay datos (ej. si filtró un día vacío)
      if (partesFiltradas.length === 0) {
          (docDefinition.content as Content[]).push({ text: 'No hay datos del programa para mostrar en este filtro.', margin: [0, 20, 0, 0], italics: true, color: 'gray' });
      }

      // Generar y Guardar
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
    background-color: #f8fafc;
    height: 100%; /* Toma toda la altura disponible */
    display: flex;
    flex-direction: column; /* Apila la cabecera y la lista */
    padding: 30px 40px 0 40px; /* Sin padding abajo para que la lista llegue al borde */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    overflow: hidden; /* Evita que la página entera haga scroll */
  }

  .top-fijo {
    flex-shrink: 0; /* Impide que la cabecera se encoja */
    margin-bottom: 10px;
  }

  /* ENCABEZADO */
  .header-vista h1 { font-size: 26px; font-weight: 800; color: #1e293b; margin: 0 0 5px 0; }
  .subtitle { font-size: 14px; color: #64748b; margin: 0; }

  /* CONTROLES */
  .controles-vista {
    display: flex;
    gap: 15px;
    margin-top: 25px;
    align-items: center;
  }
  .select-dias { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #ffffff; color: #334155; font-size: 14px; outline: none; min-width: 200px; }
  .select-dias:focus { border-color: #2563eb; }
  .btn-pdf { background-color: #2563eb; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  .btn-pdf:hover { background-color: #1d4ed8; }

  /* =======================================
     LA LISTA CON SCROLL INDEPENDIENTE
     ======================================= */
  .contenido-programa {
    flex: 1; /* Ocupa todo el espacio restante debajo de la cabecera */
    overflow-y: auto; /* AQUÍ NACE LA BARRA DE DESPLAZAMIENTO PROPIA */
    padding-right: 15px; /* Espacio para que la barra no muerda las tarjetas */
    padding-bottom: 40px;
  }

  /* PERSONALIZAR LA BARRA DE SCROLL (ESTILO MAC/WINDOWS MODERNO) */
  .contenido-programa::-webkit-scrollbar { width: 8px; }
  .contenido-programa::-webkit-scrollbar-track { background: transparent; }
  .contenido-programa::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .contenido-programa::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  /* =======================================
     DÍAS PEGAJOSOS (ESTILO TARJETA DE LA FOTO)
     ======================================= */
  .dia-header {
    position: sticky;
    top: 0; /* Se pega exactamente arriba */
    background-color: #ffffff; /* Fondo blanco tipo tarjeta */
    z-index: 10;
    padding: 16px 24px;
    margin: 0 0 20px 0;
    border: 1px solid #e2e8f0; /* Borde gris clarito */
    border-radius: 8px; /* Bordes redondeados */
    /* Sombra suave para que parezca que flota sobre los discursos al hacer scroll */
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.03); 
  }

  .dia-titulo { 
    font-size: 24px; 
    font-weight: 800; 
    color: #0f172a; 
    margin: 0; 
    line-height: 1.2;
    text-transform: lowercase; /* Como en tu foto ("viernes", "sábado") */
  }

  .dia-fecha { 
    font-size: 13px; 
    color: #64748b; 
    margin: 2px 0 0 0; 
  }

  .sesion-header { 
    font-size: 13px; 
    font-weight: 600; 
    color: #475569; 
    margin: 5px 0 10px 5px; /* Pequeño margen para alinear con las tarjetas */
    letter-spacing: 0.5px; 
  }

  /* TARJETA DE CADA PARTE (El diseño limpio blanco) */
  .parte-card {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .parte-info-izq {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .parte-hora {
    font-size: 13px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 2px;
  }

  .parte-tema {
    font-size: 15px;
    font-weight: 500;
    color: #0f172a;
  }

  .parte-orador {
    font-size: 13px;
    color: #64748b;
    margin-top: 2px;
  }

  .parte-info-der {
    display: flex;
    align-items: flex-start;
  }

  .parte-meta {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  .empty-state {
    color: #64748b;
    font-style: italic;
    margin-top: 20px;
  }

  /* RESPONSIVO */
  @media (max-width: 768px) {
    .vista-programa-container {
      padding: 20px;
    }
    .controles-vista {
      flex-direction: column;
      align-items: stretch;
    }
    .select-dias {
      width: 100%;
    }
  }
</style>