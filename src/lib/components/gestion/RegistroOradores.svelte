<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { MessageSquare } from 'lucide-svelte';
  import { Phone, MessageCircle } from 'lucide-svelte';
  import { open as openUrl } from '@tauri-apps/plugin-shell';

  let asambleaActiva: any = null;
  let partes: any[] = [];
  let programaAgrupado: Record<string, any[]> = {};

  onMount(async () => {
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
      const asamblea = JSON.parse(datosGuardados);
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

  async function abrirWhatsApp(telefono: string) {
    let telLimpio = limpiarTelefono(telefono);
    telLimpio = telLimpio.replace(/^\+/, ''); // WhatsApp usa el número sin el '+'
    if (!telLimpio.startsWith('53') && telLimpio.length === 8) {
        telLimpio = '53' + telLimpio;
    }
    try {
        await openUrl(`https://wa.me/${telLimpio}`);
    } catch(e) {
        console.error("Error al abrir WhatsApp:", e);
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
      <button class="btn-pdf">Generar PDF</button>
      <button class="btn-pdf-outline">Generar PDF rellenable</button>
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
                {#if parte.telefono_orador}
                  <div class="acciones-tel">
                    <button class="btn-celular" on:click={() => llamarCelular(parte.telefono_orador)} title="Llamar">
                      <Phone size={13}/> {parte.telefono_orador}
                    </button>
                    <button class="btn-whatsapp" on:click={() => abrirWhatsApp(parte.telefono_orador)} title="Mensaje por WhatsApp">
                      <MessageCircle size={13}/> WhatsApp
                    </button>
                  </div>
                {:else}
                  <span class="sin-datos">---</span>
                {/if}
              </div>

              <div class="td-check"><input type="checkbox" class="caja-check"/></div>
              <div class="td-check"><input type="checkbox" class="caja-check"/></div>
              
              <div class="td-check30">
                <input type="checkbox" class="caja-check"/>
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
    /* La magia de las columnas: Tiempo, Discurso, Orador, Móvil, Check1, Check2, Check30 */
    grid-template-columns: 80px 3.5fr 2fr 130px 70px 70px 110px;
    gap: 15px;
    align-items: center;
  }

  .tabla-encabezado {
    background-color: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 12px 24px;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.5px;
  }

  /* =======================================
     FILAS DE REGISTRO (LAS TARJETAS)
     ======================================= */
  .filas-contenedor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 30px;
  }

  .fila-registro {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 16px 24px;
  }

  .td-tiempo { font-size: 13px; font-weight: 600; color: #475569; }
  
  .td-discurso { display: flex; flex-direction: column; gap: 4px; }
  .discurso-meta strong { font-size: 14px; color: #0f172a; margin-right: 5px; }
  .fuente-tag { font-size: 12px; color: #64748b; }
  .discurso-tema { font-size: 14px; color: #334155; line-height: 1.3; }

  .td-orador { display: flex; flex-direction: column; gap: 2px; }
  .orador-nombre { font-size: 14px; font-weight: 600; color: #1e293b; }
  .orador-cong { font-size: 11px; color: #94a3b8; text-transform: uppercase; }

  /* BOTONES DE TELÉFONO Y WHATSAPP */
  .acciones-tel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }

  .btn-celular, .btn-whatsapp {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    background: transparent;
    border: 1px solid transparent;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
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
</style>