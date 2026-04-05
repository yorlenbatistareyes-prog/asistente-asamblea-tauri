<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { 
    ShieldCheck, Save, Search, X, MapPin, Phone, Mail, 
    User, ChevronDown, Layers, Monitor, Mic, Radio, Users, Plus, Droplet, BookOpen,
     Presentation, Mic2, Home, Building, CalendarDays, ScrollText, FileText, ListTodo,
     ListOrdered, NotepadText, ClipboardList, SlidersHorizontal, Check, Loader, AlertCircle   
  } from 'lucide-svelte';

  import Panel from '$lib/components/ui/Panel.svelte';

  import { open as openUrl } from '@tauri-apps/plugin-shell';
  import { generarContexto } from '$lib/utils/contexto_impresion';
  import { obtenerPlantillaPorId } from '$lib/utils/plantillasEmail';
  import { prepararAsuntoEmail, prepararContenidoEmail } from '$lib/utils/contextoEmail';

  // --- ESTADO DE GUARDADO ---
  let estadoGuardado: 'idle' | 'guardando' | 'guardado' | 'error' = 'idle';

  // --- ESTADO ---
  let asambleaId = 0; // <--- ID DE LA ASAMBLEA ACTUAL
  let asambleaIdentificador = "";
  
  let hermanos: any[] = [];
  let congregaciones: any[] = []; 
  
  let c: any = {
    coord: 0, coord_a: 0, 
    prog: 0, prog_a: 0, aloj: 0, aloj_a: 0,
    av: 0, video: 0, audio: 0, plat: 0
  };

  // --- MODAL ---
  let mostrarModal = false;
  let rolEditando = ""; 
  let terminoBusqueda = "";

  // --- VARIABLES PARA CREACIÓN RÁPIDA ---
  let modoCreacionRapida = false;
  let nuevoNombre = "";
  let nuevoTelefono = "";      
  let nuevoEmail = "";        
  let nuevaCongregacionId = 0; 

  onMount(async () => {
    // 1. RECUPERAR ID
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        const asamblea = JSON.parse(datosGuardados);
        asambleaId = asamblea.id;
        asambleaIdentificador = asamblea.identificador || "Sin ID";
        await recargarTodo();
    } else {
        alert("⚠️ No hay asamblea seleccionada.");
    }
  });

  async function recargarTodo() {
    if (!asambleaId) return;
    try {
      // 2. PEDIR DATOS FILTRADOS POR ASAMBLEA
      const [h, congs, asamblea] = await Promise.all([
        invoke('obtener_personas', { asambleaId }),
        invoke('obtener_congregaciones', { asambleaId }),
        invoke('obtener_asamblea_por_id', { id: asambleaId }) // Este trae la última activa, que coincide con la nuestra
      ]) as [any[], any[], any]; 

      hermanos = h || [];
      congregaciones = congs || [];

      if (asamblea) {
        c = {
          coord: asamblea.coordinador_id || 0,
          coord_a: asamblea.coordinador_aux_id || 0,
          prog: asamblea.prog_super_id || 0,
          prog_a: asamblea.prog_aux_id || 0,
          aloj: asamblea.aloj_super_id || 0,
          aloj_a: asamblea.aloj_aux_id || 0,
          av: asamblea.audio_video_super_id || 0,
          video: asamblea.video_super_id || 0,
          audio: asamblea.audio_super_id || 0,
          plat: asamblea.plataforma_super_id || 0,
          baut: asamblea.bautismo_super_id || 0,
          baut_a: asamblea.bautismo_aux_id || 0
        };
      }
    } catch (e) { 
      console.error("Error al recargar datos:", e); 
    }
  }

  function getDetalles(id: number) {
    if(!id) return null;
    return hermanos.find(h => h.id === id);
  }

  function abrirModal(rol: string) { 
    rolEditando = rol; 
    terminoBusqueda = ""; 
    
    // Resetear formulario de creación
    modoCreacionRapida = false;
    nuevoNombre = "";
    nuevoTelefono = "";
    nuevoEmail = "";
    nuevaCongregacionId = 0;

    mostrarModal = true; 
  }

  async function seleccionar(id: number) { 
    c[rolEditando] = id; 
    mostrarModal = false; 
    await guardar(true); // <-- Auto-guardado silencioso
  }

  async function quitar(rol: string) { 
    c[rol] = 0; 
    await guardar(true); // <-- Auto-guardado silencioso
  }

  // --- CREAR CON DETALLES EN LA ASAMBLEA ACTUAL ---
  async function crearYSeleccionar() {
    if (!nuevoNombre.trim()) return alert("Escribe un nombre");
    
    try {
      // 3. ENVIAR ID AL CREAR
      await invoke('crear_persona', { 
        asambleaId, // <--- Importante
        nombreCompleto: nuevoNombre, 
        genero: "Hombre", 
        privilegios: "Superintendente", 
        idCongregacion: nuevaCongregacionId, 
        telefono: nuevoTelefono, 
        email: nuevoEmail        
      });

      // Recargamos la lista de esta asamblea
      hermanos = await invoke('obtener_personas', { asambleaId }) || [];
      
      const creado = hermanos.find(h => h.nombre_completo === nuevoNombre);
      
      if (creado) {
        await seleccionar(creado.id); // Solo se añade el 'await' aquí
      } else {
        alert("Error al recuperar el nuevo registro");
      }
    } catch (e) {
      alert("Error: " + e);
    }
  }

  async function guardar(silencioso = false) {
    // 1. Mostrar estado "Guardando..."
    estadoGuardado = 'guardando';

    try {
      const n = (val: number) => val === 0 ? null : val;
      
      // Enviamos TODOS los datos al backend (Rust)
      await invoke('guardar_comite', { 
        id: asambleaId, 
        coordinadorId: n(c.coord), 
        coordinadorAuxId: n(c.coord_a),
        progSuperId: n(c.prog), 
        progAuxId: n(c.prog_a),
        alojSuperId: n(c.aloj), 
        alojAuxId: n(c.aloj_a),
        audioVideoId: n(c.av), 
        videoId: n(c.video), 
        audioId: n(c.audio), 
        plataformaId: n(c.plat),
        bautismoSuperId: n(c.baut),
        bautismoAuxId: n(c.baut_a)
      });

    // Pequeño truco UX: Forzamos que el "Guardando..." se vea al menos medio segundo
      // para que el usuario note el cambio visual, ya que Rust es demasiado rápido.
      if (silencioso) {
          await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 2. Mostrar estado "Guardado" fijo
      estadoGuardado = 'guardado';

      if (!silencioso) alert("✅ Comité guardado correctamente");
      
    } catch (e) { 
        console.error("Error al guardar comité:", e);
        estadoGuardado = 'error'; 
        if (!silencioso) alert("Error al guardar: " + e); 
    }
  }

  // --- LÓGICA: MENÚ JWPUB COMITÉ ---
  let mostrarMenuJW = false;

  // Cierra el menú al hacer clic fuera
  onMount(() => {
      window.addEventListener('click', handleClickOutside);
  });

  function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (mostrarMenuJW && !target.closest('.jw-menu-container')) {
          mostrarMenuJW = false;
      }
  }

  // Función principal de envío
  async function enviarEmailComite(tipo: 'comite_entero' | 'sup_programa' | 'audio_video') {
      let destinatarios = new Set<string>();
      let idPlantilla = '';

      // 1. Extraer correos según la opción elegida
      if (tipo === 'comite_entero') {
          idPlantilla = 'comite';
          [c.coord, c.prog, c.aloj].forEach(id => {
              const h = getDetalles(id);
              if (h && h.email) destinatarios.add(h.email.trim());
          });
      } else if (tipo === 'sup_programa') {
          idPlantilla = 'superintendente';
          const h = getDetalles(c.prog);
          if (h && h.email) destinatarios.add(h.email.trim());
      } else if (tipo === 'audio_video') {
          idPlantilla = 'audiovideo';
          const h = getDetalles(c.av);
          if (h && h.email) destinatarios.add(h.email.trim());
      }

      const listaCorreos = Array.from(destinatarios).join(';');
      
      if (listaCorreos.length === 0) {
          return alert("⚠️ No hay correos registrados para esta selección.");
      }

      try {
          // 2. Cargar plantilla
          const plantilla = obtenerPlantillaPorId(idPlantilla);
          const asuntoBase = plantilla?.subject || "Información de la Asamblea";
          const cuerpoBase = plantilla?.body || "";

          // 3. Crear contexto base para la asamblea (sin un hermano específico)
          const objetoSimulado = {
              nombre_completo: 'Hermanos', nombre_pila: 'Hermanos', apellidos: '',
              tema: '', hora_inicio: '', hora: '', tipo_asignacion: 'Comité',
              numero_bosquejo: '', email: '', telefono: '', congregacion: ''
          };

          const contexto = await generarContexto(objetoSimulado, asambleaId, false);
          
          // 4. Procesar marcadores
          const asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
          const cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);

          // 5. Abrir JWPUB
          const url = `https://mail.jwpub.org/owa/#path=/mail/action/compose` +
                      `&to=${encodeURIComponent(listaCorreos)}` +
                      `&subject=${encodeURIComponent(asuntoFinal)}` +
                      `&body=${encodeURIComponent(cuerpoFinal)}`;
          
          openUrl(url);
          mostrarMenuJW = false;

      } catch (error) {
          console.error("Error al generar correo:", error);
          alert("Ocurrió un error al intentar abrir el correo.");
      }
  }

  $: filtrados = hermanos.filter(h => h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase()));
