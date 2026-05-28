<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { confirm } from '@tauri-apps/plugin-dialog';
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
  // 👇 Asegúrate de que cargarPlantillasEmail esté aquí adentro:
  import { obtenerPlantillaPorId, cargarPlantillasEmail } from '$lib/utils/plantillasEmail';
  import { prepararAsuntoEmail, prepararContenidoEmail } from '$lib/utils/contextoEmail';

  // 👇 Y asegúrate de tener esta línea completa para WhatsApp:
  import { obtenerPlantillaWhatsAppPorId, cargarPlantillasWhatsApp } from '$lib/utils/plantillasWhatsApp';
  import { prepararContenidoWhatsApp } from '$lib/utils/contextoWhatsApp';

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

  let inputEnFoco = false;

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
      { titulo: 'Miembros del Comité de Asamblea', roles: ['coord', 'prog', 'aloj'] },
      { titulo: 'Auxiliares del Comité de Asamblea', roles: ['coord_a', 'prog_a', 'aloj_a'] },
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
        
        // 👇 Aseguramos que las plantillas estén en memoria
        await cargarPlantillasEmail();
        await cargarPlantillasWhatsApp();
        
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
    // 1. Llamamos a la ventana nativa de Tauri
    const confirmado = await confirm(
      '¿Estás seguro de que deseas quitar a este hermano de la responsabilidad?', 
      { title: 'Confirmar eliminación', kind: 'warning' }
    );

    // 2. Si el usuario da clic en "Sí" / "Aceptar", borramos y guardamos
    if (confirmado) {
      c[rol] = 0; 
      await guardar(true); // <-- Auto-guardado silencioso
    }
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
          idPlantilla = 'comite'; // Usamos la plantilla general del comité
          const h = getDetalles(c.prog);
          if (h && h.email) destinatarios.add(h.email.trim());
      } else if (tipo === 'audio_video') {
          idPlantilla = 'departamentos'; // Usamos nuestra nueva plantilla de departamentos
          const h = getDetalles(c.av);
          if (h && h.email) destinatarios.add(h.email.trim());
      }

      // ... (El resto de la función queda exactamente igual) ...
      const listaCorreos = Array.from(destinatarios).join(';');
      
      if (listaCorreos.length === 0) {
          return alert("⚠️ No hay correos registrados para esta selección.");
      }

      try {
          const plantilla = obtenerPlantillaPorId(idPlantilla);
          const asuntoBase = plantilla?.subject || "Información de la Asamblea";
          const cuerpoBase = plantilla?.body || "";

          const objetoSimulado = {
              nombre_completo: 'Hermanos', nombre_pila: 'Hermanos', apellidos: '',
              tema: '', hora_inicio: '', hora: '', tipo_asignacion: 'Comité / Departamento',
              numero_bosquejo: '', email: '', telefono: '', congregacion: ''
          };

          const contexto = await generarContexto(objetoSimulado, asambleaId, false);
          const asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
          const cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);

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

// --- ENVIAR CORREO INDIVIDUAL A UN HERMANO ---
async function enviarEmailHermano(hermano: any) {
    if (!hermano.email) {
        alert("⚠️ Este hermano no tiene dirección de correo registrada.");
        return;
    }

    try {
        // Usamos la plantilla 'comite' para todos en esta vista
        const idPlantilla = 'comite';
        const plantilla = obtenerPlantillaPorId(idPlantilla);
        const asuntoBase = plantilla?.subject || "Información de la Asamblea";
        const cuerpoBase = plantilla?.body || "";

        // Creamos un contexto simulado con los datos del hermano
        const objetoSimulado = {
            nombre_orador: hermano.nombre_completo,
            email_orador: hermano.email,
            telefono_orador: hermano.telefono,
            congregacion_orador: hermano.nombre_congregacion,
            tema: 'Responsabilidades de Asamblea',
            tipo_asignacion: 'Comité / Departamento'
        };

        const contexto = await generarContexto(objetoSimulado, asambleaId, false);
        const asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
        const cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);

        const url = `https://mail.jwpub.org/owa/#path=/mail/action/compose` +
                    `&to=${encodeURIComponent(hermano.email)}` +
                    `&subject=${encodeURIComponent(asuntoFinal)}` +
                    `&body=${encodeURIComponent(cuerpoFinal)}`;
        
        await openUrl(url);
    } catch (error) {
        console.error("Error al generar correo individual:", error);
        alert("Ocurrió un error al intentar abrir el correo.");
    }
}

