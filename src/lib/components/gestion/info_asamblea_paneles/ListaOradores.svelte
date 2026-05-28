<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openUrl } from '@tauri-apps/plugin-shell';
  import { 
    Mail, AtSign, Globe, Phone, MessageSquare, MessageCircle, 
    Edit2, Calendar, CheckSquare, Square
  } from 'lucide-svelte';

  import { generarContexto } from '$lib/utils/contexto_impresion';
  import { prepararContenidoEmail, prepararAsuntoEmail } from '$lib/utils/contextoEmail';
  import { emailTemplates, obtenerPlantillaPorId, cargarPlantillasEmail } from '$lib/utils/plantillasEmail';
  import { whatsAppTemplates, obtenerPlantillaWhatsAppPorId, cargarPlantillasWhatsApp } from '$lib/utils/plantillasWhatsApp';
  import { prepararContenidoWhatsApp } from '$lib/utils/contextoWhatsApp';

  let asambleaActiva: any = null;
  let oradores: any[] = [];
  let asambleaId: number = 0;

  onMount(async () => {
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
      const asamblea = JSON.parse(datosGuardados);
      asambleaActiva = await invoke('obtener_asamblea_por_id', { id: asamblea.id });
      await cargarOradoresDesdePrograma(asamblea.id);

      await cargarPlantillasEmail();  
      await cargarPlantillasWhatsApp();
    }
  });

  async function cargarOradoresDesdePrograma(idAsamblea: number) {
    try {
      const dias = ['Viernes', 'Sábado', 'Domingo'];
      let oradoresMap = new Map();
      
      for (const dia of dias) {
        const res = await invoke('obtener_programa_dia', { asambleaId: idAsamblea, dia }) as any[];
        
        res.forEach(parte => {
          if (parte.nombre_orador && parte.nombre_orador.trim() !== '') {
            const nombre = parte.nombre_orador.trim();

            if (!oradoresMap.has(nombre)) {
              oradoresMap.set(nombre, {
                nombre: nombre,
                congregacion: parte.congregacion_orador || '---',
                circuito: parte.circuito_orador || '---', // ✅ Añadido circuito
                telefono: parte.telefono_orador || '',
                email: parte.email_orador || '',
                es_betelita: parte.es_betelita || false,  // ✅ Añadido betelita
                es_interprete: parte.es_interprete || false,
                es_visitante: parte.es_visitante || false,// ✅ Añadido visitante
                partesCount: 1,
                parteIds: [parte.id], 
                co11_recibido: parte.estado === 'Confirmado', 
                recordatorio_texto: '',
                recordatorio_fecha: ''
              });
            } else {

              const oradorExistente = oradoresMap.get(nombre);
              oradorExistente.partesCount += 1;
              oradorExistente.parteIds.push(parte.id); 
              
              if (parte.estado === 'Confirmado') {
                oradorExistente.co11_recibido = true; 
              }
            }
          }
        }); // <-- Aquí cierra el forEach
      } // <-- Aquí cierra el for de los días
      
      // Convertir el Map a Array y ordenar alfabéticamente
      oradores = Array.from(oradoresMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (e) {
      console.error("Error al cargar oradores:", e);
    }
  }

  // --- FUNCIONES DE CONTACTO ---
  function limpiarTelefono(tel: string): string {
    return tel.replace(/[\s\-\(\)]/g, '');
  }

  function formatearTelCuba(tel: string): string {
    let limpio = limpiarTelefono(tel);
    if (limpio.length === 8 && limpio.startsWith('5')) return '+53' + limpio;
    return limpio;
  }

  // --- GENERACIÓN DE URL PARA JWPUB (CON PLANTILLA "contacto_orador") ---
 async function obtenerUrlCorreoLista(orador: any): Promise<string | null> {
    const emailDestino = (orador.email || "").trim();
    if (!emailDestino) {
        alert("⚠️ No hay correo registrado para este orador.");
        return null;
    }

    const plantilla = obtenerPlantillaPorId('contacto_orador');
    const asuntoBase = plantilla?.subject || "Información de la Asamblea";
    const cuerpoBase = plantilla?.body || "⚠️ No se ha definido la plantilla de contacto general.";

    // 👇 AQUÍ ES DONDE AGREGAMOS LA FECHA Y MÁS DATOS
    const objetoSimulado = {
        nombre_orador: orador.nombre,
        email_orador: orador.email,
        telefono_orador: orador.telefono,
        congregacion_orador: orador.congregacion,
        circuito_orador: orador.circuito,
        es_betelita: orador.es_betelita,
        es_interprete: orador.es_interprete,
        es_visitante: orador.es_visitante,
        tema: 'Participación en el Programa', 
        tipo_asignacion: 'General',
        // Inyectamos datos de la asamblea global
        fecha: asambleaActiva?.fecha || 'Fecha por definir',
        nombre_del_lugar: asambleaActiva?.lugar || 'Lugar por definir',
        tipo_de_evento: asambleaActiva?.tema || 'Asamblea'
    };

    const contexto = await generarContexto(objetoSimulado, asambleaId, false);
    let asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
    let cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);

    return `https://mail.jwpub.org/owa/#path=/mail/action/compose` +
       `&to=${encodeURIComponent(emailDestino)}` +
       `&subject=${encodeURIComponent(asuntoFinal)}` +
       `&body=${encodeURIComponent(cuerpoFinal)}`;
  }

  // --- GENERACIÓN DE URL PARA WHATSAPP (CON PLANTILLA "contacto_orador") ---
 async function obtenerUrlWhatsAppLista(orador: any): Promise<string | null> {
    const telefono = (orador.telefono || "").trim();
    if (!telefono) {
        alert("⚠️ No hay teléfono registrado para este orador.");
        return null;
    }

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

    // 👇 IGUAL AQUÍ: Agregamos la fecha y datos de asamblea
    const objetoSimulado = {
        nombre_orador: orador.nombre,
        telefono_orador: orador.telefono,
        congregacion_orador: orador.congregacion,
        circuito_orador: orador.circuito,
        es_betelita: orador.es_betelita,
        es_interprete: orador.es_interprete,
        es_visitante: orador.es_visitante,
        tema: 'Participación en el Programa', 
        tipo_asignacion: 'General',
        fecha: asambleaActiva?.fecha || 'Fecha por definir',
        nombre_del_lugar: asambleaActiva?.lugar || 'Lugar por definir',
        tipo_de_evento: asambleaActiva?.tema || 'Asamblea'
    };

    const contexto = await generarContexto(objetoSimulado, asambleaId, false);
    let mensaje = prepararContenidoWhatsApp(cuerpoBase, contexto);
    
    let telWa = limpiarTelefono(telefono).replace(/^\+/, '');
    if (!telWa.startsWith('53') && telWa.length === 8) telWa = '53' + telWa;

    return `https://wa.me/${telWa}?text=${encodeURIComponent(mensaje)}`;
  }

  async function accionContacto(tipo: string, orador: any) {
    const email = orador.email?.trim();
    const tel = orador.telefono?.trim();
    let url = '';

    try {
      switch (tipo) {
        case 'email':
          if (!email) return alert("No hay correo registrado");
          url = `mailto:${email}`;
          break;
        case 'jwpub':
          // 👇 Usa la nueva función de plantilla
          const urlJwpub = await obtenerUrlCorreoLista(orador);
          if (urlJwpub) url = urlJwpub;
          break;
        case 'llamada':
          if (!tel) return alert("No hay teléfono registrado");
          url = `tel:${formatearTelCuba(tel)}`;
          break;
        case 'sms':
          if (!tel) return alert("No hay teléfono registrado");
          url = `sms:${formatearTelCuba(tel)}`;
          break;
        case 'whatsapp':
          // 👇 Usa la nueva función de plantilla
          const urlWa = await obtenerUrlWhatsAppLista(orador);
          if (urlWa) url = urlWa;
          break;
      }
      if (url) await openUrl(url);
    } catch (e) {
      console.error(`Error al abrir ${tipo}:`, e);
    }
  }

  async function toggleCO11(orador: any) {
    const nuevoEstado = !orador.co11_recibido;
    orador.co11_recibido = nuevoEstado;
    oradores = [...oradores]; // Actualiza el color de la tarjeta al instante

    try {
      // Guardamos la confirmación en la base de datos (en todas las partes del orador)
      for (const idParte of orador.parteIds) {
        await invoke('alternar_estado_parte', {
          id: idParte,
          tipoAccion: 'confirmacion',
          valorNuevo: nuevoEstado
        });
      }
    } catch (e) {
      console.error("Error al guardar CO-11:", e);
      alert("Error al guardar en la base de datos: " + e);
      // Si falla la conexión, revertimos el color de la tarjeta
      orador.co11_recibido = !nuevoEstado;
      oradores = [...oradores];
    }
  }

  // En el script de ListaOradores.svelte
async function guardarRecordatorio(orador: any) { // <-- Añadido : any
    try {
      await invoke('guardar_recordatorio_orador', {
        asambleaId: asambleaId, 
        personaId: orador.persona_id || 0, // Ajusta si el campo se llama distinto
        texto: orador.recordatorio_texto,
        fecha: orador.recordatorio_fecha
      });
      alert("✅ Recordatorio guardado");
    } catch (e) {
      alert("❌ Error: " + e);
    }
  }
</script>

<div class="vista-programa-container">
  
  <div class="top-fijo">
    <header class="header-vista">
      <h1>Oradores</h1>
      <p class="subtitle">
        {asambleaActiva?.tema || 'Sin tema'} • Número: {asambleaActiva?.identificador || '000'}
      </p>
    </header>

    <div class="controles-vista">
      <span class="conteo-oradores">{oradores.length} oradores en esta asamblea</span>
      <button class="btn-pdf">Generar directorio PDF</button>
    </div>
  </div>

  <div class="contenido-programa">
    {#if oradores.length === 0}
      <div class="empty-state">No hay oradores asignados en el programa aún.</div>
    {/if}

    <div class="lista-tarjetas">
      {#each oradores as orador}
        <div class="tarjeta-orador {orador.co11_recibido ? 'estado-recibido' : 'estado-pendiente'}">
          
          <div class="tarjeta-header">
            <div class="header-izq">
              <h2>{orador.nombre}</h2>
              <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                {#if !orador.co11_recibido}
                  <span class="badge-alerta">CO-11 needed</span>
                {/if}
                {#if orador.es_betelita}
                  <span style="background: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 500;">Betelita</span>
                {/if}
                {#if orador.es_visitante}
                  <span style="background: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 500;">Visitante</span>
                {/if}
              </div>
            </div>
            <div class="header-der">
              <label class="check-co11">
                <input type="checkbox" checked={orador.co11_recibido} on:change={() => toggleCO11(orador)} />
                <span>CO-11 received</span>
              </label>
              <button class="btn-icon-simple"><Edit2 size={16}/></button>
            </div>
          </div>

          <div class="acciones-circulares">

            <button class="btn-circle" on:click={() => accionContacto('jwpub', orador)} title="Email Jwpub.org">
              <Mail size={16} strokeWidth={1.5}/>
            </button>

            <button class="btn-circle" on:click={() => accionContacto('llamada', orador)} title="Llamar Celular">
              <Phone size={16} strokeWidth={1.5}/>
            </button>

            <button class="btn-circle" on:click={() => accionContacto('sms', orador)} title="Mensaje por Celular">
              <MessageSquare size={16} strokeWidth={1.5}/>
            </button>

            <button class="btn-circle" on:click={() => accionContacto('whatsapp', orador)} title="WhatsApp">
              <MessageCircle size={16} strokeWidth={1.5}/>
            </button>
            
          </div>

          <div class="grid-datos">
            <div class="dato-bloque">
              <span class="dato-lbl">Circuito</span>
              <span class="dato-val" style="font-weight: 700; color: #286eb4;">{orador.circuito}</span>
            </div>
            <div class="dato-bloque">
              <span class="dato-lbl">Congregación</span>
              <span class="dato-val">{orador.congregacion}</span>
            </div>
            <div class="dato-bloque">
              <span class="dato-lbl">Email</span>
              <span class="dato-val highlight">{orador.email || '---'}</span>
            </div>
            <div class="dato-bloque">
              <span class="dato-lbl">JWPub Email</span>
              <span class="dato-val highlight">{orador.email?.includes('jwpub') ? orador.email : '---'}</span>
            </div>
            <div class="dato-bloque">
              <span class="dato-lbl">Mobile</span>
              <span class="dato-val highlight">{orador.telefono || '---'}</span>
            </div>
            <div class="dato-bloque">
              <span class="dato-lbl">Home Phone</span>
              <span class="dato-val">---</span>
            </div>
          </div>

          <div class="recordatorio-zona">
            <span class="dato-lbl">Recordatorio</span>
            <div class="recordatorio-inputs">
              <textarea placeholder="Agregue una nota para este orador." bind:value={orador.recordatorio_texto}></textarea>
              
              <div class="controles-rec">
                <input type="date" class="input-fecha-rec" bind:value={orador.recordatorio_fecha}/>
                <button class="btn-guardar-rec" disabled={!orador.recordatorio_fecha}>Guardar recordatorio</button>
              </div>
            </div>
          </div>

        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  /* ESTRUCTURA PRINCIPAL */
  .vista-programa-container {
    background-color: #f8fafc; height: 100%; display: flex; flex-direction: column;
    padding: 30px 40px 0 40px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    overflow: hidden;
  }
  .top-fijo { flex-shrink: 0; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; }
  .header-vista h1 { font-size: 26px; font-weight: 800; color: #1e293b; margin: 0 0 5px 0; }
  .subtitle { font-size: 14px; color: #64748b; margin: 0; }
  .controles-vista { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .conteo-oradores { font-size: 14px; color: #64748b; font-weight: 500; }
  
  .btn-pdf { background-color: #286eb4; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  .btn-pdf:hover { background-color: #1d4ed8; }

  .contenido-programa { flex: 1; overflow-y: auto; padding-right: 15px; padding-bottom: 40px; }
  .contenido-programa::-webkit-scrollbar { width: 8px; }
  .contenido-programa::-webkit-scrollbar-track { background: transparent; }
  .contenido-programa::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

  .lista-tarjetas { display: flex; flex-direction: column; gap: 20px; margin-top: 10px; }

  /* =======================================
     TARJETA DE ORADOR Y SUS ESTADOS DE COLOR
     ======================================= */
  .tarjeta-orador {
    border-radius: 8px;
    padding: 24px;
    transition: all 0.3s ease;
  }

  /* ESTADO: PENDIENTE (Azulita clara) */
  .estado-pendiente {
    background-color: #f0f9ff; /* Azul muy claro */
    border: 1px solid #bae6fd; /* Borde azul claro */
  }

  /* ESTADO: RECIBIDO (Blanca) */
  .estado-recibido {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  }

  /* CABECERA DE LA TARJETA */
  .tarjeta-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
  .header-izq { display: flex; align-items: center; gap: 12px; }
  .header-izq h2 { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; }
  
  .badge-alerta { background-color: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
  
  .header-der { display: flex; align-items: center; gap: 15px; }
  .check-co11 { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: #475569; font-weight: 500; }
  .check-co11 input { 
    width: 16px; 
    height: 16px; 
    cursor: pointer; 
    accent-color: #286eb4; 
    /* Forzar visibilidad por encima del CSS global */
    appearance: auto !important;
    -webkit-appearance: checkbox !important;
    display: inline-block !important;
    visibility: visible !important;
    opacity: 1 !important;
  }

  .btn-icon-simple { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; }
  .btn-icon-simple:hover { color: #475569; }

  .partes-count { font-size: 13px; color: #64748b; margin: 0 0 15px 0; }

  /* BOTONES CIRCULARES DE CONTACTO */
  .acciones-circulares { display: flex; gap: 10px; margin-bottom: 25px; }
  .btn-circle {
    width: 36px; height: 36px; border-radius: 50%;
    background-color: #ffffff; border: 1px solid #e2e8f0;
    display: flex; align-items: center; justify-content: center;
    color: #64748b; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    transition: all 0.2s;
  }
  .btn-circle:hover { color: #286eb4; border-color: #286eb4; transform: translateY(-2px); }

  /* CUADRÍCULA DE DATOS */
  .grid-datos { display: grid; grid-template-columns: 1fr 1fr; row-gap: 15px; column-gap: 20px; margin-bottom: 25px; }
  .dato-bloque { display: flex; flex-direction: column; gap: 4px; }
  .dato-lbl { font-size: 12px; font-weight: 700; color: #0f172a; }
  .dato-val { font-size: 13px; color: #475569; }
  .dato-val.highlight { color: #286eb4; font-weight: 500; }

  /* ZONA DE RECORDATORIO */
  .recordatorio-zona { display: flex; flex-direction: column; gap: 8px; }
  .recordatorio-inputs { display: flex; gap: 10px; align-items: stretch; }
  
  .recordatorio-inputs textarea {
    flex: 1; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px;
    font-size: 13px; font-family: inherit; resize: vertical; outline: none; min-height: 76px; background: #ffffff;
  }
  .recordatorio-inputs textarea:focus { border-color: #286eb4; }

  .controles-rec { display: flex; flex-direction: column; justify-content: space-between; width: 170px; }
  
  .input-fecha-rec { 
    width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; 
    font-size: 13px; outline: none; background: #ffffff; box-sizing: border-box; height: 38px; color: #475569;
  }
  
  .btn-guardar-rec { 
    background-color: #cbd5e1; color: #ffffff; border: none; border-radius: 6px; 
    font-weight: 600; font-size: 12.5px; height: 38px; cursor: not-allowed; transition: all 0.2s;
  }
  
  /* Magia: Si tiene fecha (no está deshabilitado), se pone Azul Oscuro */
  .btn-guardar-rec:not(:disabled) {
    background-color: #1e3a8a; /* Azul oscuro elegante */
    color: white;
    cursor: pointer;
  }
  
  .btn-guardar-rec:not(:disabled):hover { 
    background-color: #1e40af; /* Un tono más brillante al pasar el ratón */
  }

  /* RESPONSIVO MÓVIL */
  @media (max-width: 768px) {
    .vista-programa-container { padding: 20px; }
    .controles-vista { flex-direction: column; align-items: stretch; gap: 15px; }
    .header-izq { flex-direction: column; align-items: flex-start; gap: 5px; }
    .grid-datos { grid-template-columns: 1fr; }
    .recordatorio-inputs { flex-direction: column; align-items: stretch; }
    .controles-rec { width: 100%; }
  }
</style>