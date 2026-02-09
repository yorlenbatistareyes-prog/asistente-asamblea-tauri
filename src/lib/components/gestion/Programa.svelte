<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { open as openUrl } from '@tauri-apps/plugin-shell';
  import { slide } from 'svelte/transition'; 
  
  // --- NUEVO: Utilidad de impresión (usa jsPDF internamente) ---
  import { generarCartaPDF } from '$lib/utils/impresion'; 
  
  import { 
    Users, Video, Mic, Search, X, Plus, Trash2, FileUp, 
    MapPin, Phone, Mail, UserPlus, UserMinus, ChevronRight, ChevronDown, ChevronUp,
    FileCheck, UserCheck, User, Printer, FileJson, Edit, Clock, MessageCircle, FileSpreadsheet, Settings, CheckSquare
  } from 'lucide-svelte';

  // --- ESTADO ---
  let asambleaId = 0; 
  let diaSeleccionado = 'Viernes';
  let partes: any[] = []; 
  
  let oficina: { [key: string]: any } = {
      personal: [] as any[],
      presidente_manana: null, oracion_apertura: null, bosquejos_manana: null, plataforma_manana: null,
      presidente_tarde: null, oracion_conclusion: null, bosquejos_tarde: null, plataforma_tarde: null
  };

  // --- MODALS ---
  let mostrarModalAsignar = false; 
  let mostrarModalCrear = false;   
  let mostrarModalGestionOficina = false;

  let parteEditando: any = null; 
  let rolOficinaEditando: string | null = null; 
  let asignacionOficinaActual: any = null; 
  
  let listaHermanos: any[] = []; 
  let terminoBusqueda = "";
  let nuevaParte = { hora: '', tema: '', tipo: 'Discurso', duracion: 10, sesion: 'Mañana', nombre_orador: '', congregacion: '', email: '', telefono: '' };
  
  let sugerenciasOradores: any[] = [];
  let mostrarSugerencias = false;

  onMount(() => {
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        asambleaId = JSON.parse(datosGuardados).id;
        cargarDatos();
        cargarHermanos();
    } else {
        alert("⚠️ No hay asamblea seleccionada.");
    }
  });

  async function cargarDatos() {
    if (!asambleaId) return;
    
    const abiertos = new Set(partes.filter(p => p._expanded).map(p => p.id));

    try { 
        const res = await invoke('obtener_programa_dia', { asambleaId, dia: diaSeleccionado }) as any[]; 
        partes = res.map(p => ({ 
            ...p, 
            _expanded: abiertos.has(p.id), 
            esta_presente: p.esta_presente || false,
            email_enviado: false, 
            carta_recibida_check: false, 
            jwpub_enviado: false, 
            recordatorio_enviado: false, 
            ensayo_terminado: false
        }));
    } catch (e) { console.error(e); }
    
    try { 
        const datos = await invoke('obtener_asignaciones_especiales', { asambleaId, dia: diaSeleccionado }) as any[]; 
        organizarOficina(datos); 
    } catch (e) { console.error(e); }
  }

  function organizarOficina(datos: any[]) {
      oficina = { personal: [], presidente_manana: null, oracion_apertura: null, bosquejos_manana: null, plataforma_manana: null, presidente_tarde: null, oracion_conclusion: null, bosquejos_tarde: null, plataforma_tarde: null };
      datos.forEach(d => {
          d.estado = d.estado || 'Pendiente';
          d.esta_presente = d.esta_presente || false;
          d.ensayo_terminado = d.ensayo_terminado || false;
          d.carta_recibida_check = false;

          if (d.tipo_asignacion === 'personal_oficina') oficina.personal.push(d);
          else if (oficina.hasOwnProperty(d.tipo_asignacion)) oficina[d.tipo_asignacion] = d;
      });
      oficina = { ...oficina };
  }

  async function cargarHermanos() { 
    if (!asambleaId) return;
    listaHermanos = await invoke('obtener_personas', { asambleaId }) as any[]; 
  }

  $: if (diaSeleccionado && asambleaId) cargarDatos();

  function toggleExpandir(id: number) {
      partes = partes.map(p => {
          if (p.id === id) return { ...p, _expanded: !p._expanded };
          return p; 
      });
  }

  async function eliminarAsignacionOficina(idAsignacion: number) {
      if (!confirm("¿Quitar a este hermano?")) return;
      try {
          await invoke('eliminar_asignacion_especial', { id: idAsignacion });
          mostrarModalGestionOficina = false;
          cargarDatos(); 
      } catch (e) { alert("Error: " + e); }
  }

  function prepararDatosOficina(asignacion: any) {
      const datosCompletos = listaHermanos.find(h => h.id === asignacion.persona_id || h.nombre_completo === asignacion.nombre_completo) || {};
      return {
          ...asignacion,
          telefono_visual: asignacion.telefono || asignacion.telefono_persona || datosCompletos.telefono || '',
          email_visual: asignacion.email || asignacion.email_persona || datosCompletos.email || '',
          congregacion_visual: asignacion.nombre_congregacion || datosCompletos.nombre_congregacion || ''
      };
  }

  function actualizarVistaOficina(objeto: any) {
      if (mostrarModalGestionOficina && objeto) {
          if (objeto.es_personal) {
              const idx = oficina.personal.findIndex((p: any) => p.id === objeto.id);
              if (idx >= 0) oficina.personal[idx] = { ...objeto };
          } else if (objeto.rol_key) {
              oficina[objeto.rol_key] = { ...objeto };
          }
          oficina = { ...oficina }; 
          asignacionOficinaActual = { ...objeto }; 
      }
  }

  async function toggleStatus(objeto: any, campo: string) {
      objeto[campo] = !objeto[campo];
      partes = partes; 
      actualizarVistaOficina(objeto);
  }

  async function toggleConfirmado(objeto: any) {
      const nuevoEstado = (objeto.estado === 'Confirmado') ? 'Pendiente' : 'Confirmado';
      objeto.estado = nuevoEstado;
      partes = partes; 
      actualizarVistaOficina(objeto);
  }

  async function togglePresente(objeto: any) {
      objeto.esta_presente = !objeto.esta_presente;
      partes = partes;
      actualizarVistaOficina(objeto);
  }

  function enviarWhatsApp(objeto: any) {
      const tel = objeto.telefono_visual || objeto.telefono_orador || objeto.telefono; 
      const nombre = objeto.nombre_orador || objeto.nombre_completo;

      if (!tel) return alert("No hay teléfono registrado.");
      const numero = tel.replace(/\D/g, ''); 
      const mensaje = `Hola hermano ${nombre}, le escribimos con respecto a su asignación en la Asamblea Regional.`;
      const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
      openUrl(url).catch(e => console.error(e));
  }

  function abrirJWPUBCarta(objeto: any) {
      const email = objeto.email_visual || objeto.email_orador || objeto.email;
      if (!email) return alert("⚠️ No hay correo registrado para este hermano.");
      const url = `https://mail.jwpub.org/owa/?path=/mail/action/compose&to=${encodeURIComponent(email)}`;
      openUrl(url).catch(e => console.error(e));
      objeto.jwpub_enviado = true;
      partes = partes;
      actualizarVistaOficina(objeto);
  }

  function abrirJWPUBRecordatorio(objeto: any) {
      const email = objeto.email_visual || objeto.email_orador || objeto.email;
      if (!email) return alert("⚠️ No hay correo registrado para este hermano.");
      const url = `https://mail.jwpub.org/owa/?path=/mail/action/compose&to=${encodeURIComponent(email)}`;
      openUrl(url).catch(e => console.error(e));
      objeto.recordatorio_enviado = true;
      partes = partes;
      actualizarVistaOficina(objeto);
  }

  // --- NUEVA LÓGICA DE IMPRESIÓN (CORREGIDA) ---
  // Se conecta a las plantillas de CORRESPONDENCIA (cartas), no de email.
  async function procesarImpresion(objeto: any, esPartePrograma: boolean) {
      if (!objeto || !asambleaId) {
          alert("⚠️ Error: No hay asamblea activa o datos del hermano.");
          return;
      }

      console.log("🖨️ Iniciando impresión para:", objeto.nombre_orador || objeto.nombre_completo);

      try {
          // 1. Obtener datos extra (ensayos, dirección del local) desde Rust
          const infoEvento: any = await invoke('obtener_info_extra_evento', { asambleaId });
          
          // 2. Preparar el paquete de datos para los marcadores [[ ]]
          const datosCombinados = {
              nombre: (objeto.nombre_orador || objeto.nombre_completo || 'Hermano').trim(),
              tema: objeto.tema || (esPartePrograma ? 'Discurso' : 'Asignación Especial'),
              
              // Si es discurso usamos el número, si es oficina usamos el tipo de rol
              numero_bosquejo: objeto.numero_bosquejo || objeto.tipo || '',
              
              fecha_asignacion: objeto.fecha || diaSeleccionado,
              hora_asignacion: objeto.hora_inicio || objeto.hora || '---',
              
              // Buscamos la congregación en todas las variantes posibles del objeto
              congregacion: objeto.congregacion_orador || objeto.nombre_congregacion || objeto.congregacion_visual || '',
              
              // Datos que vienen de la tabla 'asambleas' en Rust
              lugar: infoEvento?.lugar || 'Salón de Asambleas',
              direccion: infoEvento?.direccion || '',
              fecha_ensayo: infoEvento?.fecha_ensayo || '---',
              hora_ensayo: infoEvento?.hora_ensayo || '---'
          };

          // 3. SELECCIÓN DE ID DE PLANTILLA (Clave para evitar el texto por defecto)
          let plantillaId = ''; 
          
          if (esPartePrograma) {
              // Este debe ser EXACTAMENTE el ID que usas en el editor de Correspondencia
              plantillaId = 'oradores'; 
          } else {
              const rol = (objeto.tipo_asignacion || '').toLowerCase();
              
              if (rol.includes('presidente')) {
                  plantillaId = 'presidentes';
                  datosCombinados.tema = 'Presidente de la Sesión';
              } else if (rol.includes('oracion')) {
                  plantillaId = 'oraciones';
                  datosCombinados.tema = 'Oración';
              } else {
                  plantillaId = 'oficina'; 
              }
          }

          // 4. Llamar a la utilidad de impresión
          console.log("📄 Generando PDF con ID de plantilla:", plantillaId);
          await generarCartaPDF(datosCombinados, plantillaId);

      } catch (e) {
          console.error("❌ Error en el proceso de impresión:", e);
          alert("Error al preparar los datos: " + e);
      }
  }

  function clickEnOficina(key: string, asignacion: any) {
      if (asignacion) {
          const datos = prepararDatosOficina(asignacion);
          asignacionOficinaActual = { ...datos, rol_key: key };
          mostrarModalGestionOficina = true;
      } else {
          abrirModalOficina(key);
      }
  }

  function clickEnPersonal(persona: any) {
      const datos = prepararDatosOficina(persona);
      asignacionOficinaActual = { ...datos, es_personal: true };
      mostrarModalGestionOficina = true;
  }

  function abrirModalPrograma(parte: any) { parteEditando = parte; rolOficinaEditando = null; terminoBusqueda = ""; mostrarModalAsignar = true; }
  function abrirModalOficina(rol: string) { rolOficinaEditando = rol; parteEditando = null; terminoBusqueda = ""; mostrarModalAsignar = true; }
  
  function cerrarModales() { 
      mostrarModalAsignar = false; mostrarModalCrear = false; mostrarModalGestionOficina = false;
      parteEditando = null; rolOficinaEditando = null; asignacionOficinaActual = null;
  }

  async function asignarOrador(oradorId: number | null, esVideo: boolean) {
    if (oradorId === null && !esVideo) return;
    try {
        if (parteEditando) {
            await invoke('asignar_parte', { idParte: parteEditando.id, oradorId, esVideo });
        } else if (rolOficinaEditando && oradorId) {
            await invoke('guardar_asignacion_especial', { asambleaId, dia: diaSeleccionado, tipoAsignacion: rolOficinaEditando, personaId: oradorId });
        }
        cerrarModales(); cargarDatos();
    } catch (e) { alert(e); }
  }

  async function guardarNuevaParte() {
    if(!nuevaParte.hora || !nuevaParte.tema) return alert("Falta datos");
    try {
      await invoke('crear_parte', { 
        asambleaId, dia: diaSeleccionado, sesion: nuevaParte.sesion, hora: nuevaParte.hora, tema: nuevaParte.tema, tipo: nuevaParte.tipo, duracion: Number(nuevaParte.duracion), 
        nombreOrador: nuevaParte.nombre_orador || null, congregacion: nuevaParte.congregacion || null, email: nuevaParte.email || null, telefono: nuevaParte.telefono || null 
      });
      mostrarModalCrear = false; nuevaParte = { hora: '', tema: '', tipo: 'Discurso', duracion: 10, sesion: 'Mañana', nombre_orador: '', congregacion: '', email: '', telefono: '' };
      cargarDatos(); cargarHermanos(); 
    } catch (e) { alert(e); }
  }

  async function limpiarTodo() { if(confirm("¿Borrar todo el programa de ESTE DÍA?")) { await invoke('limpiar_programa', { asambleaId }); cargarDatos(); } }
  async function eliminarParte(id: number) { if(confirm("¿Eliminar?")) { await invoke('eliminar_parte', { id }); cargarDatos(); } }
  
  async function importarPrograma() { 
      try { 
          const f = await openDialog({ filters: [{ name: 'CSV', extensions: ['csv'] }] }); 
          if(f) { await invoke('importar_programa_jw', { asambleaId, rutaArchivo: f }); cargarDatos(); cargarHermanos(); } 
      } catch(e) { alert(e); } 
  }

  async function obtenerTodosLosEmails() {
      const emails = new Set<string>();
      const dias = ['Viernes', 'Sábado', 'Domingo'];
      for (const dia of dias) {
          try {
              const res = await invoke('obtener_programa_dia', { asambleaId, dia }) as any[];
              res.forEach(parte => { if (parte.email_orador && parte.email_orador.trim() && !parte.es_video) emails.add(parte.email_orador.trim()); });
          } catch (e) { console.error(e); }
      }
      return Array.from(emails);
  }

  function enviarJWPUBATodos() {
      obtenerTodosLosEmails().then(emails => {
          if (emails.length === 0) return alert("⚠️ No hay correos de oradores registrados.");
          const url = `https://mail.jwpub.org/owa/?path=/mail/action/compose&to=${encodeURIComponent(emails.join(';'))}`;
          openUrl(url).catch(e => console.error(e));
      });
  }

  function filtrarOradores() { const t = nuevaParte.nombre_orador.toLowerCase(); if(t.length<2){sugerenciasOradores=[];mostrarSugerencias=false;return;} sugerenciasOradores = listaHermanos.filter(h => h.nombre_completo.toLowerCase().includes(t)); mostrarSugerencias = sugerenciasOradores.length > 0; }
  function selectSugerencia(h: any) { nuevaParte.nombre_orador = h.nombre_completo; nuevaParte.congregacion = h.nombre_congregacion || ''; nuevaParte.telefono = h.telefono || ''; nuevaParte.email = h.email || ''; mostrarSugerencias = false; }
  
  $: hermanosFiltrados = listaHermanos.filter(h => h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase()));
  const nombreTxt = (obj: any) => obj ? obj.nombre_completo : "Seleccionar...";