// --- LLAMAR POR TELÉFONO ---
async function llamarTelefono(hermano: any) {
    if (!hermano.telefono) {
        alert("⚠️ Este hermano no tiene número de teléfono registrado.");
        return;
    }
    
    let telefonoLimpio = hermano.telefono.replace(/[\s\-\(\)]/g, '');
    if (!telefonoLimpio.startsWith('+') && !telefonoLimpio.startsWith('00')) {
        if (telefonoLimpio.length === 8 && telefonoLimpio.startsWith('5')) {
            telefonoLimpio = '+53' + telefonoLimpio;
        }
    }
    
    // Mostrar advertencia solo una vez
    const yaVisto = localStorage.getItem('tel_warning_shown');
    if (!yaVisto) {
        const confirmar = await confirm(
            "Para realizar llamadas, Windows necesita una aplicación predeterminada.\n\n" +
            "Si ves un selector de aplicaciones, elige 'Teléfono' (Phone) o tu app favorita.\n\n" +
            "También puedes configurarlo en: Configuración > Aplicaciones > Aplicaciones predeterminadas > 'Elegir aplicaciones predeterminadas por protocolo' > tel.\n\n" +
            "¿Quieres continuar con la llamada?",
            { title: "Información sobre llamadas", kind: "info" }
        );
        if (!confirmar) return;
        localStorage.setItem('tel_warning_shown', 'true');
    }
    
    // Usar el comando Rust en lugar de openUrl
    try {
        await invoke('llamar_telefono', { telefono: telefonoLimpio });
    } catch (error) {
        console.error("Error al intentar llamar:", error);
        alert("No se pudo abrir el marcador. Asegúrate de tener una aplicación configurada para llamadas.");
    }
}

// --- ABRIR WHATSAPP ---
async function abrirWhatsApp(hermano: any) {
    if (!hermano.telefono) {
        alert("⚠️ Este hermano no tiene número de teléfono registrado.");
        return;
    }
    
    let telefonoLimpio = hermano.telefono.replace(/[\s\-\(\)]/g, '');
    telefonoLimpio = telefonoLimpio.replace(/^\+/, '');
    
    if (!telefonoLimpio.startsWith('53') && telefonoLimpio.length === 8) {
        telefonoLimpio = '53' + telefonoLimpio;
    }

    // 1. Obtener la plantilla
    let plantilla = obtenerPlantillaWhatsAppPorId('comite');
    let cuerpoBase = plantilla?.body || "";

    if (!cuerpoBase) {
        try {
            const res: any = await invoke('obtener_plantilla_mensaje', { id: 'comite' });
            if (res && res.cuerpo) cuerpoBase = res.cuerpo;
        } catch (e) {
            console.error("Error cargando plantilla WhatsApp comite:", e);
        }
    }

    if (!cuerpoBase) cuerpoBase = "⚠️ No se ha definido la plantilla del comité.";

    // 2. Generar el contexto
    const objetoSimulado = {
        nombre_orador: hermano.nombre_completo,
        telefono_orador: hermano.telefono,
        congregacion_orador: hermano.nombre_congregacion,
        tema: 'Responsabilidades de Asamblea',
        tipo_asignacion: 'Comité / Departamento'
    };

    const contexto = await generarContexto(objetoSimulado, asambleaId, false);
    let mensaje = prepararContenidoWhatsApp(cuerpoBase, contexto);
    
    openUrl(`https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`);
}

  $: filtrados = hermanos.filter(h => h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase()));
</script>

