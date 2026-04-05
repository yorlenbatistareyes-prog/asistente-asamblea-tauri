<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { 
    ShieldCheck, Save, Search, X, MapPin, Phone, Mail, 
    User, ChevronDown, Layers, Monitor, Mic, Radio, Users, Plus, Droplet, BookOpen,
     Presentation, Mic2, Home, Building, CalendarDays, ScrollText, FileText, ListTodo,
     ListOrdered, NotepadText, ClipboardList, SlidersHorizontal, Check, Loader, AlertCircle,
     Trash2, Edit2, MessageSquare   
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
  
  // --- CONFIGURACIÓN DE ROLES Y TARJETAS ---
  const definicionRoles: Record<string, { label: string, color: string }> = {
      coord: { label: 'Coordinador del comité', color: 'coord' },
      coord_a: { label: 'Auxiliar del coordinador', color: 'coord' },
      prog: { label: 'Superintendente de programa', color: 'prog' },
      prog_a: { label: 'Auxiliar de programa', color: 'prog' },
      aloj: { label: 'Superintendente de alojamiento', color: 'aloj' },
      aloj_a: { label: 'Auxiliar de alojamiento', color: 'aloj' },
      av: { label: 'Superintendente de A/V', color: 'av' },
      video: { label: 'Superintendente de video', color: 'av' },
      audio: { label: 'Superintendente de audio', color: 'av' },
      plat: { label: 'Superintendente de plataforma', color: 'av' },
      baut: { label: 'Superintendente de bautismo', color: 'baut' },
      baut_a: { label: 'Auxiliar de bautismo', color: 'baut' },
  };

  const gruposResponsabilidades = [
      { titulo: 'Comité de Asamblea', roles: ['coord', 'coord_a', 'prog', 'prog_a', 'aloj', 'aloj_a'] },
      { titulo: 'Departamento de Audio, Video y Plataforma', roles: ['av', 'video', 'audio', 'plat'] },
      { titulo: 'Departamento de Bautismo', roles: ['baut', 'baut_a'] }
  ];

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
    {#each gruposResponsabilidades as grupo}
        <h3 class="titulo-separador">{grupo.titulo}</h3>
        
        <div class="grid-tarjetas">
            {#each grupo.roles as rolId}
                {@const def = definicionRoles[rolId]}
                <div class="tarjeta-miembro">
                    <div class="tarjeta-header">
                        <span class="badge-rol badge-{def.color}">{def.label}</span>
                        {#if getDetalles(c[rolId])}
                            <div class="acciones-tarjeta">
                                <button class="icon-btn" title="Editar"><Edit2 size={14}/></button>
                                <button class="icon-btn" title="Eliminar" on:click={() => quitar(rolId)}><Trash2 size={14}/></button>
                            </div>
                        {/if}
                    </div>

                    <div class="tarjeta-body">
                        {#if getDetalles(c[rolId])}
                            {@const p = getDetalles(c[rolId])}
                            <div class="avatar-grande filled bg-{def.color}">
                                <User size={32} color="white"/>
                            </div>
                            <h4 class="nombre-miembro">{p.nombre_completo}</h4>
                            <div class="acciones-rapidas">
                                <button class="qa-btn" title="Enviar correo"><Mail size={14}/></button>
                                <button class="qa-btn" title="Llamar"><Phone size={14}/></button>
                                <button class="qa-btn" title="WhatsApp"><MessageSquare size={14}/></button>
                            </div>
                            <div class="lista-contactos">
                                {#if p.email}<div class="item-contacto"><Mail size={14}/> {p.email}</div>{/if}
                                {#if p.telefono}<div class="item-contacto"><Phone size={14}/> {p.telefono}</div>{/if}
                            </div>
                        {:else}
                            <div class="avatar-grande empty">
                                <User size={32} color="#9ca3af"/>
                            </div>
                            <p class="texto-vacio">Ningún miembro asignado</p>
                            <button class="btn-agregar-miembro" on:click={() => abrirModal(rolId)}>Agregar miembro</button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/each}
</div> 
</div> 

{#if mostrarModal}
<div class="modal-backdrop" on:click|self={() => mostrarModal = false}>
  <div class="modal-creacion">
    <div class="modal-header">
        <h3>Agregar miembro - {definicionRoles[rolEditando]?.label || 'Miembro'}</h3>
        <button class="btn-close" on:click={() => mostrarModal = false}><X size={20}/></button>
    </div>
    
    <div class="modal-body">
        
        <div class="seccion-modal">
            <span class="subtexto-modal">Seleccionar entre personas existentes</span>
            <label class="label-modal">Seleccione una persona</label>
            <div class="input-con-icono">
                <input type="text" placeholder="Seleccione Miembro..." bind:value={terminoBusqueda} autofocus class="input-modal" />
                <Search size={18} class="icono-der" color="#6b7280"/>
            </div>
            
            {#if terminoBusqueda.length > 0}
            <div class="lista-resultados">
                {#each filtrados as p}
                <button class="item-resultado" on:click={() => seleccionar(p.id)}>
                    <div class="avatar-small">{p.nombre_completo.charAt(0)}</div>
                    <div class="datos"><span class="p-nombre">{p.nombre_completo}</span><span class="p-cong">{p.nombre_congregacion || '-'}</span></div>
                </button>
                {/each}
            </div>
            {/if}
        </div>

        <div class="divisor-modal">
            <span>O ingresa los detalles a continuación para crear un nuevo miembro</span>
        </div>

        {#if modoCreacionRapida}
            <div class="formulario-creacion">
                <div class="campo-full">
                    <label class="label-modal">Nombre completo</label>
                    <input type="text" bind:value={nuevoNombre} class="input-modal" />
                </div>

                <div class="campo-full">
                    <label class="label-modal">Congregación</label>
                    <select bind:value={nuevaCongregacionId} class="input-modal">
                        <option value={0}>-- Sup. de Circuito / Ninguna --</option>
                        {#each congregaciones as cong}
                            <option value={cong.id}>{cong.nombre}</option>
                        {/each}
                    </select>
                </div>

                <div class="campo-full">
                    <label class="label-modal">Dirección de correo electrónico</label>
                    <input type="text" bind:value={nuevoEmail} class="input-modal" />
                </div>

                <div class="campo-full">
                    <label class="label-modal">Teléfono móvil</label>
                    <input type="text" bind:value={nuevoTelefono} class="input-modal" />
                </div>
            </div>
        {:else}
            <button class="btn-dashed" on:click={() => modoCreacionRapida = true}>
                <Plus size={18}/> Crear Nuevo Miembro
            </button>
        {/if}
    </div>
    
    <div class="footer-modal">
        <button class="btn-cancelar-accion" on:click={() => { if(modoCreacionRapida) modoCreacionRapida = false; else mostrarModal = false; }}>
            Cancelar
        </button>
        {#if modoCreacionRapida}
            <button class="btn-crear-accion" on:click={crearYSeleccionar}>
                <Check size={16}/> Crear
            </button>
        {/if}
    </div>
  </div>
</div>
{/if}

<style>
/* ===== CONTENEDOR PRINCIPAL Y CABECERA (Se mantiene) ===== */
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

.scroll-container { padding: 10px 20px; overflow-y: auto; flex: 1; }

.titulo-separador {
    font-size: 16px; font-weight: 700; color: var(--text-main);
    margin: 20px 0 10px 0; padding-bottom: 8px;
    border-bottom: 2px solid var(--border); width: 100%;
}

/* ========================================================
   NUEVAS TARJETAS DE MIEMBROS (Diseño Limpio)
   ======================================================== */
.grid-tarjetas {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    padding: 10px 0 25px 0;
}

.tarjeta-miembro {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.tarjeta-miembro:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-premium);
}

.tarjeta-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid var(--border);
    min-height: 55px;
}

/* Colores de Badges y Avatares organizados por departamento */
.badge-rol { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 12px; }
.badge-coord { background: #fce7f3; color: #be185d; }
.badge-prog  { background: #e0f2fe; color: #0369a1; }
.badge-aloj  { background: #fef3c7; color: #b45309; }
.badge-av    { background: #dcfce7; color: #15803d; }
.badge-baut  { background: #cffafe; color: #0f766e; }

.bg-coord { background: #e11d48; }
.bg-prog  { background: #2563eb; }
.bg-aloj  { background: #d97706; }
.bg-av    { background: #16a34a; }
.bg-baut  { background: #0d9488; }

.acciones-tarjeta { display: flex; gap: 5px; }
.icon-btn { 
    background: transparent; border: none; color: var(--text-secondary); 
    cursor: pointer; padding: 6px; border-radius: 4px; transition: 0.2s;
}
.icon-btn:hover { background: var(--hover-bg); color: var(--text-main); }

.tarjeta-body {
    padding: 30px 20px; display: flex; flex-direction: column; 
    align-items: center; text-align: center; flex: 1;
}

.avatar-grande {
    width: 64px; height: 64px; border-radius: 50%; display: flex; 
    align-items: center; justify-content: center; margin-bottom: 15px;
}
.avatar-grande.empty { background: #f3f4f6; }

.texto-vacio { color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; }
.nombre-miembro { margin: 0 0 15px 0; font-size: 16px; color: var(--text-main); }

.btn-agregar-miembro {
    background: #2563eb; color: white; border: none; padding: 8px 20px; 
    border-radius: 6px; font-weight: 500; font-size: 13px; cursor: pointer; 
    transition: background 0.2s;
}
.btn-agregar-miembro:hover { background: #1d4ed8; }

.acciones-rapidas { display: flex; gap: 10px; margin-bottom: 20px; }
.qa-btn {
    width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border); 
    background: transparent; color: var(--text-secondary); display: flex; 
    align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
}
.qa-btn:hover { background: var(--hover-bg); color: var(--text-main); border-color: var(--primary); }

.lista-contactos { width: 100%; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.item-contacto { font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; }

/* ========================================================
   ESTILOS DEL MODAL (CORREGIDOS Y AZUL CORPORATIVO)
   ======================================================== */
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); display: flex; justify-content: center; align-items: center; z-index: 9999; }

.modal-creacion { background: #ffffff; width: 550px; max-width: 95vw; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: none; display: flex; flex-direction: column; max-height: 90vh; }

.modal-header { padding: 20px 25px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { color: #111827; font-size: 16px; font-weight: 600; margin: 0; }
.btn-close { background: transparent; border: none; color: #6b7280; cursor: pointer; transition: 0.2s; padding: 4px; border-radius: 4px; }
.btn-close:hover { color: #111827; background: #f3f4f6; }

.modal-body { padding: 25px; overflow-y: auto; }

.seccion-modal { display: flex; flex-direction: column; gap: 8px; }
.subtexto-modal { font-size: 13px; color: #4b5563; }
.label-modal { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 2px; text-align: left; }

.input-con-icono { position: relative; display: flex; align-items: center; }
.input-modal { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; color: #111827; outline: none; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; background: #ffffff; }
/* Azul Corporativo al hacer click */
.input-modal:focus { border-color: #286eb4; box-shadow: 0 0 0 3px rgba(40,110,180,0.15); }
.icono-der { position: absolute; right: 12px; pointer-events: none; }

.lista-resultados { max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; margin-top: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; }
.item-resultado { padding: 12px 15px; display: flex; gap: 12px; align-items: center; background: #fff; border: none; border-bottom: 1px solid #e5e7eb; cursor: pointer; transition: background 0.2s; width: 100%; text-align: left; }
.item-resultado:last-child { border-bottom: none; }
.item-resultado:hover { background: #f9fafb; }

.avatar-small { width: 32px; height: 32px; background: rgba(40,110,180,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #286eb4; font-size: 12px; }
.datos { display: flex; flex-direction: column; }
.p-nombre { font-weight: 600; font-size: 13px; color: #111827; }
.p-cong { font-size: 11px; color: #6b7280; }

.divisor-modal { display: flex; align-items: center; text-align: center; color: #6b7280; font-size: 13px; margin: 25px 0; }
.divisor-modal::before, .divisor-modal::after { content: ''; flex: 1; border-bottom: 1px solid #e5e7eb; }
.divisor-modal span { padding: 0 15px; }

.formulario-creacion { display: flex; flex-direction: column; gap: 15px; }
.campo-full { display: flex; flex-direction: column; gap: 4px; }

.btn-dashed { width: 100%; padding: 12px; background: #ffffff; border: 1px dashed #286eb4; color: #286eb4; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s; }
.btn-dashed:hover { background: rgba(40,110,180,0.05); }

.footer-modal { padding: 15px 25px; border-top: 1px solid #e5e7eb; background: #ffffff; display: flex; justify-content: flex-end; gap: 12px; border-radius: 0 0 12px 12px; }

.btn-cancelar-accion { padding: 8px 16px; background: #ffffff; border: 1px solid #d1d5db; color: #111827; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; transition: 0.2s; }
.btn-cancelar-accion:hover { background: #f9fafb; }

.btn-crear-accion { padding: 8px 20px; background: #286eb4; color: #ffffff; border: none; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; }
.btn-crear-accion:hover { opacity: 0.9; }

/* Para que los botones principales de las tarjetas también tengan este color */
.btn-agregar-miembro { background: #286eb4 !important; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 500; font-size: 13px; cursor: pointer; transition: 0.2s; }
.btn-agregar-miembro:hover { opacity: 0.9; }

@media (max-width: 768px) {
    .footer-modal { flex-direction: column-reverse; }
    .btn-cancelar-accion, .btn-crear-accion { width: 100%; justify-content: center; height: 48px; }
}

/* ========================================================
   MENÚ JW EMAIL Y ESTADO DE GUARDADO (Se mantiene)
   ======================================================== */
.btn-jw-header {
    background: transparent; border: 1px solid #f97316; color: #f97316;
    padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex;
    gap: 6px; font-weight: 600; font-size: 13px; align-items: center; transition: all 0.2s;
}
.btn-jw-header:hover { background: rgba(249, 115, 22, 0.1); }

.dropdown-jw {
    position: absolute; top: 100%; right: 0; margin-top: 5px;
    background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
    box-shadow: var(--shadow-premium); z-index: 100; min-width: 250px;
    overflow: hidden; display: flex; flex-direction: column;
}

.jw-item {
    width: 100%; padding: 12px 15px; background: transparent; border: none;
    display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s;
}
.jw-item:hover { background: var(--hover-bg); }

.indicador-guardado {
    display: flex; align-items: center; gap: 6px; padding: 6px 12px;
    border-radius: 20px; font-size: 12px; font-weight: 600; transition: all 0.3s ease;
}
.indicador-guardado.guardando { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
.indicador-guardado.guardado  { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
.indicador-guardado.error     { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }

:global(.spin-icon) { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* =========================================================
   DISEÑO RESPONSIVO (MÓVILES)
   ========================================================= */
@media (max-width: 768px) {
    .header { flex-direction: column; align-items: stretch; gap: 15px; padding: 15px; }
    .header h3 { font-size: 15px; }
    .btn-save { width: 100%; height: 48px; justify-content: center; }
    
    .dropdown-jw { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 320px; }
    
    /* Grid de tarjetas: 1 sola columna ocupando todo */
    .grid-tarjetas { grid-template-columns: 1fr; gap: 15px; padding-bottom: 80px; }
    .tarjeta-body { padding: 20px 15px; }
    
    /* Modal adaptativo */
    .modal-miembro { height: auto; max-height: 90vh; }
    .grid-form { grid-template-columns: 1fr; }
    .btn-agregar-miembro, .item-nuevo { width: 100%; height: 48px; font-size: 14px; }
    .item-resultado { padding: 15px 10px; }
    
    /* Botones de acción inferior en móviles */
    .footer-modal { flex-direction: column-reverse; padding: 15px; }
    .footer-modal .btn-cancelar, .footer-modal .btn-confirmar { 
        width: 100% !important; height: 48px; display: flex; 
        justify-content: center; align-items: center; 
    }
}
</style>