</script>

<div class="layout-programa">
  <aside class="panel-oficina dark-theme">
    <div class="header-oficina-dark"><h3><Users size={20}/> Oficina</h3><span class="badge-dark">{diaSeleccionado}</span></div>
    <div class="contenido-oficina">
        
        <div class="seccion-oficina">
            <h4 class="titulo-seccion">PERSONAL</h4>
            <div class="lista-personal">
                {#each oficina.personal as p}
                    <div class="item-personal clickable" role="button" tabindex="0" on:click={() => clickEnPersonal(p)} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && clickEnPersonal(p)}>
                        <div class="info-personal">
                            <span class="nombre-p">{p.nombre_completo}</span>
                            <div class="indicadores-mini">
                                {#if p.estado === 'Confirmado'}<div class="dot-icon blue" title="Recibido"><FileCheck size={10} strokeWidth={3}/></div>{/if}
                                {#if p.esta_presente}<div class="dot-icon green" title="Presente"><UserCheck size={10} strokeWidth={3}/></div>{/if}
                                {#if p.ensayo_terminado}<div class="dot-icon yellow" title="Ensayo"><Mic size={10} strokeWidth={3}/></div>{/if}
                            </div>
                        </div>
                        <Settings size={14} class="icon-gear"/>
                    </div>
                {/each}
                {#if oficina.personal.length === 0}<span class="vacio">(Vacío)</span>{/if}
            </div>
            <button class="btn-add-dark" on:click={() => abrirModalOficina('personal_oficina')}><UserPlus size={14}/> Añadir</button>
        </div>
        
        <div class="separador-dark"></div>
        
        <div class="seccion-oficina">
            <h4 class="titulo-seccion">MAÑANA</h4>
            {#each [{ label: 'Presidente', key: 'presidente_manana' }, { label: 'Oración', key: 'oracion_apertura' }, { label: 'Bosquejos', key: 'bosquejos_manana' }, { label: 'Plataforma', key: 'plataforma_manana' }] as item, idx}
                <div class="campo-dark">
                    <label for="btn_manana_{idx}">{item.label}</label>
                    <button id="btn_manana_{idx}" class="btn-select-dark" class:ocupado={oficina[item.key]} on:click={() => clickEnOficina(item.key, oficina[item.key])}>
                        <div class="btn-content-left">
                            <span class="text-truncate">{nombreTxt(oficina[item.key])}</span>
                            {#if oficina[item.key]}
                                <div class="indicadores-mini">
                                    {#if oficina[item.key].estado === 'Confirmado'}<div class="dot-icon blue"><FileCheck size={10} strokeWidth={3}/></div>{/if}
                                    {#if oficina[item.key].esta_presente}<div class="dot-icon green"><UserCheck size={10} strokeWidth={3}/></div>{/if}
                                    {#if oficina[item.key].ensayo_terminado}<div class="dot-icon yellow"><Mic size={10} strokeWidth={3}/></div>{/if}
                                </div>
                            {/if}
                        </div>
                        {#if oficina[item.key]} <Settings size={14} class="icon-gear"/> {:else} <ChevronRight size={14}/> {/if}
                    </button>
                </div>
            {/each}
        </div>

        <div class="seccion-oficina mt-4">
            <h4 class="titulo-seccion">TARDE</h4>
            {#each [{ label: 'Presidente', key: 'presidente_tarde' }, { label: 'Oración', key: 'oracion_conclusion' }, { label: 'Bosquejos', key: 'bosquejos_tarde' }, { label: 'Plataforma', key: 'plataforma_tarde' }] as item, idx}
                <div class="campo-dark">
                    <label for="btn_tarde_{idx}">{item.label}</label>
                    <button id="btn_tarde_{idx}" class="btn-select-dark" class:ocupado={oficina[item.key]} on:click={() => clickEnOficina(item.key, oficina[item.key])}>
                        <div class="btn-content-left">
                            <span class="text-truncate">{nombreTxt(oficina[item.key])}</span>
                            {#if oficina[item.key]}
                                <div class="indicadores-mini">
                                    {#if oficina[item.key].estado === 'Confirmado'}<div class="dot-icon blue"><FileCheck size={10} strokeWidth={3}/></div>{/if}
                                    {#if oficina[item.key].esta_presente}<div class="dot-icon green"><UserCheck size={10} strokeWidth={3}/></div>{/if}
                                    {#if oficina[item.key].ensayo_terminado}<div class="dot-icon yellow"><Mic size={10} strokeWidth={3}/></div>{/if}
                                </div>
                            {/if}
                        </div>
                        {#if oficina[item.key]} <Settings size={14} class="icon-gear"/> {:else} <ChevronRight size={14}/> {/if}
                    </button>
                </div>
            {/each}
        </div>
    </div>
  </aside>

  <main class="panel-discursos">
    <div class="tabs">
      {#each ['Viernes', 'Sábado', 'Domingo'] as dia}<button class:active={diaSeleccionado === dia} on:click={() => diaSeleccionado = dia}>{dia}</button>{/each}
    </div>

    <div class="header-sesion">
      <div class="header-sesion-left">
        <h2>Programa - {diaSeleccionado}</h2>
        <button class="btn-header-orange" on:click={enviarJWPUBATodos} title="Enviar a todos los oradores de los 3 días"><FileJson size={18}/> <span>JWPUB a Todos</span></button>
      </div>
      <div class="acciones-header">
        <button class="btn-header-csv" on:click={importarPrograma} title="Importar desde JW (CSV)"><FileSpreadsheet size={18}/> <span>Importar</span></button>
        <button class="btn-header-delete" on:click={limpiarTodo} title="Borrar todo el programa"><Trash2 size={18}/> <span>Limpiar</span></button>
        <button class="btn-primary" on:click={() => mostrarModalCrear = true}><Plus size={18}/> <span>Agregar</span></button>
      </div>
    </div>

    <div class="lista-partes">
      {#if partes.length === 0}<div class="empty-state"><p>Programa vacío para este día.</p></div>{/if}
      
      {#each partes as parte}
    <div class="tarjeta-acordeon" 
         class:expanded={parte._expanded}
         class:estado-presente={parte.esta_presente}
         class:estado-confirmado={parte.estado === 'Confirmado' && !parte.esta_presente}
         class:estado-ensayo={parte.ensayo_terminado && !parte.esta_presente && parte.estado !== 'Confirmado'}>
        
        <div class="header-parte" role="button" tabindex="0" on:click={() => toggleExpandir(parte.id)} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpandir(parte.id)}>
            <div class="col-tiempo">
                <span class="hora">{parte.hora_inicio}</span>
                <span class="duracion">({parte.duracion}m)</span>
            </div>
            <div class="col-tema">
                <span class="tema-txt">{parte.tema}</span>
                {#if parte.es_video}<span class="badge-video"><Video size={12}/> Video</span>{/if}
            </div>
            <div class="col-orador-mini">
                {#if !parte.es_video}
                    <span class="orador-nombre">{parte.nombre_orador || "Sin asignar"}</span>
                    {#if parte.congregacion_orador}<span class="cong-mini">{parte.congregacion_orador}</span>{/if}
                {/if}
            </div>
            <div class="col-estados-mini">
                {#if parte.estado === 'Confirmado'}<div class="icon-indicator blue" title="Asignación Recibida"><FileCheck size={14}/></div>{/if}
                {#if parte.esta_presente}<div class="icon-indicator green" title="Presente"><UserCheck size={14}/></div>{/if}
                {#if parte.ensayo_terminado}<div class="icon-indicator yellow" title="Ensayo"><Mic size={14}/></div>{/if}
            </div>
            <div class="col-toggle">
                {#if parte._expanded}<ChevronUp size={20} color="var(--text-secondary)"/>{:else}<ChevronDown size={20} color="var(--text-secondary)"/>{/if}
            </div>
        </div>

        {#if parte._expanded}
            <div class="body-parte" transition:slide={{ duration: 200 }}>
                {#if !parte.es_video}
                    <div class="fila-superior-control">
                        <div class="info-orador-full">
                            <span class="label-tiny">ORADOR:</span>
                            <strong>{parte.nombre_orador || "---"}</strong>
                            <div class="detalles-contacto-panel">
                                {#if parte.congregacion_orador}<span class="cong-tag">{parte.congregacion_orador}</span>{/if}
                                {#if parte.telefono_orador}<span class="contact-pill"><Phone size={11}/> {parte.telefono_orador}</span>{/if}
                                {#if parte.email_orador}<span class="contact-pill"><Mail size={11}/> {parte.email_orador}</span>{/if}
                            </div>
                        </div>
                        <div class="checks-grandes">
                            <button class="btn-status-toggle blue" class:active={parte.estado === 'Confirmado'} on:click={() => toggleConfirmado(parte)}><FileCheck size={18} /><span>RECIBIDO</span></button>
                            <button class="btn-status-toggle green" class:active={parte.esta_presente} on:click={() => togglePresente(parte)}><UserCheck size={18} /><span>PRESENTE</span></button>
                            <button class="btn-status-toggle yellow" class:active={parte.ensayo_terminado} on:click={() => toggleStatus(parte, 'ensayo_terminado')}><Mic size={18} /><span>ENSAYO</span></button>
                        </div>
                    </div>
                    <div class="grid-acciones">
                        <div class="grupo-accion">
                            <button class="btn-outline-blue"><Mail size={16}/> ENVIAR CARTA POR EMAIL</button>
                            <div class="checks-row">
                                <label class="check-inline"><input type="checkbox" checked={parte.email_enviado} on:change={() => toggleStatus(parte, 'email_enviado')}> Email enviado</label>
                                <label class="check-inline strong-check"><input type="checkbox" checked={parte.carta_recibida_check} on:change={() => toggleStatus(parte, 'carta_recibida_check')}> Carta Recibida</label>
                            </div>
                        </div>
                        
                        <div class="grupo-accion center">
                            <button class="btn-outline-gray" on:click={() => procesarImpresion(parte, true)}>
                                <Printer size={16}/> IMPRIMIR CARTA
                            </button>
                        </div>

                        <div class="grupo-accion right">
                            <button class="btn-outline-orange" on:click={() => abrirJWPUBCarta(parte)}><FileJson size={16}/> JWPUB ENVIAR CARTA</button>
                            <label class="check-inline"><input type="checkbox" checked={parte.jwpub_enviado} on:change={() => toggleStatus(parte, 'jwpub_enviado')}> Email JWPUB enviado</label>
                        </div>
                        
                        <div class="grupo-accion">
                            <button class="btn-outline-blue"><Clock size={16}/> RECORDATORIO DE ASIGNACIÓN / EMAIL</button>
                            <label class="check-inline"><input type="checkbox" checked={parte.recordatorio_enviado} on:change={() => toggleStatus(parte, 'recordatorio_enviado')}> Recordatorio enviado</label>
                        </div>
                        <div class="grupo-accion center"><button class="btn-outline-green" on:click={() => enviarWhatsApp(parte)}><MessageCircle size={16}/> RECORDATORIO ENSAYO POR WHATSAPP</button></div>
                        <div class="grupo-accion right"><button class="btn-outline-orange" on:click={() => abrirJWPUBRecordatorio(parte)}><FileJson size={16}/> JWPUB RECORDATORIO DE ASIGNACIÓN</button></div>
                    </div>
                {/if}
                <div class="footer-tools">
                    <button class="btn-tool edit" on:click={() => abrirModalPrograma(parte)}><Edit size={14}/> Editar Datos / Asignar</button>
                    <button class="btn-tool delete" on:click={() => eliminarParte(parte.id)}><Trash2 size={14}/> Eliminar Parte</button>
                </div>
            </div>
        {/if}
    </div>
{/each}
    </div>
  </main>
</div>

{#if mostrarModalGestionOficina && asignacionOficinaActual}
  <div class="modal-backdrop" role="button" tabindex="0" on:click|self={cerrarModales} on:keydown={(e) => e.key === 'Escape' && cerrarModales()}>
    <div class="modal modal-gestion">
      <div class="modal-header header-gestion">
          <div class="titulo-gestion"><h3>Gestión de Asignación</h3><span class="subtitulo-rol">{asignacionOficinaActual.tipo_asignacion?.replace('_', ' ').toUpperCase() || 'PERSONAL'}</span></div>
          <button class="btn-close" on:click={cerrarModales}><X size={20}/></button>
      </div>
      <div class="modal-body body-gestion">
          <div class="fila-superior-control">
              <div class="info-orador-full">
                  <span class="label-tiny">HERMANO ASIGNADO:</span>
                  <strong>{asignacionOficinaActual.nombre_completo || asignacionOficinaActual.nombre_orador}</strong>
                  <div class="detalles-contacto-panel">
                      {#if asignacionOficinaActual.congregacion_visual}
                          <span class="cong-tag">{asignacionOficinaActual.congregacion_visual}</span>
                      {/if}
                      {#if asignacionOficinaActual.telefono_visual}
                          <span class="contact-pill"><Phone size={11}/> {asignacionOficinaActual.telefono_visual}</span>
                      {/if}
                      {#if asignacionOficinaActual.email_visual}
                          <span class="contact-pill"><Mail size={11}/> {asignacionOficinaActual.email_visual}</span>
                      {/if}
                  </div>
              </div>
              <div class="checks-grandes">
                  <button class="btn-status-toggle blue" class:active={asignacionOficinaActual.estado === 'Confirmado'} on:click={() => toggleConfirmado(asignacionOficinaActual)}><FileCheck size={18} /><span>RECIBIDO</span></button>
                  <button class="btn-status-toggle green" class:active={asignacionOficinaActual.esta_presente} on:click={() => togglePresente(asignacionOficinaActual)}><UserCheck size={18} /><span>PRESENTE</span></button>
                  <button class="btn-status-toggle yellow" class:active={asignacionOficinaActual.ensayo_terminado} on:click={() => toggleStatus(asignacionOficinaActual, 'ensayo_terminado')}><Mic size={18} /><span>ENSAYO</span></button>
              </div>
          </div>
          <div class="divider"></div>
          <div class="grid-acciones">
              <div class="grupo-accion">
                  <button class="btn-outline-blue"><Mail size={16}/> ENVIAR CARTA POR EMAIL</button>
                  <div class="checks-row">
                      <label class="check-inline"><input type="checkbox" checked={asignacionOficinaActual.email_enviado} on:change={() => toggleStatus(asignacionOficinaActual, 'email_enviado')}> Email enviado</label>
                      <label class="check-inline strong-check"><input type="checkbox" checked={asignacionOficinaActual.carta_recibida_check} on:change={() => toggleStatus(asignacionOficinaActual, 'carta_recibida_check')}> Carta Recibida</label>
                  </div>
              </div>
              
              <div class="grupo-accion center">
                  <button class="btn-outline-gray" on:click={() => procesarImpresion(asignacionOficinaActual, false)}>
                      <Printer size={16}/> IMPRIMIR CARTA
                  </button>
              </div>

              <div class="grupo-accion right">
                  <button class="btn-outline-orange" on:click={() => abrirJWPUBCarta(asignacionOficinaActual)}><FileJson size={16}/> JWPUB ENVIAR CARTA</button>
                  <label class="check-inline"><input type="checkbox" checked={asignacionOficinaActual.jwpub_enviado} on:change={() => toggleStatus(asignacionOficinaActual, 'jwpub_enviado')}> Email JWPUB enviado</label>
              </div>
              
              <div class="grupo-accion">
                  <button class="btn-outline-blue"><Clock size={16}/> RECORDATORIO DE ASIGNACIÓN / EMAIL</button>
                  <label class="check-inline"><input type="checkbox" checked={asignacionOficinaActual.recordatorio_enviado} on:change={() => toggleStatus(asignacionOficinaActual, 'recordatorio_enviado')}> Recordatorio enviado</label>
              </div>
              <div class="grupo-accion center"><button class="btn-outline-green" on:click={() => enviarWhatsApp(asignacionOficinaActual)}><MessageCircle size={16}/> RECORDATORIO ENSAYO POR WHATSAPP</button></div>
              <div class="grupo-accion right"><button class="btn-outline-orange" on:click={() => abrirJWPUBRecordatorio(asignacionOficinaActual)}><FileJson size={16}/> JWPUB RECORDATORIO DE ASIGNACIÓN</button></div>
          </div>
      </div>
      <div class="modal-footer footer-gestion">
          <button class="btn-delete-full" on:click={() => eliminarAsignacionOficina(asignacionOficinaActual.id)}><Trash2 size={16}/> Quitar a este hermano de la asignación</button>
      </div>
    </div>
  </div>
{/if}

{#if mostrarModalCrear}
  <div class="modal-backdrop" role="button" tabindex="0" on:click|self={cerrarModales} on:keydown={(e) => e.key === 'Escape' && cerrarModales()}>
    <div class="modal">
      <div class="modal-header"><h3>Nueva Parte</h3><button class="btn-close" on:click={cerrarModales}><X size={18}/></button></div>
      <div class="modal-body form-body">
        <h4 class="form-title">Detalles</h4>
        <div class="fila">
             <div class="campo"><label for="sesion_select">Sesión</label><select id="sesion_select" bind:value={nuevaParte.sesion}><option>Mañana</option><option>Tarde</option></select></div>
            <div class="campo"><label for="hora_input">Hora</label><input id="hora_input" type="time" bind:value={nuevaParte.hora} /></div>
            <div class="campo"><label for="duracion_input">Min</label><input id="duracion_input" type="number" bind:value={nuevaParte.duracion} /></div>
        </div>
        <div class="campo"><label for="tipo_select">Tipo</label><select id="tipo_select" bind:value={nuevaParte.tipo}><option>Cántico</option><option>Discurso</option><option>Simposio</option><option>Video</option></select></div>
        <div class="campo"><label for="tema_input">Tema</label><input id="tema_input" type="text" placeholder="Tema..." bind:value={nuevaParte.tema} /></div>
        {#if nuevaParte.tipo !== 'Video'}
            <div class="separator-line"></div>
            <h4 class="form-title">Asignación Rápida</h4>
            <div class="campo autocomplete-container">
                <label for="orador_input">Orador</label><div class="input-icon"><Mic size={14}/><input id="orador_input" type="text" placeholder="Nombre..." bind:value={nuevaParte.nombre_orador} on:input={filtrarOradores} on:blur={() => setTimeout(()=>mostrarSugerencias=false, 200)}/></div>
                {#if mostrarSugerencias}
                    <div class="sugerencias-lista">{#each sugerenciasOradores as s}<button class="sugerencia-item" on:click={() => selectSugerencia(s)}>{s.nombre_completo}</button>{/each}</div>
                {/if}
            </div>
            {#if nuevaParte.nombre_orador.length > 0}
                <div class="campo"><label for="cong_input">Congregación</label><div class="input-icon"><MapPin size={14}/><input id="cong_input" type="text" placeholder="Cong..." bind:value={nuevaParte.congregacion} /></div></div>
                <div class="fila"><div class="campo"><label for="tel_input_modal">Tel</label><div class="input-icon"><Phone size={14}/><input id="tel_input_modal" type="text" bind:value={nuevaParte.telefono} /></div></div><div class="campo"><label for="email_input_modal">Email</label><div class="input-icon"><Mail size={14}/><input id="email_input_modal" type="text" bind:value={nuevaParte.email} /></div></div></div>
            {/if}
        {/if}
        <button class="btn-guardar" on:click={guardarNuevaParte}>Guardar</button>
      </div>
    </div>
  </div>
{/if}

{#if mostrarModalAsignar}
  <div class="modal-backdrop" role="button" tabindex="0" on:click|self={cerrarModales} on:keydown={(e) => e.key === 'Escape' && cerrarModales()}>
    <div class="modal">
      <div class="modal-header"><h3>Asignar</h3><button class="btn-close" on:click={cerrarModales}><X size={18}/></button></div>
      <div class="modal-body">
        <div class="buscador"><Search size={16} color="var(--text-secondary)"/><input type="text" placeholder="Buscar..." bind:value={terminoBusqueda} /></div>
        <div class="lista-opciones">
          {#if !rolOficinaEditando}<button class="item-opcion video-option" on:click={() => asignarOrador(null, true)}><div class="icono-video"><Video size={18}/></div><span>Video</span></button>{/if}
          {#each hermanosFiltrados as h}<button class="item-opcion" on:click={() => asignarOrador(h.id, false)}><div class="avatar">{h.nombre_completo.charAt(0)}</div><div class="datos-opcion"><span class="nombre">{h.nombre_completo}</span><span class="detalle">{h.nombre_congregacion || '-'}</span></div></button>{/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
/* ... (ESTILOS SIN CAMBIOS) ... */
.layout-programa { display: grid; grid-template-columns: 280px 1fr; gap: 20px; height: 100%; overflow: hidden; }
.panel-oficina.dark-theme { background: var(--bg-card); color: var(--text-main); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border-color); }
.header-oficina-dark { background: var(--bg-body); padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); }
.header-oficina-dark h3 { margin: 0; font-size: 15px; display: flex; gap: 8px; color: var(--text-main); }
.badge-dark { background: var(--primary); color: white; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; }
.contenido-oficina { padding: 15px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; }
.titulo-seccion { color: var(--text-secondary); font-size: 10px; font-weight: 700; letter-spacing: 1px; margin: 0 0 10px 0; }
.lista-personal { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.item-personal { display: flex; justify-content: space-between; align-items: center; background: var(--bg-body); padding: 6px 10px; border-radius: 6px; font-size: 13px; border: 1px solid var(--border-color); }
.item-personal.clickable { cursor: pointer; transition: background 0.2s; } .item-personal.clickable:hover { background: var(--hover-bg); }
.info-personal { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
.btn-add-dark { background: none; border: 1px dashed var(--text-secondary); color: var(--text-secondary); width: 100%; padding: 8px; border-radius: 6px; cursor: pointer; display: flex; justify-content: center; gap: 6px; font-size: 12px; }
.separador-dark { height: 1px; background: var(--border-color); }
.campo-dark { margin-bottom: 12px; } .campo-dark label { font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 3px; }
.btn-select-dark { width: 100%; background: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-main); padding: 8px 10px; border-radius: 6px; text-align: left; cursor: pointer; font-size: 13px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; }
.btn-select-dark:hover { border-color: var(--primary); }
.btn-select-dark.ocupado { background: var(--bg-secondary); border-color: var(--primary); color: var(--text-main); }
.btn-content-left { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.indicadores-mini { display: flex; gap: 4px; margin-top: 2px; align-items: center; }
.dot-icon { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; }
.dot-icon.blue { background: #3b82f6; color: white; } .dot-icon.green { background: #10b981; color: white; } .dot-icon.yellow { background: #eab308; color: white; }
.panel-discursos { background: var(--bg-card); border-radius: 10px; border: 1px solid var(--border-color); display: flex; flex-direction: column; overflow: hidden; }
.header-sesion { padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); gap: 15px; } .header-sesion-left { display: flex; align-items: center; gap: 12px; } .header-sesion h2 { margin: 0; font-size: 18px; color: var(--text-main); }
.tabs { display: flex; background: var(--bg-body); border-bottom: 1px solid var(--border-color); } .tabs button { flex: 1; padding: 15px; border: none; background: none; font-weight: 600; color: var(--text-secondary); cursor: pointer; border-bottom: 3px solid transparent; } .tabs button.active { color: var(--primary); border-bottom-color: var(--primary); background: var(--bg-card); }
.lista-partes { padding: 20px; overflow-y: auto; flex: 1; background: var(--bg-body); }
.acciones-header { display: flex; gap: 10px; }
.btn-header-csv { background: var(--bg-card); border: 1px solid #10b981; color: #10b981; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; transition: all 0.2s; } .btn-header-csv:hover { background: #ecfdf5; }
.btn-header-delete { background: var(--bg-card); border: 1px solid #ef4444; color: #ef4444; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; transition: all 0.2s; } .btn-header-delete:hover { background: #fef2f2; }
.btn-header-orange { background: var(--bg-card); border: 1px solid #f97316; color: #f97316; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; transition: all 0.2s; } .btn-header-orange:hover { background: #fff7ed; }
.btn-primary { background: var(--primary); color: white; padding: 8px 16px; border-radius: 6px; border: none; display: flex; gap: 6px; cursor: pointer; align-items: center; font-size: 12px; font-weight: 600; }
.tarjeta-acordeon { background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 10px; overflow: hidden; transition: box-shadow 0.2s; } .tarjeta-acordeon:hover { box-shadow: 0 4px 6px var(--shadow-color); } .tarjeta-acordeon.expanded { border-color: var(--text-secondary); box-shadow: 0 4px 12px var(--shadow-color); }
.header-parte { display: flex; align-items: center; padding: 12px 15px; cursor: pointer; gap: 15px; background: var(--bg-card); } .header-parte:hover { background: var(--hover-bg); }
.col-tiempo { display: flex; flex-direction: column; min-width: 60px; } .hora { font-weight: 800; color: var(--primary); font-size: 14px; } .duracion { font-size: 11px; color: var(--text-secondary); }
.col-tema { flex: 1; display: flex; flex-direction: column; } .tema-txt { font-weight: 600; color: var(--text-main); font-size: 14px; line-height: 1.2; }
.badge-video { font-size: 10px; background: var(--bg-body); color: var(--text-secondary); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; width: fit-content; margin-top: 4px; }
.col-orador-mini { width: 180px; display: flex; flex-direction: column; } .orador-nombre { font-weight: 600; color: var(--text-main); font-size: 13px; text-transform: uppercase; } .cong-mini { font-size: 11px; color: var(--text-secondary); }
.col-estados-mini { display: flex; gap: 6px; min-width: 60px; justify-content: flex-end; align-items: center; }
.icon-indicator { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; }
.icon-indicator.green { background: #ecfdf5; color: #10b981; } .icon-indicator.blue { background: #eff6ff; color: #3b82f6; } .icon-indicator.yellow { background: #fefce8; color: #ca8a04; }
.col-toggle { color: var(--text-secondary); margin-left: 10px; }
.body-parte { border-top: 1px solid var(--border-color); background: var(--bg-body); padding: 15px 20px; }
.fila-superior-control { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.info-orador-full { display: flex; flex-direction: column; gap: 3px; } .label-tiny { font-size: 10px; font-weight: bold; color: var(--text-secondary); letter-spacing: 0.5px; } .info-orador-full strong { font-size: 16px; color: var(--text-main); }
.detalles-contacto-panel { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 3px; }
.cong-tag { background: var(--hover-bg); color: var(--text-main); font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 600; }
.contact-pill { display: flex; align-items: center; gap: 4px; background: var(--bg-card); border: 1px solid var(--border-color); padding: 3px 8px; border-radius: 4px; font-size: 11px; color: var(--text-secondary); }
.checks-grandes { display: flex; gap: 10px; align-items: center; }
.btn-status-toggle { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: var(--bg-card); border: 1px solid var(--border-color); padding: 5px 2px; width: 70px; border-radius: 6px; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; }
.btn-status-toggle span { font-size: 8.5px; font-weight: 800; text-transform: uppercase; }
.btn-status-toggle.blue.active { background: #eff6ff; border-color: #3b82f6; color: #2563eb; } .btn-status-toggle.green.active { background: #ecfdf5; border-color: #10b981; color: #059669; } .btn-status-toggle.yellow.active { background: #fefce8; border-color: #eab308; color: #ca8a04; }
.grid-acciones { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
.grupo-accion { display: flex; flex-direction: column; gap: 5px; } .grupo-accion.center { align-items: center; } .grupo-accion.right { align-items: flex-end; }
.btn-outline-blue { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--bg-card); border: 1px solid #2563eb; color: #2563eb; padding: 8px 4px; border-radius: 4px; font-weight: 600; font-size: 11px; cursor: pointer; text-transform: uppercase; transition: all 0.2s; text-align: center; } .btn-outline-blue:hover { background: #eff6ff; }
.btn-outline-orange { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--bg-card); border: 1px solid #ea580c; color: #ea580c; padding: 8px 4px; border-radius: 4px; font-weight: 600; font-size: 11px; cursor: pointer; text-transform: uppercase; transition: all 0.2s; text-align: center; } .btn-outline-orange:hover { background: #fff7ed; }
.btn-outline-gray { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--bg-card); border: 1px solid var(--text-secondary); color: var(--text-secondary); padding: 8px 4px; border-radius: 4px; font-weight: 600; font-size: 11px; cursor: pointer; text-transform: uppercase; text-align: center; } .btn-outline-gray:hover { background: var(--hover-bg); color: var(--text-main); }
.btn-outline-green { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--bg-card); border: 1px solid #10b981; color: #10b981; padding: 8px 4px; border-radius: 4px; font-weight: 600; font-size: 11px; cursor: pointer; text-transform: uppercase; text-align: center; } .btn-outline-green:hover { background: #ecfdf5; }
.check-inline { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); cursor: pointer; }
.checks-row { display: flex; flex-direction: column; gap: 2px; }
.strong-check { color: var(--text-main); font-weight: 600; font-size: 11px; }
.footer-tools { display: flex; justify-content: flex-end; gap: 15px; border-top: 1px solid var(--border-color); padding-top: 15px; }
.btn-tool { background: none; border: none; font-size: 12px; display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text-secondary); } .btn-tool:hover { color: var(--primary); text-decoration: underline; } .btn-tool.delete:hover { color: #ef4444; }
.modal-gestion { width: 750px; max-width: 95vw; }
.header-gestion { background: var(--bg-card); color: var(--text-main); padding: 20px; border-bottom: none; }
.titulo-gestion h3 { margin: 0; font-size: 20px; font-weight: 600; }
.subtitulo-rol { font-size: 12px; background: #3b82f6; padding: 2px 8px; border-radius: 4px; font-weight: bold; margin-top: 5px; display: inline-block; color: white; }
.body-gestion { padding: 30px; background: var(--bg-body); }
.divider { height: 1px; background: var(--border-color); margin: 25px 0; }
.footer-gestion { padding: 15px 30px; background: var(--bg-card); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; }
.btn-delete-full { color: #ef4444; background: #fef2f2; border: 1px solid #fee2e2; padding: 10px 20px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; } .btn-delete-full:hover { background: #fee2e2; border-color: #fecaca; }
.btn-close { color: var(--text-secondary); opacity: 0.7; background: none; border: none; cursor: pointer; } .btn-close:hover { opacity: 1; }
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal { background: var(--bg-card); width: 450px; border-radius: 12px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border-color); }
.modal-header { padding: 15px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; } .modal-header h3 { color: var(--text-main); margin: 0; }
.modal-body { padding: 20px; overflow-y: auto; background: var(--bg-body); }
.buscador { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); } .buscador input { border: none; outline: none; flex: 1; background: transparent; color: var(--text-main); }
.lista-opciones { margin-top: 10px; }
.item-opcion { display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-card); border: none; border-bottom: 1px solid var(--border-color); cursor: pointer; width: 100%; text-align: left; } .item-opcion:hover { background: var(--hover-bg); } 
.avatar { width: 32px; height: 32px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--text-secondary); }
.datos-opcion { display: flex; flex-direction: column; } .nombre { font-weight: 600; font-size: 14px; color: var(--text-main); } .detalle { font-size: 12px; color: var(--text-secondary); }
.autocomplete-container { position: relative; }
.sugerencias-lista { position: absolute; top: 100%; left: 0; width: 100%; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; box-shadow: 0 4px 10px var(--shadow-color); z-index: 100; max-height: 200px; overflow-y: auto; margin-top: 5px; }
.sugerencia-item { display: flex; justify-content: space-between; width: 100%; padding: 10px; border: none; background: var(--bg-card); text-align: left; cursor: pointer; border-bottom: 1px solid var(--border-color); color: var(--text-main); } .sugerencia-item:hover { background: var(--hover-bg); }
.form-title { margin: 0; font-size: 14px; border-left: 3px solid var(--primary); padding-left: 8px; color: var(--text-main); } .separator-line { height: 1px; background: var(--border-color); margin: 10px 0; }
.campo { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; } .campo label { font-size: 12px; font-weight: bold; color: var(--text-secondary); }
.campo input, .campo select { padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; background: var(--input-bg); color: var(--text-main); }
.input-icon { position: relative; display: flex; align-items: center; } .input-icon :global(svg) { position: absolute; left: 10px; color: var(--text-secondary); } .input-icon input { padding-left: 32px; width: 100%; }
.fila { display: flex; gap: 15px; } .fila .campo { flex: 1; }
.btn-guardar { background: var(--primary); color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }

/* --- COLORES DINÁMICOS PARA FILAS --- */

/* Estado: Presente (Verde suave) */
.tarjeta-acordeon.estado-presente {
    border-left: 6px solid #10b981 !important;
    background-color: #f0fdf4;
}
.tarjeta-acordeon.estado-presente:hover {
    background-color: #dcfce7;
}

/* Estado: Confirmado / Recibido (Azul suave) */
.tarjeta-acordeon.estado-confirmado {
    border-left: 6px solid #3b82f6 !important;
    background-color: #eff6ff;
}
.tarjeta-acordeon.estado-confirmado:hover {
    background-color: #dbeafe;
}

/* Estado: Ensayo Terminado (Amarillo/Naranja suave) */
.tarjeta-acordeon.estado-ensayo {
    border-left: 6px solid #eab308 !important;
    background-color: #fefce8;
}
.tarjeta-acordeon.estado-ensayo:hover {
    background-color: #fef9c3;
}

/* Ajuste para que el encabezado no oculte el color de fondo */
.header-parte {
    background: transparent !important;
}

/* Efecto de pulso para los que están presentes (Opcional pero útil) */
.estado-presente .icon-indicator.green {
    animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
</style>