<div class="panel-comite">
  <div class="header">
  <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; width: 100%;">
    <!-- Badge del identificador de asamblea -->
    <div class="asamblea-badge">
      <ShieldCheck size={14} />
      <span>{asambleaIdentificador}</span>
    </div>

    <!-- Controles a la derecha -->
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
                <div class="jw-icon-wrapper">
                    <Users size={18} color="#2563eb"/> 
                </div>
                <div class="jw-text">
                    <span class="jw-label">Al Comité de Asamblea</span>
                    <span class="jw-sub">Coord., Prog. y Alojamiento</span>
                </div>
            </button>
            
            <div class="jw-divider"></div>

            <button class="jw-item" on:click={() => enviarEmailComite('sup_programa')}>
                <div class="jw-icon-wrapper">
                    <ScrollText size={18} color="#d97706"/> 
                </div>
                <div class="jw-text">
                    <span class="jw-label">Al Sup. de Programa</span>
                </div>
            </button>

            <div class="jw-divider"></div>
            
            <button class="jw-item" on:click={() => enviarEmailComite('audio_video')}>
                <div class="jw-icon-wrapper">
                    <Radio size={18} color="#16a34a"/> 
                </div>
                <div class="jw-text">
                    <span class="jw-label">Al Sup. de Audio/Video</span>
                </div>
            </button>
          </div>
        {/if}
      </div>

      <button class="btn-save" on:click={() => guardar()}><Save size={18}/> Guardar Todo</button>
    </div>
  </div>
</div>