</script>

<div class="panel-comite">
  <div class="header">
    <h3><ShieldCheck class="text-blue"/> Organización de la Asamblea ({asambleaIdentificador})</h3>
    
    <div style="display: flex; gap: 10px; align-items: center;">

        <div class="indicador-guardado {estadoGuardado}">
            {#if estadoGuardado === 'guardando'}
                <Loader size={14} class="spin-icon"/> <span>Guardando...</span>
            {:else if estadoGuardado === 'guardado'}
                <Check size={14}/> <span>Guardado</span>
            {:else if estadoGuardado === 'error'}
                <AlertCircle size={14}/> <span>Error</span>
            {/if}
        </div>
        
        <div style="position: relative;" class="jw-menu-container">
            <button class="btn-jw-header" on:click|stopPropagation={() => mostrarMenuJW = !mostrarMenuJW}>
                <Mail size={16}/> JW Email <ChevronDown size={14}/>
            </button>
            
            {#if mostrarMenuJW}
                <div class="dropdown-jw" on:click|stopPropagation>
                    <button class="jw-item" on:click={() => enviarEmailComite('comite_entero')}>
                        <Users size={16} color="var(--primary)"/>
                        <div style="display:flex; flex-direction:column; text-align:left; gap:2px;">
                            <span style="font-weight:600; font-size:13px; color:var(--text-main);">Al Comité de Asamblea</span>
                            <span style="font-size:10px; color:var(--text-secondary);">Coord., Prog. y Alojamiento</span>
                        </div>
                    </button>
                    
                    <div style="height:1px; background:var(--border); margin:4px 10px;"></div>
                    
                    <button class="jw-item" on:click={() => enviarEmailComite('sup_programa')}>
                        <NotepadText size={16} color="#d97706"/>
                        <span style="font-weight:600; font-size:13px; color:var(--text-main);">Al Sup. de Programa</span>
                    </button>
                    
                    <div style="height:1px; background:var(--border); margin:4px 10px;"></div>
                    
                    <button class="jw-item" on:click={() => enviarEmailComite('audio_video')}>
                        <Radio size={16} color="#16a34a"/>
                        <span style="font-weight:600; font-size:13px; color:var(--text-main);">Al Sup. de Audio/Video</span>
                    </button>
                </div>
            {/if}
        </div>

        <button class="btn-save" on:click={() => guardar()}><Save size={18}/> Guardar Todo</button>
    </div>
  </div>

  <div class="scroll-container">

    <h3 class="titulo-separador">Miembros del Comité de Asamblea</h3>

    <Panel padding="24px" clasesExtra="seccion-comite">
        <h4 class="titulo-seccion"><User size={18}/> COORDINACIÓN</h4>
        <div class="grid-dos">
            <div class="role-wrapper">
                <span class="label-rol">Coordinador del Comité de Asamblea</span>
                {#if getDetalles(c.coord)}
                    {@const p = getDetalles(c.coord)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('coord')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('coord')}>Seleccionar... <ChevronDown size={16}/></button>{/if}
            </div>
            <div class="role-wrapper">
                <span class="label-rol">Auxiliar del Coordinador del Comité de Asamblea</span>
                {#if getDetalles(c.coord_a)}
                    {@const p = getDetalles(c.coord_a)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('coord_a')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('coord_a')}>Seleccionar... <ChevronDown size={16}/></button>{/if}
            </div>
        </div>
    </Panel>

    <div class="grid-dos-grande">
        <Panel padding="24px" clasesExtra="seccion-comite">
            <h4 class="titulo-seccion"><NotepadText size={16}/> PROGRAMA</h4>
            <div class="stack-roles">
                <div class="role-wrapper">
                    <span class="label-rol">Superintendente de Programa</span>
                    {#if getDetalles(c.prog)}
                        {@const p = getDetalles(c.prog)}
                        <div class="tarjeta">
                            <div class="card-top">
                                <div class="avatar"><User size={20}/></div>
                                <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                                <button class="btn-x" on:click={() => quitar('prog')}><X size={16}/></button>
                            </div>
                            <div class="card-bottom">
                                <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                                <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                                <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                            </div>
                        </div>
                    {:else}<button class="btn-select" on:click={() => abrirModal('prog')}>Seleccionar...</button>{/if}
                </div>
                <div class="role-wrapper">
                    <span class="label-rol">Auxiliar del Superintendente del Programa</span>
                    {#if getDetalles(c.prog_a)}
                        {@const p = getDetalles(c.prog_a)}
                        <div class="tarjeta">
                            <div class="card-top">
                                <div class="avatar"><User size={20}/></div>
                                <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                                <button class="btn-x" on:click={() => quitar('prog_a')}><X size={16}/></button>
                            </div>
                            <div class="card-bottom">
                                <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                                <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                                <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                            </div>
                        </div>
                    {:else}<button class="btn-select" on:click={() => abrirModal('prog_a')}>Seleccionar...</button>{/if}
                </div>
            </div>
        </Panel>

        <Panel padding="24px" clasesExtra="seccion-comite">
            <h4 class="titulo-seccion"><Home size={16}/> ALOJAMIENTO</h4>
            <div class="stack-roles">
                <div class="role-wrapper">
                    <span class="label-rol">Superintendente de Alojamiento</span>
                    {#if getDetalles(c.aloj)}
                        {@const p = getDetalles(c.aloj)}
                        <div class="tarjeta">
                            <div class="card-top">
                                <div class="avatar"><User size={20}/></div>
                                <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                                <button class="btn-x" on:click={() => quitar('aloj')}><X size={16}/></button>
                            </div>
                            <div class="card-bottom">
                                <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                                <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                                <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                            </div>
                        </div>
                    {:else}<button class="btn-select" on:click={() => abrirModal('aloj')}>Seleccionar...</button>{/if}
                </div>
                <div class="role-wrapper">
                    <span class="label-rol">Auxiliar del Superintendente de Alojamiento</span>
                    {#if getDetalles(c.aloj_a)}
                        {@const p = getDetalles(c.aloj_a)}
                        <div class="tarjeta">
                            <div class="card-top">
                                <div class="avatar"><User size={20}/></div>
                                <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                                <button class="btn-x" on:click={() => quitar('aloj_a')}><X size={16}/></button>
                            </div>
                            <div class="card-bottom">
                                <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                                <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                                <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                            </div>
                        </div>
                    {:else}<button class="btn-select" on:click={() => abrirModal('aloj_a')}>Seleccionar...</button>{/if}
                </div>
            </div>
        </Panel>
    </div>

    <h3 class="titulo-separador">Otras Responsabilidades</h3>

    <Panel padding="24px" clasesExtra="seccion-comite">
        <h4 class="titulo-seccion">DEPARTAMENTO DE AUDIO Y VIDEO</h4>
        <div class="grid-dos">
            <div class="role-wrapper">
                <span class="label-rol"><Radio size={12}/> Superintendente A/V</span>
                {#if getDetalles(c.av)}
                    {@const p = getDetalles(c.av)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('av')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('av')}>Seleccionar...</button>{/if}
            </div>
            <div class="role-wrapper">
                <span class="label-rol"><Monitor size={12}/> Superintendente de Video</span>
                {#if getDetalles(c.video)}
                    {@const p = getDetalles(c.video)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('video')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('video')}>Seleccionar...</button>{/if}
            </div>
            <div class="role-wrapper">
                <span class="label-rol"><Mic size={12}/> Superintendente de Audio</span>
                {#if getDetalles(c.audio)}
                    {@const p = getDetalles(c.audio)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('audio')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('audio')}>Seleccionar...</button>{/if}
            </div>
            <div class="role-wrapper">
                <span class="label-rol"><SlidersHorizontal size={12}/> Superintendente de Plataforma</span>
                {#if getDetalles(c.plat)}
                    {@const p = getDetalles(c.plat)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('plat')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('plat')}>Seleccionar...</button>{/if}
            </div>
        </div>
    </Panel>

    <Panel padding="24px" clasesExtra="seccion-comite">
        <h4 class="titulo-seccion"><Droplet size={16}/> DEPARTAMENTO DE BAUTISMO</h4>
        <div class="grid-dos">
            <div class="role-wrapper">
                <span class="label-rol">Superintendente de Bautismo</span>
                {#if getDetalles(c.baut)}
                    {@const p = getDetalles(c.baut)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('baut')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('baut')}>Seleccionar...</button>{/if}
            </div>
            
            <div class="role-wrapper">
                <span class="label-rol">Auxiliar del Superintendente de Bautismo</span>
                {#if getDetalles(c.baut_a)}
                    {@const p = getDetalles(c.baut_a)}
                    <div class="tarjeta">
                        <div class="card-top">
                            <div class="avatar"><User size={20}/></div>
                            <div class="info"><span class="t-nombre">{p.nombre_completo}</span><span class="t-priv">{p.privilegios || '-'}</span></div>
                            <button class="btn-x" on:click={() => quitar('baut_a')}><X size={16}/></button>
                        </div>
                        <div class="card-bottom">
                            <div class="row"><MapPin size={12}/> {p.nombre_congregacion || '-'}</div>
                            <div class="row"><Phone size={12}/> {p.telefono || '-'}</div>
                            <div class="row"><Mail size={12}/> {p.email || '-'}</div>
                        </div>
                    </div>
                {:else}<button class="btn-select" on:click={() => abrirModal('baut_a')}>Seleccionar...</button>{/if}
            </div>
        </div>
    </Panel>

  </div> </div>

{#if mostrarModal}
<div class="modal-backdrop" on:click|self={() => mostrarModal = false}>
  <div class="modal">
    <div class="modal-header"><h3>Seleccionar</h3><button class="btn-close" on:click={() => mostrarModal = false}><X size={18}/></button></div>
    
    <div class="modal-body">
      {#if modoCreacionRapida}
        <div class="form-rapido">
            <h4 class="form-title">Nuevo Registro ({asambleaIdentificador})</h4>
            
            <div class="campo">
                <label>Nombre Completo</label>
                <input type="text" placeholder="Ej: Juan Pérez" bind:value={nuevoNombre} autofocus class="input-std" />
            </div>

            <div class="campo">
                <label>Congregación</label>
                <select bind:value={nuevaCongregacionId} class="input-std">
                    <option value={0}>-- Superintendente de Circuito --</option>
                    {#each congregaciones as cong}
                        <option value={cong.id}>{cong.nombre}</option>
                    {/each}
                </select>
            </div>

            <div class="grid-form">
                <div class="campo">
                    <label>Teléfono</label>
                    <input type="text" placeholder="+53..." bind:value={nuevoTelefono} class="input-std" />
                </div>
                <div class="campo">
                    <label>Email</label>
                    <input type="text" placeholder="@email.com" bind:value={nuevoEmail} class="input-std" />
                </div>
            </div>

            <div class="botones-form">
                <button class="btn-cancelar" on:click={() => modoCreacionRapida = false}>Cancelar</button>
                <button class="btn-confirmar" on:click={crearYSeleccionar}>Guardar</button>
            </div>
        </div>
      {:else}
        <div class="search-box">
            <Search size={16} color="var(--text-secondary)"/>
            <input type="text" placeholder="Buscar..." bind:value={terminoBusqueda} autofocus/>
        </div>
        
        <div class="lista-personas">
            <button class="item-nuevo" on:click={() => modoCreacionRapida = true}>
                <div class="icon-plus"><Plus size={16}/></div>
                <span>Agregar Nuevo / Soy Yo</span>
            </button>

            {#each filtrados as p}
            <button class="item-persona" on:click={() => seleccionar(p.id)}>
                <div class="avatar-small">{p.nombre_completo.charAt(0)}</div>
                <div class="datos"><span class="p-nombre">{p.nombre_completo}</span><span class="p-cong">{p.nombre_congregacion || '-'}</span></div>
            </button>
            {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
 /* ===== CONTENEDOR PRINCIPAL ===== */
.panel-comite { display: flex; flex-direction: column; gap: 20px; height: 100%; background: transparent; }

.header { 
    display: flex; justify-content: space-between; align-items: center; 
    background: var(--bg-card); 
    padding: 15px 20px; 
    border-bottom: 1px solid var(--border); 
}
.header h3 { margin: 0; color: var(--text-main); display: flex; gap: 10px; align-items: center; } 

.btn-save { 
    background: var(--primary); color: white; border: none; 
    padding: 8px 16px; border-radius: 6px; cursor: pointer; 
    display: flex; gap: 6px; font-weight: 600; align-items: center; 
    transition: transform 0.2s;
}
.btn-save:hover { transform: translateY(-2px); opacity: 0.9; }

.scroll-container { padding: 5px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; }

.titulo-separador {
    font-size: 16px; font-weight: 700; color: var(--text-main);
    margin: 20px 0 5px 0; padding-bottom: 8px;
    border-bottom: 2px solid var(--border); width: 100%;
}

/* ======================================================== */
/* BLINDAJE CONTRA SVELTE (Usando :global y Flexbox Seguro) */
/* ======================================================== */

:global(.titulo-seccion) { 
    margin: 0 0 15px 0 !important; 
    color: var(--text-secondary) !important; 
    font-size: 11px !important; font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 1px !important; 
    display: flex !important; gap: 8px !important; align-items: center !important; 
    border-bottom: 1px solid var(--border) !important; 
    padding-bottom: 8px !important; 
}

:global(.seccion-comite) { 
    margin-bottom: 5px !important; 
    width: 100% !important; 
    display: flex !important;
    flex-direction: column !important;
    overflow: visible !important; /* Evita que corte el contenido inferior */
}

:global(.grid-uno) { display: flex !important; flex-direction: column !important; width: 100% !important; }

/* Convertimos los grids a flex para evitar el colapso de altura */
:global(.grid-dos) { display: flex !important; gap: 20px !important; width: 100% !important; align-items: flex-start !important; }
:global(.grid-dos > div) { flex: 1 !important; min-width: 0 !important; }

:global(.grid-dos-grande) { display: flex !important; gap: 20px !important; width: 100% !important; margin-bottom: 5px !important; }
:global(.grid-dos-grande > div) { flex: 1 !important; min-width: 0 !important; }

:global(.stack-roles) { display: flex !important; flex-direction: column !important; gap: 15px !important; width: 100% !important; }

:global(.role-wrapper) { display: flex !important; flex-direction: column !important; gap: 8px !important; width: 100% !important; }

:global(.label-rol) { 
    font-size: 11px !important; font-weight: 700 !important; color: var(--text-secondary) !important;
    display: flex !important; gap: 6px !important; align-items: center !important; text-transform: uppercase !important;
}

/* ===== TARJETAS Y BOTONES DENTRO DEL PANEL ===== */
:global(.tarjeta) { 
    background: var(--bg-card) !important; 
    border: 1px solid var(--border) !important;
    border-left: 4px solid var(--primary) !important;
    border-radius: 10px !important; 
    overflow: hidden !important; 
    display: flex !important; flex-direction: column !important;
    transition: all 0.2s ease !important; 
    width: 100% !important;
}
:global(.tarjeta:hover) { 
    transform: translateY(-3px) !important;
    box-shadow: var(--shadow-premium) !important;
    border-color: var(--primary) !important;
}

:global(.card-top) { 
    display: flex !important; align-items: center !important; gap: 12px !important; 
    padding: 14px !important; background: transparent !important; 
    border-bottom: 1px solid var(--border) !important;
}

:global(.avatar) { 
    width: 38px !important; height: 38px !important; background: rgba(59, 130, 246, 0.1) !important;
    color: var(--primary) !important; border-radius: 50% !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; 
}

:global(.info) { flex: 1 !important; display: flex !important; flex-direction: column !important; gap: 4px !important; overflow: hidden !important; }

:global(.t-nombre) { font-weight: 700 !important; color: var(--text-main) !important; font-size: 14px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; line-height: 1.1 !important; }

:global(.t-priv) { 
    font-size: 10px !important; font-weight: 700 !important; text-transform: uppercase !important; letter-spacing: 0.5px !important;
    color: var(--text-secondary) !important; background: var(--bg-body) !important; width: fit-content !important; padding: 3px 8px !important; border-radius: 12px !important; line-height: 1 !important; border: 1px solid var(--border) !important;
}

:global(.card-bottom) { padding: 12px 14px !important; background: var(--bg-body) !important; display: flex !important; flex-direction: column !important; gap: 8px !important; }

:global(.row) { font-size: 12px !important; color: var(--text-secondary) !important; display: flex !important; align-items: center !important; gap: 8px !important; }
:global(.row svg) { flex-shrink: 0 !important; opacity: 0.7 !important; }

:global(.btn-x) { 
    background: transparent !important; border: none !important; color: var(--text-secondary) !important; cursor: pointer !important; 
    padding: 6px !important; border-radius: 50% !important; display: flex !important; align-items: center !important; justify-content: center !important;
    transition: background 0.2s, color 0.2s !important;
}
:global(.btn-x:hover) { background: var(--hover-bg) !important; color: #ef4444 !important; }

:global(.btn-select) { 
    width: 100% !important; padding: 14px 15px !important; background: transparent !important;
    border: 1.5px dashed var(--border) !important; border-radius: 8px !important; 
    color: var(--text-secondary) !important; font-size: 13px !important; font-weight: 600 !important; cursor: pointer !important; 
    display: flex !important; justify-content: space-between !important; align-items: center !important; transition: all 0.2s ease !important;
} 
:global(.btn-select:hover) { background: var(--hover-bg) !important; border-color: var(--primary) !important; color: var(--primary) !important; }

/* ===== MODAL Y FORMULARIOS (Se quedan normales porque están fuera de los Paneles) ===== */
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.modal { background: var(--bg-card); width: 400px; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; max-height: 85vh; border: 1px solid var(--border); box-shadow: var(--shadow-premium); }
.modal-header { padding: 15px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { color: var(--text-main); margin: 0; font-size: 16px; }
.btn-close { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; border-radius: 6px; }
.btn-close:hover { background: var(--hover-bg); color: var(--text-main); }
.modal-body { padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.search-box { display: flex; align-items: center; gap: 8px; padding: 10px; background: var(--bg-body); border-radius: 8px; border: 1px solid var(--border); }
.search-box input { border: none; background: transparent; outline: none; width: 100%; font-size: 14px; color: var(--text-main); }
.lista-personas { display: flex; flex-direction: column; gap: 5px; }
.item-persona { display: flex; align-items: center; gap: 12px; padding: 10px; background: transparent; border: 1px solid transparent; text-align: left; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
.item-persona:hover { background: var(--bg-body); border-color: var(--border); }
.avatar-small { width: 32px; height: 32px; background: rgba(59, 130, 246, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--primary); font-size: 12px; }
.datos { display: flex; flex-direction: column; }
.p-nombre { font-weight: 600; font-size: 13px; color: var(--text-main); }
.p-cong { font-size: 11px; color: var(--text-secondary); }
.item-nuevo { display: flex; align-items: center; gap: 10px; padding: 12px; background: transparent; border: 1.5px dashed var(--primary); color: var(--primary); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; margin-bottom: 10px; transition: all 0.2s; }
.item-nuevo:hover { background: rgba(59, 130, 246, 0.05); }
.form-rapido { display: flex; flex-direction: column; gap: 12px; }
.form-title { margin: 0; color: var(--text-main); font-size: 15px; font-weight: 700; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
.campo { display: flex; flex-direction: column; gap: 6px; }
.campo label { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
.input-std { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; box-sizing: border-box; background: var(--bg-body); color: var(--text-main); transition: border 0.2s; }
.input-std:focus { border-color: var(--primary); outline: none; }
.grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.botones-form { display: flex; gap: 10px; margin-top: 10px; }
.btn-confirmar { flex: 1; background: var(--primary); color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: opacity 0.2s;}
.btn-confirmar:hover { opacity: 0.9; }
.btn-cancelar { flex: 1; background: transparent; color: var(--text-secondary); border: 1px solid var(--border); padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s;}
.btn-cancelar:hover { background: var(--hover-bg); 
}

/* ESTILOS DEL NUEVO MENÚ JW EMAIL */
    .btn-jw-header {
        background: transparent;
        border: 1px solid #f97316;
        color: #f97316;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        gap: 6px;
        font-weight: 600;
        font-size: 13px;
        align-items: center;
        transition: all 0.2s;
    }
    .btn-jw-header:hover {
        background: rgba(249, 115, 22, 0.1);
    }

    .dropdown-jw {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 5px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 8px;
        box-shadow: var(--shadow-premium);
        z-index: 100;
        min-width: 250px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .jw-item {
        width: 100%;
        padding: 12px 15px;
        background: transparent;
        border: none;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: background 0.2s;
    }
    .jw-item:hover {
        background: var(--hover-bg);
    }

    /* INDICADOR DE GUARDADO AUTOMÁTICO */
    .indicador-guardado {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    .indicador-guardado.guardando {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
        border: 1px solid rgba(59, 130, 246, 0.2);
    }
    .indicador-guardado.guardado {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .indicador-guardado.error {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.2);
    }

    /* Animación de giro para el Loader */
    :global(.spin-icon) {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    /* =========================================================
   DISEÑO RESPONSIVO (COMITÉ: WINDOWS + ANDROID)
   ========================================================= */

@media (max-width: 768px) {
    /* 1. CABECERA: APILAR TÍTULO Y BOTONES */
    .header {
        flex-direction: column;
        align-items: stretch;
        gap: 15px;
        padding: 15px;
    }

    .header h3 {
        font-size: 15px;
    }

    .btn-save {
        width: 100%;
        height: 48px;
        justify-content: center;
    }

    /* 2. MENÚ JW EMAIL (Asegurar que no se desborde) */
    .dropdown-jw {
        position: fixed; /* Lo fijamos a la pantalla en móviles */
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90vw;
        max-width: 320px;
    }

    /* 3. GRIDS: TODO A UNA SOLA COLUMNA */
    :global(.grid-dos), :global(.grid-dos-grande) {
        flex-direction: column !important;
        gap: 15px !important;
    }

    :global(.seccion-comite) {
        padding: 15px !important;
    }

    /* 4. TARJETAS DE HERMANOS (Más grandes para el dedo) */
    :global(.tarjeta) {
        border-left-width: 6px !important; /* Resaltamos más el borde en móvil */
    }

    :global(.t-nombre) {
        font-size: 16px !important; /* Nombre más legible */
        white-space: normal !important; /* Permitir que el nombre baje de línea si es muy largo */
    }

    :global(.btn-select) {
        height: 60px; /* Botón de "Seleccionar..." más gordo */
        font-size: 15px !important;
    }

    /* 5. MODAL DE SELECCIÓN (Pantalla completa casi total) */
    .modal {
        width: 95vw;
        max-height: 90vh;
    }

    .search-box {
        height: 48px;
    }

    .item-persona {
        padding: 15px 10px; /* Más espacio para tocar */
    }

    /* Formulario de creación rápida */
    .grid-form {
        grid-template-columns: 1fr; /* Teléfono y Email uno debajo del otro */
    }

    .botones-form {
        flex-direction: column-reverse;
        gap: 10px;
    }

    .btn-confirmar, .btn-cancelar {
        height: 48px;
        width: 100%;
    }
}
</style>