<div class="scroll-container">
    {#each gruposResponsabilidades as grupo, i}
        
        {#if i === 2}
            <h2 class="subtitulo-general">Otras responsabilidades</h2>
        {/if}

        <h3 class="titulo-separador">{grupo.titulo}</h3>
        
        <div class="grid-tarjetas">

            {#each grupo.roles as rolId}
                {@const def = definicionRoles[rolId]}
                <div class="tarjeta-miembro">
                    <div class="tarjeta-header">
                        <span class="badge-rol badge-{def.color}">{def.label}</span>
                        {#if getDetalles(c[rolId])}
                            <div class="acciones-tarjeta">
                                <button class="icon-btn btn-editar" title="Editar" on:click={() => abrirModal(rolId)}>
                                    <Edit2 size={14}/>
                                </button>
                                <button class="icon-btn btn-eliminar" title="Eliminar" on:click={() => quitar(rolId)}>
                                   <Trash2 size={14}/>
                                </button>
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
    <button class="qa-btn btn-phone" 
            title="Llamar" 
            on:click={() => llamarTelefono(p)}>
        <Phone size={16}/>
    </button>

    <button class="qa-btn btn-ws" 
            title="Enviar WhatsApp" 
            on:click={() => abrirWhatsApp(p)}>
        <MessageSquare size={16}/>
    </button>

    <button class="qa-btn btn-jw-card" 
            title="Enviar correo JW" 
            on:click={() => enviarEmailHermano(p)}>
        <Mail size={16}/>
    </button>
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
                <div class="icono-izq">
                    <Search size={18} color="#6b7280"/>
                </div>
                
                <input type="text" 
                       placeholder="Buscar o seleccionar hermano..." 
                       bind:value={terminoBusqueda} 
                       autofocus 
                       class="input-modal"
                       on:focus={() => inputEnFoco = true} 
                       on:blur={() => setTimeout(() => inputEnFoco = false, 200)} 
                />
            </div>
            
            {#if terminoBusqueda.length > 0 || (inputEnFoco && filtrados.length > 0)}
                <div class="lista-resultados">
                    {#each filtrados as p}
                    <button class="item-resultado" on:click={() => seleccionar(p.id)}>
                        <div class="avatar-small">{p.nombre_completo.charAt(0)}</div>
                        <div class="datos">
                            <span class="p-nombre">{p.nombre_completo}</span>
                            <span class="p-cong">{p.nombre_congregacion || '-'}</span>
                        </div>
                    </button>
                    {/each}
                </div>
            {/if}
        </div>

        <div class="divisor-modal">
            <span>O ingresa los detalles para crear uno nuevo</span>
        </div>

        <div class="formulario-creacion">
            <div class="campo-full">
                <label class="label-modal">Nombre completo</label>
                <input type="text" placeholder="Ej: Juan Pérez" bind:value={nuevoNombre} class="input-modal" />
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
                <input type="text" placeholder="hermano@email.com" bind:value={nuevoEmail} class="input-modal" />
            </div>

            <div class="campo-full">
                <label class="label-modal">Teléfono móvil</label>
                <input type="text" placeholder="+53..." bind:value={nuevoTelefono} class="input-modal" />
            </div>
        </div>

    </div>
    
    <div class="footer-modal">
        <button class="btn-cancelar-accion" on:click={() => mostrarModal = false}>
            Cancelar
        </button>
        <button 
           class="btn-crear-accion" 
           on:click={crearYSeleccionar} 
           disabled={!nuevoNombre.trim()}
        >
           <Check size={16}/> Crear y Asignar
        </button>
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
/* Estilo base del botón de acción */
/* ========================================================
   EFECTOS VISUALES AVANZADOS (HOVER)
   ======================================================== */
/* ========================================================
   EFECTOS HOVER PREMIUM (LÁPIZ AZUL / BASURA ROJA)
   ======================================================== */

.icon-btn { 
    background: #ffffff; 
    border: 1.5px solid #e5e7eb; /* Borde inicial gris claro */
    color: #6b7280; 
    cursor: pointer; 
    padding: 8px; 
    border-radius: 8px; 
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

/* --- HOVER LÁPIZ (AZUL ACERO) --- */
.icon-btn.btn-editar:hover { 
    background: rgba(40, 110, 180, 0.05);
    color: #286eb4;
    border-color: #286eb4;
    box-shadow: 0 0 10px rgba(40, 110, 180, 0.25);
    transform: translateY(-2px);
}

.icon-btn.btn-eliminar:hover { 
    background: rgba(239, 68, 68, 0.05);
    color: #ef4444;
    border-color: #ef4444;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.25);
    transform: translateY(-2px);
}

/* Efecto de pulsación */
.icon-btn:active {
    transform: translateY(0) scale(0.95);
    box-shadow: none;
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

/* Contenedor relativo */
.input-con-icono { 
    position: relative; 
    display: flex; 
    align-items: center; 
    width: 100%;
}

/* Forzamos el icono a la izquierda absoluta */
.icono-izq { 
    position: absolute; 
    left: 12px; 
    display: flex;
    align-items: center;
    pointer-events: none; 
}

/* El input hace el espacio para la lupa */
.input-modal { 
    width: 100%; 
    /* Forzamos el espacio a la izquierda con 40px */
    padding: 10px 12px 10px 40px !important; 
    border: 1px solid #d1d5db; 
    border-radius: 6px; 
    font-size: 14px; 
    color: #111827; 
    outline: none; 
    transition: border-color 0.2s, box-shadow 0.2s; 
    box-sizing: border-box; 
    background: #ffffff; 
}
.input-modal:focus { 
    border-color: #286eb4; 
    box-shadow: 0 0 0 3px rgba(40,110,180,0.15); 
}

/* 3. Movemos el icono a la izquierda (aunque la clase se llame 'icono-der', la forzamos a la izquierda) */
.icono-der { 
    position: absolute; 
    left: 12px; /* <-- Cambiamos 'right' por 'left' */
    pointer-events: none; 
}

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

.asamblea-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}
.asamblea-badge svg {
  color: var(--primary);
}

/* Estilo base para los botones circulares de la tarjeta */
.qa-btn {
    width: 36px; height: 36px; border-radius: 50%; 
    border: 1.5px solid #e5e7eb; background: white;
    color: #6b7280; display: flex; align-items: center; 
    justify-content: center; cursor: pointer; 
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover Teléfono / Llamar (Azul) */
.qa-btn[title="Llamar"]:hover {
    border-color: #286eb4 !important; 
    color: #286eb4 !important;
    background: rgba(40, 110, 180, 0.05) !important;
    box-shadow: 0 0 8px rgba(40, 110, 180, 0.2) !important;
}

/* Hover WhatsApp (Verde WhatsApp) */
.qa-btn[title="Enviar WhatsApp"]:hover {
    border-color: #22c55e !important; 
    color: #22c55e !important;
    background: rgba(34, 197, 94, 0.05) !important;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.2) !important;
}

/* Hover JW Email (Naranja JW) */
.btn-jw-card:hover {
    border-color: #f97316 !important; 
    color: #f97316 !important;
    background: rgba(249, 115, 22, 0.05) !important;
    box-shadow: 0 0 8px rgba(249, 115, 22, 0.2) !important;
}

.qa-btn:active { transform: scale(0.9); }

.subtitulo-general {
    font-size: 18px;
    font-weight: 800;
    color: var(--text-main);
    margin: 40px 0 15px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
</style>