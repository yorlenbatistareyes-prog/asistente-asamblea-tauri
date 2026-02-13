<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { open as openUrl } from '@tauri-apps/plugin-shell';
  import { slide } from 'svelte/transition'; 
  
  // --- NUEVAS IMPORTACIONES PARA EL SISTEMA MODULAR ---
  import { generarContexto } from '$lib/utils/contexto_impresion';
  import { generarCartaPDF } from '$lib/utils/impresion';

  // NUEVO: Importamos la función de exportar desde la ruta limpia
  import { exportarProgramaPDF, exportarOficinaPDF } from '$lib/utils/exportar';
  
  import { 
    Users, Video, Mic, Search, X, Plus, Trash2, FileUp, 
    MapPin, Phone, Mail, UserPlus, UserMinus, ChevronRight, ChevronDown, ChevronUp,
    FileCheck, UserCheck, User, Printer, FileJson, Edit, Clock, MessageCircle, FileSpreadsheet, Settings, CheckSquare,
    FileText, Download 
  } from 'lucide-svelte';

  import { prepararContenidoEmail, prepararAsuntoEmail } from '$lib/utils/contextoEmail';
  // NUEVO: importamos desde plantillasEmail.ts
  import { emailTemplates, obtenerPlantillaPorId, cargarPlantillasEmail } from '$lib/utils/plantillasEmail';

  import { whatsAppTemplates, obtenerPlantillaWhatsAppPorId, cargarPlantillasWhatsApp } from '$lib/utils/plantillasWhatsApp';
  import { prepararContenidoWhatsApp } from '$lib/utils/contextoWhatsApp';
  
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
  let nuevaParte = { hora: '', tema: '', tipo: 'Discurso', duracion: 10, sesion: 'Mañana', nombre_orador: '', congregacion: '', email: '', telefono: '', numero_bosquejo: '' };
  
  let sugerenciasOradores: any[] = [];
  let mostrarSugerencias = false;

  // --- onMount MEJORADO ---
  onMount(async () => {
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        asambleaId = JSON.parse(datosGuardados).id;
        
        // Cargamos todo en paralelo
        await Promise.all([
            cargarDatos(),
            cargarHermanos(),
            cargarPlantillasEmail(),  
            cargarPlantillasWhatsApp()
        ]);
        
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
            // Asegurar que numero_bosquejo no sea nulo
            numero_bosquejo: p.numero_bosquejo || "",
            email_enviado: false, 
            carta_recibida_check: false, 
            jwpub_enviado: false, 
            recordatorio_enviado: false, 
            ensayo_terminado: false,
            whatsapp_enviado: false,               // <--- NUEVO
            recordatorio_whatsapp_enviado: false   // <--- NUEVO
        }));
    } catch (e) { console.error(e); }
    
    try { 
        const datos = await invoke('obtener_asignaciones_especiales', { asambleaId, dia: diaSeleccionado }) as any[]; 
        organizarOficina(datos); 
    } catch (e) { console.error(e); }
  }

  function organizarOficina(datos: any[]) {
      // Reiniciamos con estructura segura
      let nuevaOficina: any = { 
          personal: [], 
          presidente_manana: null, oracion_apertura: null, bosquejos_manana: null, plataforma_manana: null, 
          presidente_tarde: null, oracion_conclusion: null, bosquejos_tarde: null, plataforma_tarde: null 
      };
      
      if (datos && Array.isArray(datos)) {
          datos.forEach(d => {
              d.estado = d.estado || 'Pendiente';
              d.esta_presente = d.esta_presente || false;
              d.ensayo_terminado = d.ensayo_terminado || false;
              d.carta_recibida_check = false;
              d.whatsapp_enviado = false;
              d.recordatorio_whatsapp_enviado = false;

              if (d.tipo_asignacion === 'personal_oficina') {
                  nuevaOficina.personal.push(d);
              } else if (Object.keys(nuevaOficina).includes(d.tipo_asignacion)) {
                  nuevaOficina[d.tipo_asignacion] = d;
              }
          });
      }
      oficina = nuevaOficina; // Asignación reactiva final
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

 // --- BOTÓN 1: WHATSAPP PARA ASIGNACIÓN (CARTA / RECORDATORIO DE ASIGNACIÓN) ---
async function abrirWhatsAppAsignacion(objeto: any) {
    const url = await obtenerUrlWhatsApp(objeto, false);
    if (url) {
        openUrl(url).catch(e => console.error(e));
        objeto.whatsapp_enviado = true;
        partes = partes;
        actualizarVistaOficina(objeto);
    }
}

// --- BOTÓN 2: WHATSAPP PARA RECORDATORIO DE ENSAYO ---
async function abrirWhatsAppRecordatorio(objeto: any) {
    const url = await obtenerUrlWhatsApp(objeto, true);
    if (url) {
        openUrl(url).catch(e => console.error(e));
        objeto.recordatorio_whatsapp_enviado = true;
        partes = partes;
        actualizarVistaOficina(objeto);
    }
}

  // --- LÓGICA DE ENVÍO DE CORREOS (Separada e Independiente) ---

// --- FUNCIÓN MEJORADA: OBTENER URL DE CORREO (CON MARCADORES COMPLETOS) ---
// --- FUNCIÓN DEFINITIVA (SIN MAPEO MANUAL, SIN ERRORES TS) ---
async function obtenerUrlCorreo(objeto: any, esRecordatorio: boolean): Promise<string | null> {
    // 1. Validar correo
    const emailDestino = (objeto.email_visual || objeto.email_orador || objeto.email || "").trim();
    if (!emailDestino) {
        alert("⚠️ No hay correo registrado.");
        return null;
    }

    // 2. ID de plantilla según rol
    let idPlantilla = 'oradores';
    const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();
    if (rol.includes('presidente')) idPlantilla = 'presidentes';
    else if (rol.includes('oracion')) idPlantilla = 'oraciones';

    // 3. Obtener plantilla (síncrono, del store)
    const plantilla = obtenerPlantillaPorId(idPlantilla);
    const asuntoBase = plantilla?.subject || "Asignación JWPUB";
    const cuerpoBase = plantilla?.body || "⚠️ No se ha definido una plantilla para este tipo de asignación.";

    // 4. Obtener contexto COMPLETO (¡ya tiene todo!)
    const contexto = await generarContexto(objeto, asambleaId, true);

    // 5. Procesar asunto y cuerpo con las funciones NUEVAS (pasando contexto directamente)
    let asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
    let cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);

    // 6. Si es recordatorio, prefijo
    if (esRecordatorio) {
        asuntoFinal = "RECORDATORIO: " + asuntoFinal;
    }

    // 7. Construir URL de JWPUB (con # en lugar de ?)
    return `https://mail.jwpub.org/owa/#path=/mail/action/compose` +
       `&to=${encodeURIComponent(emailDestino)}` +
       `&subject=${encodeURIComponent(asuntoFinal)}` +
       `&body=${encodeURIComponent(cuerpoFinal)}`;
    }
  // --- BOTÓN 1: ENVIAR CARTA ---
async function abrirJWPUBCarta(objeto: any) {
    const url = await obtenerUrlCorreo(objeto, false);
    if (url) {
        openUrl(url).catch(e => console.error(e));
        objeto.jwpub_enviado = true;
        partes = partes; 
        actualizarVistaOficina(objeto);
    }
}

// --- BOTÓN 2: ENVIAR RECORDATORIO ---
async function abrirJWPUBRecordatorio(objeto: any) {
    const url = await obtenerUrlCorreo(objeto, true);
    if (url) {
        openUrl(url).catch(e => console.error(e));
        objeto.recordatorio_enviado = true;
        partes = partes;
        actualizarVistaOficina(objeto);
    }
}

// --- CONFIGURACIÓN DE PLANTILLAS ---
  // Las claves de la derecha ('presidentes', 'oraciones') coinciden con 
  // los nombres de las tarjetas donde guardaste el texto en el Editor.
  const MAPA_PLANTILLAS: Record<string, string> = {
      'programa': 'oradores',       // Para discursos normales
      'presidente': 'presidentes',  // <--- AQUÍ ESTÁ LA MAGIA
      'oracion': 'oraciones',       // <--- Y AQUÍ
      'plataforma': 'oradores',     // (O usa una genérica si no tienes esta)
      'personal': 'oradores',       // (O usa una genérica)
      'default': 'oradores'         
  };

  // --- LÓGICA DE WHATSAPP (CON PLANTILLAS) ---
// --- LÓGICA DE WHATSAPP CON CARGA DIRECTA DESDE RUST ---
async function obtenerUrlWhatsApp(objeto: any, esRecordatorio: boolean = false): Promise<string | null> {
    // 1. Validar teléfono
    const telefono = (objeto.telefono_visual || objeto.telefono_orador || objeto.telefono || "").trim();
    if (!telefono) {
        alert("⚠️ No hay teléfono registrado.");
        return null;
    }

    // 2. ID de plantilla según rol
    let idPlantilla = 'oradores';
    const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();
    if (rol.includes('presidente')) idPlantilla = 'presidentes';
    else if (rol.includes('oracion')) idPlantilla = 'oraciones';
    else if (esRecordatorio) idPlantilla = 'ensayo';

    // 3. Intentar obtener del store
    let plantilla = obtenerPlantillaWhatsAppPorId(idPlantilla);
    let cuerpoBase = plantilla?.body || "";

    // 4. Si no está en el store, cargar directamente desde Rust
    if (!cuerpoBase) {
        console.log(`📱 Plantilla WhatsApp "${idPlantilla}" no encontrada en store, cargando desde Rust...`);
        try {
            const res: any = await invoke('obtener_plantilla_mensaje', { id: idPlantilla });
            if (res && res.cuerpo) {
                cuerpoBase = res.cuerpo;
                // Opcional: actualizar el store para futuras ocasiones
                // (puedes implementar una función para esto si quieres)
            }
        } catch (e) {
            console.error(`Error cargando plantilla WhatsApp ${idPlantilla}:`, e);
        }
    }

    // 5. Si sigue vacío, usar texto de respaldo
    if (!cuerpoBase) {
        cuerpoBase = "⚠️ No se ha definido una plantilla para WhatsApp.";
    }

    // 6. Obtener contexto y procesar mensaje
    const contexto = await generarContexto(objeto, asambleaId, true);
    let mensaje = prepararContenidoWhatsApp(cuerpoBase, contexto);
    mensaje = mensaje.substring(0, 4000); // Límite de WhatsApp

    // 7. Construir URL
    const numero = telefono.replace(/\D/g, '');
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

  // --- FUNCIÓN DE IMPRESIÓN (Con Mapa) ---
  async function procesarImpresion(objeto: any, esPartePrograma: boolean) {
      if (!objeto || !asambleaId) return alert("⚠️ Seleccione una fila.");
      
      try {
          // 1. Preparamos los datos
          const contexto = await generarContexto(objeto, asambleaId, esPartePrograma);

          // 2. Elegimos qué plantilla usar usando el Mapa
          let plantillaId = '';

          if (esPartePrograma) {
              plantillaId = MAPA_PLANTILLAS['programa'];
          } else {
              // Detectamos el rol del hermano
              const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();
              
              if (rol.includes('presidente')) {
                  plantillaId = MAPA_PLANTILLAS['presidente']; 
              } 
              else if (rol.includes('oracion') || rol.includes('oración')) {
                  plantillaId = MAPA_PLANTILLAS['oracion'];
              } 
              else if (rol.includes('plataforma')) {
                  plantillaId = MAPA_PLANTILLAS['plataforma'];
              }
              else {
                  plantillaId = MAPA_PLANTILLAS['default'];
              }
          }

          console.log(`🖨️ Rol: "${contexto.tipo_asignacion}" -> Buscando plantilla ID: "${plantillaId}"`);

          // 3. Verificamos que la plantilla exista antes de imprimir
          const existe = await invoke('obtener_plantilla', { id: plantillaId });
          
          if (!existe) {
              // Si falla, mostramos qué plantillas SÍ existen para ayudarte
              const disponibles: any[] = await invoke('obtener_todas_plantillas');
              const ids = disponibles.map(p => p.id).join(', ');
              alert(`⛔ ERROR: No se encuentra la plantilla con ID "${plantillaId}".\n\nEl sistema intentó usar "${plantillaId}" para este hermano, pero no existe en la base de datos.\n\nIDs disponibles: [ ${ids} ]`);
              return;
          }

          // 4. Imprimimos
          await generarCartaPDF(contexto, plantillaId);

      } catch (e) { 
          console.error("Error impresión:", e);
          alert("Error al procesar: " + e); 
      }
  }

  function clickEnOficina(key: string, asignacion: any) {
      if (asignacion) {
          const datos = prepararDatosOficina(asignacion);
          asignacionOficinaActual = { ...datos, rol_key: key };
          mostrarModalGestionOficina = true;
      } else { abrirModalOficina(key); }
  }

  function clickEnPersonal(persona: any) {
      const datos = prepararDatosOficina(persona);
      asignacionOficinaActual = { ...datos, es_personal: true };
      mostrarModalGestionOficina = true;
  }

  function abrirModalPrograma(parte: any) { 
    parteEditando = { ...parte }; 
    rolOficinaEditando = null; 
    terminoBusqueda = ""; 
    mostrarModalAsignar = true; 
  }

  function abrirModalOficina(rol: string) { 
    rolOficinaEditando = rol; 
    parteEditando = null; 
    terminoBusqueda = ""; 
    mostrarModalAsignar = true; 
  }
  
  function cerrarModales() { 
      mostrarModalAsignar = false; 
      mostrarModalCrear = false; 
      mostrarModalGestionOficina = false;
      parteEditando = null; 
      rolOficinaEditando = null; 
      asignacionOficinaActual = null;
  }

  // --- FUNCIÓN PARA ACTUALIZAR SOLO EL NÚMERO DE BOSQUEJO ---
  async function actualizarBosquejo(parteId: number, numeroBosquejo: string) {
    try {
        await invoke('actualizar_numero_bosquejo', { 
            idParte: parteId, 
            numeroBosquejo: numeroBosquejo.trim() || null 
        });
        await cargarDatos();
    } catch (e) {
        console.error("Error al actualizar número de bosquejo:", e);
        alert("Error al guardar el número de bosquejo: " + e);
    }
  }

// --- FUNCIÓN CORREGIDA Y CON DEPURACIÓN ---
  async function asignarOrador(oradorId: number | null, esVideo: boolean) {
    
    // CASO 1: OFICINA (Presidente, Oración, etc.)
    if (rolOficinaEditando) {
        console.log("Intento asignar oficina:", rolOficinaEditando, oradorId); // DEBUG

        if (!oradorId) return alert("Por favor, selecciona un hermano.");

        try {
            // NOTA: 'tipoAsignacion' en JS -> se convierte a 'tipo_asignacion' en Rust
            await invoke('guardar_asignacion_especial', { 
                asambleaId: asambleaId, 
                dia: diaSeleccionado,
                tipoAsignacion: rolOficinaEditando, 
                personaId: oradorId 
            });
            
            console.log("¡Asignación exitosa en Rust!"); // DEBUG
            cerrarModales();
            await cargarDatos(); 
        } catch (e) {
            console.error("Error Rust Oficina:", e); // DEBUG
            alert("Error al guardar en oficina: " + e);
        }
        return; // IMPORTANTE: Detenemos aquí.
    }

    // CASO 2: PROGRAMA (Discursos)
    if (parteEditando) {
        const bsq = parteEditando?.numero_bosquejo?.trim() || "";
        try {
          await invoke('asignar_parte', { 
            idParte: parteEditando.id, 
            oradorId: oradorId, 
            esVideo: esVideo,
            numeroBosquejo: bsq || null
          });
          cerrarModales();
          await cargarDatos(); 
        } catch (e) {
          alert("Error al guardar parte: " + e);
        }
    }
  }

  async function guardarNuevaParte() {
    if(!nuevaParte.hora || !nuevaParte.tema) return alert("Faltan datos");
    try {
      await invoke('crear_parte', { 
        asambleaId, 
        dia: diaSeleccionado, 
        sesion: nuevaParte.sesion, 
        hora: nuevaParte.hora, 
        tema: nuevaParte.tema, 
        tipo: nuevaParte.tipo, 
        duracion: Number(nuevaParte.duracion), 
        nombre_orador: nuevaParte.nombre_orador.trim() || null, 
        congregacion: nuevaParte.congregacion.trim() || null, 
        email: nuevaParte.email.trim() || null, 
        telefono: nuevaParte.telefono.trim() || null,
        numero_bosquejo: nuevaParte.numero_bosquejo.trim() || null 
      });
      mostrarModalCrear = false; 
      nuevaParte = { hora: '', tema: '', tipo: 'Discurso', duracion: 10, sesion: 'Mañana', nombre_orador: '', congregacion: '', email: '', telefono: '', numero_bosquejo: '' };
      await cargarDatos(); 
    } catch (e) { 
      alert("Error al crear parte: " + e); 
    }
  }

  async function limpiarTodo() {
    if(confirm("¿Borrar todo el programa de este día?")) { 
        try {
            await invoke('limpiar_programa', { asambleaId }); 
            await cargarDatos(); 
        } catch (e) { alert(e); }
    } 
  }

  async function eliminarParte(id: number) { 
    if(confirm("¿Eliminar esta parte?")) { 
        await invoke('eliminar_parte', { id }); 
        cargarDatos(); 
    } 
  }
  
  async function importarPrograma() { 
      try { 
          const f = await openDialog({ filters: [{ name: 'CSV', extensions: ['csv'] }] }); 
          if(f) { 
              await invoke('importar_programa_jw', { asambleaId, rutaArchivo: f }); 
              await cargarDatos(); 
              await cargarHermanos(); 
          } 
      } catch(e) { alert("Error: " + e); } 
  }

  async function obtenerTodosLosEmails() {
      const emails = new Set<string>();
      const dias = ['Viernes', 'Sábado', 'Domingo'];
      for (const dia of dias) {
          try {
              const res = await invoke('obtener_programa_dia', { asambleaId, dia }) as any[];
              res.forEach(parte => { if (parte.email_orador && !parte.es_video) emails.add(parte.email_orador.trim()); });
          } catch (e) { console.error(e); }
      }
      return Array.from(emails);
  }

  function enviarJWPUBATodos() {
      obtenerTodosLosEmails().then(emails => {
          if (emails.length === 0) return alert("⚠️ No hay correos.");
          openUrl(`https://mail.jwpub.org/owa/?path=/mail/action/compose&to=${encodeURIComponent(emails.join(';'))}`);
      });
  }

    // --- FILTRADO PARA SUGERENCIAS (CUANDO ESCRIBES NUEVA PARTE) ---
  function filtrarOradores() { 
    const t = nuevaParte.nombre_orador.toLowerCase(); 
    if (t.length < 2) {
      sugerenciasOradores = [];
      mostrarSugerencias = false;
      return;
    } 
    sugerenciasOradores = listaHermanos.filter(h => 
      h.nombre_completo.toLowerCase().includes(t)
    ); 
    mostrarSugerencias = sugerenciasOradores.length > 0; 
  }

  function selectSugerencia(h: any) { 
    nuevaParte.nombre_orador = h.nombre_completo; 
    nuevaParte.congregacion = h.nombre_congregacion || ''; 
    nuevaParte.telefono = h.telefono || ''; 
    nuevaParte.email = h.email || ''; 
    mostrarSugerencias = false; 
  }
  
 // --- FILTRADO PARA EL MODAL DE ASIGNACIÓN (BUSCADOR) ---
  function getHermanosFiltrados() {
    // CAMBIO: Si la búsqueda está vacía, mostramos a TODOS los hermanos
    if (!terminoBusqueda) return listaHermanos;
    
    // Si escribes algo, entonces filtramos
    return listaHermanos.filter(h => 
      h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase())
    );
  }

  // --- FUNCIÓN AUXILIAR (sin cambios) ---
  const nombreTxt = (obj: any) => obj ? obj.nombre_completo : "Seleccionar...";
 </script>

<div class="layout-programa">
  <aside class="panel-oficina dark-theme">
    <div class="header-oficina-dark">
      <h3><Users size={20}/> Oficina</h3>
      
      <button class="btn-icon-pdf" 
              title="Exportar Oficina a PDF"
              on:click={() => exportarOficinaPDF(oficina, oficina.personal || [], diaSeleccionado)}>
        <FileUp size={18}/> </button>

      <span class="badge-dark">{diaSeleccionado}</span>
    </div>
    <div class="contenido-oficina">
        
      <div class="seccion-oficina">
        <h4 class="titulo-seccion">PERSONAL</h4>
        <div class="lista-personal">
          {#each oficina.personal as p}
            <div class="item-personal clickable" role="button" tabindex="0" 
                 on:click={() => clickEnPersonal(p)} 
                 on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && clickEnPersonal(p)}>
              <div class="info-personal">
                <span class="nombre-p">{p.nombre_completo}</span>
                <div class="indicadores-mini">
                  {#if p.estado === 'Confirmado'}
                    <div class="dot-icon blue" title="Recibido"><FileCheck size={10} strokeWidth={3}/></div>
                  {/if}
                  {#if p.esta_presente}
                    <div class="dot-icon green" title="Presente"><UserCheck size={10} strokeWidth={3}/></div>
                  {/if}
                  {#if p.ensayo_terminado}
                    <div class="dot-icon yellow" title="Ensayo"><Mic size={10} strokeWidth={3}/></div>
                  {/if}
                </div>
              </div>
              <Settings size={14} class="icon-gear"/>
            </div>
          {/each}
          {#if oficina.personal.length === 0}
            <span class="vacio">(Vacío)</span>
          {/if}
        </div>
        <button class="btn-add-dark" on:click={() => abrirModalOficina('personal_oficina')}>
          <UserPlus size={14}/> Añadir
        </button>
      </div>
      
      <div class="separador-dark"></div>
      
      <div class="seccion-oficina">
        <h4 class="titulo-seccion">MAÑANA</h4>
        {#each [{ label: 'Presidente', key: 'presidente_manana' }, { label: 'Oración', key: 'oracion_apertura' }, { label: 'Bosquejos', key: 'bosquejos_manana' }, { label: 'Plataforma', key: 'plataforma_manana' }] as item, idx}
          <div class="campo-dark">
            <label for="btn_manana_{idx}">{item.label}</label>
            <button id="btn_manana_{idx}" class="btn-select-dark" 
                    class:ocupado={oficina[item.key]} 
                    on:click={() => clickEnOficina(item.key, oficina[item.key])}>
              <div class="btn-content-left">
                <span class="text-truncate">{nombreTxt(oficina[item.key])}</span>
                {#if oficina[item.key]}
                  <div class="indicadores-mini">
                    {#if oficina[item.key].estado === 'Confirmado'}
                      <div class="dot-icon blue"><FileCheck size={10} strokeWidth={3}/></div>
                    {/if}
                    {#if oficina[item.key].esta_presente}
                      <div class="dot-icon green"><UserCheck size={10} strokeWidth={3}/></div>
                    {/if}
                    {#if oficina[item.key].ensayo_terminado}
                      <div class="dot-icon yellow"><Mic size={10} strokeWidth={3}/></div>
                    {/if}
                  </div>
                {/if}
              </div>
              {#if oficina[item.key]} 
                <Settings size={14} class="icon-gear"/> 
              {:else} 
                <ChevronRight size={14}/> 
              {/if}
            </button>
          </div>
        {/each}
      </div>

      <div class="seccion-oficina mt-4">
        <h4 class="titulo-seccion">TARDE</h4>
        {#each [{ label: 'Presidente', key: 'presidente_tarde' }, { label: 'Oración', key: 'oracion_conclusion' }, { label: 'Bosquejos', key: 'bosquejos_tarde' }, { label: 'Plataforma', key: 'plataforma_tarde' }] as item, idx}
          <div class="campo-dark">
            <label for="btn_tarde_{idx}">{item.label}</label>
            <button id="btn_tarde_{idx}" class="btn-select-dark" 
                    class:ocupado={oficina[item.key]} 
                    on:click={() => clickEnOficina(item.key, oficina[item.key])}>
              <div class="btn-content-left">
                <span class="text-truncate">{nombreTxt(oficina[item.key])}</span>
                {#if oficina[item.key]}
                  <div class="indicadores-mini">
                    {#if oficina[item.key].estado === 'Confirmado'}
                      <div class="dot-icon blue"><FileCheck size={10} strokeWidth={3}/></div>
                    {/if}
                    {#if oficina[item.key].esta_presente}
                      <div class="dot-icon green"><UserCheck size={10} strokeWidth={3}/></div>
                    {/if}
                    {#if oficina[item.key].ensayo_terminado}
                      <div class="dot-icon yellow"><Mic size={10} strokeWidth={3}/></div>
                    {/if}
                  </div>
                {/if}
              </div>
              {#if oficina[item.key]} 
                <Settings size={14} class="icon-gear"/> 
              {:else} 
                <ChevronRight size={14}/> 
              {/if}
            </button>
          </div>
        {/each}
      </div>
    </div>
  </aside>

  <main class="panel-discursos">
    <div class="tabs">
      {#each ['Viernes', 'Sábado', 'Domingo'] as dia}
        <button class:active={diaSeleccionado === dia} on:click={() => diaSeleccionado = dia}>
          {dia}
        </button>
      {/each}
    </div>

    <div class="header-sesion">
  <div class="header-sesion-left">
    <h2>Programa - {diaSeleccionado}</h2>
    
    <button class="btn-header-orange" on:click={enviarJWPUBATodos} title="Enviar JWPUB a todos los oradores">
      <FileJson size={18}/> <span>JWPUB a Todos</span>
    </button>
  </div>
  
  <div class="acciones-header">
    <button class="btn-header-csv" on:click={importarPrograma} title="Importar programa desde archivo CSV">
      <FileSpreadsheet size={18}/> <span>Importar</span>
    </button>

    <button class="btn-header-pdf" on:click={() => exportarProgramaPDF(partes, diaSeleccionado)} title="Exportar lista de discursos a PDF">
        <FileUp size={18}/> <span>PDF</span>
    </button>

    <button class="btn-header-delete" on:click={limpiarTodo} title="Borrar todo el programa del día">
      <Trash2 size={18}/> <span>Limpiar</span>
    </button>
    
    <button class="btn-primary" on:click={() => mostrarModalCrear = true} title="Agregar nueva parte al programa">
      <Plus size={18}/> <span>Agregar</span>
    </button>
  </div>
</div>

    <div class="lista-partes">
      {#if partes.length === 0}
        <div class="empty-state"><p>Programa vacío para este día.</p></div>
      {/if}
      
      {#each partes as parte}
        <div class="tarjeta-acordeon" 
             class:expanded={parte._expanded}
             class:estado-presente={parte.esta_presente}
             class:estado-confirmado={parte.estado === 'Confirmado' && !parte.esta_presente}
             class:estado-ensayo={parte.ensayo_terminado && !parte.esta_presente && parte.estado !== 'Confirmado'}>
          
          <div class="header-parte" role="button" tabindex="0" 
               on:click={() => toggleExpandir(parte.id)} 
               on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpandir(parte.id)}>
            <div class="col-tiempo">
              <span class="hora">{parte.hora_inicio}</span>
              <span class="duracion">({parte.duracion}m)</span>
            </div>
            <div class="col-tema">
              <span class="tema-txt">{parte.tema}</span>
              {#if parte.es_video}
                <span class="badge-video"><Video size={12}/> Video</span>
              {/if}
              {#if parte.numero_bosquejo && parte.numero_bosquejo.trim() !== ''}
                <span class="badge-bosquejo"><FileText size={10}/> Bosquejo: {parte.numero_bosquejo}</span>
              {/if}
            </div>
            <div class="col-orador-mini">
              {#if !parte.es_video}
                <span class="orador-nombre">{parte.nombre_orador || "Sin asignar"}</span>
                {#if parte.congregacion_orador}
                  <span class="cong-mini">{parte.congregacion_orador}</span>
                {/if}
              {/if}
            </div>
            <div class="col-estados-mini">
              {#if parte.estado === 'Confirmado'}
                <div class="icon-indicator blue" title="Asignación Recibida"><FileCheck size={14}/></div>
              {/if}
              {#if parte.esta_presente}
                <div class="icon-indicator green" title="Presente"><UserCheck size={14}/></div>
              {/if}
              {#if parte.ensayo_terminado}
                <div class="icon-indicator yellow" title="Ensayo"><Mic size={14}/></div>
              {/if}
            </div>
            <div class="col-toggle">
              {#if parte._expanded}
                <ChevronUp size={20} color="var(--text-secondary)"/>
              {:else}
                <ChevronDown size={20} color="var(--text-secondary)"/>
              {/if}
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
                      {#if parte.congregacion_orador}
                        <span class="cong-tag">{parte.congregacion_orador}</span>
                      {/if}
                      {#if parte.telefono_orador}
                        <span class="contact-pill"><Phone size={11}/> {parte.telefono_orador}</span>
                      {/if}
                      {#if parte.email_orador}
                        <span class="contact-pill"><Mail size={11}/> {parte.email_orador}</span>
                      {/if}
                    </div>
                  </div>
                  <div class="checks-grandes">
                    <button class="btn-status-toggle blue" 
                            class:active={parte.estado === 'Confirmado'} 
                            on:click={() => toggleConfirmado(parte)}>
                      <FileCheck size={18} /><span>RECIBIDO</span>
                    </button>
                    <button class="btn-status-toggle green" 
                            class:active={parte.esta_presente} 
                            on:click={() => togglePresente(parte)}>
                      <UserCheck size={18} /><span>PRESENTE</span>
                    </button>
                    <button class="btn-status-toggle yellow" 
                            class:active={parte.ensayo_terminado} 
                            on:click={() => toggleStatus(parte, 'ensayo_terminado')}>
                      <Mic size={18} /><span>ENSAYO</span>
                    </button>
                  </div>
                </div>
                <div class="grid-acciones">
                  <div class="grupo-accion">
                    <button class="btn-outline-blue"><Mail size={16}/> ENVIAR CARTA POR EMAIL</button>
                    <div class="checks-row">
                      <label class="check-inline">
                        <input type="checkbox" checked={parte.email_enviado} 
                               on:change={() => toggleStatus(parte, 'email_enviado')}> 
                        Email enviado
                      </label>
                      <label class="check-inline strong-check">
                        <input type="checkbox" checked={parte.carta_recibida_check} 
                               on:change={() => toggleStatus(parte, 'carta_recibida_check')}> 
                        Carta Recibida
                      </label>
                    </div>
                  </div>
                  
                  <div class="grupo-accion center">
                    <button class="btn-outline-gray" on:click={() => procesarImpresion(parte, true)}>
                      <Printer size={16}/> IMPRIMIR CARTA
                    </button>
                  </div>

                  <div class="grupo-accion right">
                    <button class="btn-outline-orange" on:click={() => abrirJWPUBCarta(parte)}>
                      <FileJson size={16}/> JWPUB ENVIAR CARTA
                    </button>
                    <label class="check-inline">
                      <input type="checkbox" checked={parte.jwpub_enviado} 
                             on:change={() => toggleStatus(parte, 'jwpub_enviado')}> 
                      Email JWPUB enviado
                    </label>
                  </div>
                  
                  <div class="grupo-accion">
                    <button class="btn-outline-blue"><Clock size={16}/> RECORDATORIO DE ASIGNACIÓN / EMAIL</button>
                    <label class="check-inline">
                      <input type="checkbox" checked={parte.recordatorio_enviado} 
                             on:change={() => toggleStatus(parte, 'recordatorio_enviado')}> 
                      Recordatorio enviado
                    </label>
                  </div>
                  <div class="grupo-accion center">
                    <button class="btn-outline-green" on:click={() => abrirWhatsAppRecordatorio(parte)}>
                       <MessageCircle size={16}/> RECORDATORIO ENSAYO POR WHATSAPP
                    </button>
                  </div>
                  <div class="grupo-accion right">
                    <button class="btn-outline-orange" on:click={() => abrirJWPUBRecordatorio(parte)}>
                      <FileJson size={16}/> JWPUB RECORDATORIO DE ASIGNACIÓN
                    </button>
                  </div>
                </div>
              {/if}
              <div class="footer-tools">
                <button class="btn-tool edit" on:click={() => abrirModalPrograma(parte)}>
                  <Edit size={14}/> Editar Datos / Asignar
                </button>
                <button class="btn-tool delete" on:click={() => eliminarParte(parte.id)}>
                  <Trash2 size={14}/> Eliminar Parte
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </main>
</div>

{#if mostrarModalGestionOficina && asignacionOficinaActual}
  <div class="modal-backdrop" role="button" tabindex="0" 
       on:click|self={cerrarModales} 
       on:keydown={(e) => e.key === 'Escape' && cerrarModales()}>
    <div class="modal modal-gestion">
      <div class="modal-header header-gestion">
        <div class="titulo-gestion">
          <h3>Gestión de Asignación</h3>
          <span class="subtitulo-rol">
            {asignacionOficinaActual.tipo_asignacion?.replace('_', ' ').toUpperCase() || 'PERSONAL'}
          </span>
        </div>
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
            <button class="btn-status-toggle blue" 
                    class:active={asignacionOficinaActual.estado === 'Confirmado'} 
                    on:click={() => toggleConfirmado(asignacionOficinaActual)}>
              <FileCheck size={18} /><span>RECIBIDO</span>
            </button>
            <button class="btn-status-toggle green" 
                    class:active={asignacionOficinaActual.esta_presente} 
                    on:click={() => togglePresente(asignacionOficinaActual)}>
              <UserCheck size={18} /><span>PRESENTE</span>
            </button>
            <button class="btn-status-toggle yellow" 
                    class:active={asignacionOficinaActual.ensayo_terminado} 
                    on:click={() => toggleStatus(asignacionOficinaActual, 'ensayo_terminado')}>
              <Mic size={18} /><span>ENSAYO</span>
            </button>
          </div>
        </div>
        <div class="divider"></div>
        <div class="grid-acciones">
          <div class="grupo-accion">
            <button class="btn-outline-blue"><Mail size={16}/> ENVIAR CARTA POR EMAIL</button>
            <div class="checks-row">
              <label class="check-inline">
                <input type="checkbox" checked={asignacionOficinaActual.email_enviado} 
                       on:change={() => toggleStatus(asignacionOficinaActual, 'email_enviado')}> 
                Email enviado
              </label>
              <label class="check-inline strong-check">
                <input type="checkbox" checked={asignacionOficinaActual.carta_recibida_check} 
                       on:change={() => toggleStatus(asignacionOficinaActual, 'carta_recibida_check')}> 
                Carta Recibida
              </label>
            </div>
          </div>
          
          <div class="grupo-accion center">
            <button class="btn-outline-gray" on:click={() => procesarImpresion(asignacionOficinaActual, false)}>
              <Printer size={16}/> IMPRIMIR CARTA
            </button>
          </div>

          <div class="grupo-accion right">
            <button class="btn-outline-orange" on:click={() => abrirJWPUBCarta(asignacionOficinaActual)}>
              <FileJson size={16}/> JWPUB ENVIAR CARTA
            </button>
            <label class="check-inline">
              <input type="checkbox" checked={asignacionOficinaActual.jwpub_enviado} 
                     on:change={() => toggleStatus(asignacionOficinaActual, 'jwpub_enviado')}> 
              Email JWPUB enviado
            </label>
          </div>
          
          <div class="grupo-accion">
            <button class="btn-outline-blue"><Clock size={16}/> RECORDATORIO DE ASIGNACIÓN / EMAIL</button>
            <label class="check-inline">
              <input type="checkbox" checked={asignacionOficinaActual.recordatorio_enviado} 
                     on:change={() => toggleStatus(asignacionOficinaActual, 'recordatorio_enviado')}> 
              Recordatorio enviado
            </label>
          </div>
          <div class="grupo-accion center">
            <button class="btn-outline-green" on:click={() => abrirWhatsAppRecordatorio(asignacionOficinaActual)}>
              <MessageCircle size={16}/> RECORDATORIO ENSAYO POR WHATSAPP
            </button>
          </div>
          <div class="grupo-accion right">
            <button class="btn-outline-orange" on:click={() => abrirJWPUBRecordatorio(asignacionOficinaActual)}>
              <FileJson size={16}/> JWPUB RECORDATORIO DE ASIGNACIÓN
            </button>
          </div>
        </div>
      </div>
      <div class="modal-footer footer-gestion">
        <button class="btn-delete-full" on:click={() => eliminarAsignacionOficina(asignacionOficinaActual.id)}>
          <Trash2 size={16}/> Quitar a este hermano de la asignación
        </button>
      </div>
    </div>
  </div>
{/if}

{#if mostrarModalCrear}
  <div class="modal-backdrop" role="button" tabindex="0" 
       on:click|self={cerrarModales} 
       on:keydown={(e) => e.key === 'Escape' && cerrarModales()}>
    <div class="modal">
      <div class="modal-header">
        <h3>Nueva Parte</h3>
        <button class="btn-close" on:click={cerrarModales}><X size={18}/></button>
      </div>
      <div class="modal-body form-body">
        <h4 class="form-title">Detalles</h4>
        <div class="fila">
          <div class="campo">
            <label for="sesion_select">Sesión</label>
            <select id="sesion_select" bind:value={nuevaParte.sesion}>
              <option>Mañana</option>
              <option>Tarde</option>
            </select>
          </div>
          <div class="campo">
            <label for="hora_input">Hora</label>
            <input id="hora_input" type="time" bind:value={nuevaParte.hora} />
          </div>
          <div class="campo">
            <label for="duracion_input">Min</label>
            <input id="duracion_input" type="number" bind:value={nuevaParte.duracion} />
          </div>
        </div>
        <div class="campo">
          <label for="tipo_select">Tipo</label>
          <select id="tipo_select" bind:value={nuevaParte.tipo}>
            <option>Música</option>
            <option>Oración</option>
            <option>Presidente</option>
            <option>Discurso</option>
            <option>Video</option>
          </select>
        </div>
        <div class="campo">
          <label for="tema_input">Tema</label>
          <input id="tema_input" type="text" placeholder="Tema..." bind:value={nuevaParte.tema} />
        </div>
        
        <div class="campo">
          <label for="bosquejo_input">Número de Bosquejo</label>
          <input id="bosquejo_input" type="text" placeholder="Ej: 145" bind:value={nuevaParte.numero_bosquejo} />
        </div>

        {#if nuevaParte.tipo !== 'Video'}
          <div class="separator-line"></div>
          <h4 class="form-title">Asignación Rápida</h4>
          <div class="campo autocomplete-container">
            <label for="orador_input">Orador</label>
            <div class="input-icon">
              <Mic size={14}/>
              <input id="orador_input" type="text" placeholder="Nombre..." 
                     bind:value={nuevaParte.nombre_orador} 
                     on:input={filtrarOradores} 
                     on:blur={() => setTimeout(()=>mostrarSugerencias=false, 200)}/>
            </div>
            {#if mostrarSugerencias}
              <div class="sugerencias-lista">
                {#each sugerenciasOradores as s}
                  <button class="sugerencia-item" on:click={() => selectSugerencia(s)}>
                    {s.nombre_completo}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          {#if nuevaParte.nombre_orador.length > 0}
            <div class="campo">
              <label for="cong_input">Congregación</label>
              <div class="input-icon">
                <MapPin size={14}/>
                <input id="cong_input" type="text" placeholder="Cong..." bind:value={nuevaParte.congregacion} />
              </div>
            </div>
            <div class="fila">
              <div class="campo">
                <label for="tel_input_modal">Tel</label>
                <div class="input-icon">
                  <Phone size={14}/>
                  <input id="tel_input_modal" type="text" bind:value={nuevaParte.telefono} />
                </div>
              </div>
              <div class="campo">
                <label for="email_input_modal">Email</label>
                <div class="input-icon">
                  <Mail size={14}/>
                  <input id="email_input_modal" type="text" bind:value={nuevaParte.email} />
                </div>
              </div>
            </div>
          {/if}
        {/if}
        <button class="btn-guardar" on:click={guardarNuevaParte}>Guardar</button>
      </div>
    </div>
  </div>
{/if}

{#if mostrarModalAsignar && (parteEditando || rolOficinaEditando)}
  <div class="modal-backdrop" role="button" tabindex="0" 
       on:click|self={cerrarModales} 
       on:keydown={(e) => e.key === 'Escape' && cerrarModales()}>
    <div class="modal">
      <div class="modal-header">
        <h3>
            {#if rolOficinaEditando}
                Asignar {rolOficinaEditando.replace('_', ' ').toUpperCase()}
            {:else}
                Asignar Orador
            {/if}
        </h3>
        <button class="btn-close" on:click={cerrarModales}><X size={18}/></button>
      </div>
      <div class="modal-body">
        
        {#if parteEditando}
            <div class="campo-bosquejo" style="margin-bottom: 20px; background: var(--bg-body); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
              <label for="edit_bosquejo" style="color: var(--primary); font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                Número de Bosquejo
              </label>
              <div class="input-icon" style="margin-top: 8px; position: relative; display: flex; align-items: center;">
                <FileText size={16} style="position: absolute; left: 10px; color: var(--text-secondary); pointer-events: none;"/>
                <input 
                  id="edit_bosquejo" 
                  type="text" 
                  placeholder="Ej: 178" 
                  bind:value={parteEditando.numero_bosquejo} 
                  style="padding-left: 35px; width: 100%; height: 38px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main);" 
                />
              </div>
              <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button 
                  class="btn-guardar-bosquejo" 
                  style="background: var(--primary); color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;"
                  on:click={() => actualizarBosquejo(parteEditando.id, parteEditando.numero_bosquejo || '')}
                >
                  Guardar Solo Bosquejo
                </button>
                <small style="font-size: 10px; color: var(--text-secondary); font-style: italic; flex: 1;">
                  * El número se guardará independientemente de asignar orador
                </small>
              </div>
            </div>
        {/if}

        <div class="buscador">
          <Search size={16} color="var(--text-secondary)"/>
          <input type="text" placeholder="Buscar hermano..." bind:value={terminoBusqueda} />
        </div>
        
        <div class="lista-opciones">
          {#if !rolOficinaEditando}
            <button class="item-opcion video-option" on:click={() => asignarOrador(null, true)}>
              <div class="icono-video"><Video size={18}/></div>
              <span>Video</span>
            </button>
          {/if}
          
         {#each getHermanosFiltrados() as h}
            <button class="item-opcion" on:click={() => asignarOrador(h.id, false)}>
              <div class="avatar">{h.nombre_completo.charAt(0)}</div>
              <div class="datos-opcion">
                <span class="nombre">{h.nombre_completo}</span>
                <span class="detalle">{h.nombre_congregacion || '-'}</span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
/* ==========================================================================
   LAYOUT PRINCIPAL
   ========================================================================== */
.layout-programa { 
  display: grid; 
  /* LA MAGIA: La columna izquierda mide 280px, la derecha mide el resto (1fr), 
     PERO nunca podrá medir menos de 450px. */
  grid-template-columns: 280px minmax(450px, 1fr); 
  gap: 20px; 
  height: 100%; 
  
  /* Permite que aparezca la barra de scroll horizontal abajo si la ventana es muy pequeña */
  overflow-x: auto; 
  
  /* Mantiene oculto el scroll vertical general, ya que cada panel tiene el suyo interno */
  overflow-y: hidden; 
  
  /* Un pequeño padding abajo para que la barra de desplazamiento no tape el borde de las tarjetas */
  padding-bottom: 8px; 
}

/* ==========================================================================
   PANEL DE OFICINA (Izquierda)
   Lógica aplicada: Usar var(--bg-card) igual que en el Resumen
   ========================================================================== */
.panel-oficina.dark-theme { 
  background: var(--bg-card); /* Fondo dinámico del sistema */
  color: var(--text-main); 
  border-radius: 12px; 
  display: flex; 
  flex-direction: column; 
  overflow: hidden; 
  border: 1px solid var(--border-color); 
  box-shadow: 0 4px 6px -1px var(--shadow-color);
}

/* El encabezado usa el fondo del cuerpo para contrastar sutilmente con la tarjeta */
.header-oficina-dark { 
  background: var(--bg-body); 
  padding: 15px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  border-bottom: 1px solid var(--border-color); 
}

.header-oficina-dark h3 { 
  margin: 0; 
  font-size: 16px; 
  display: flex; 
  gap: 8px; 
  color: var(--text-main); 
  font-weight: 700;
}

.contenido-oficina { 
  padding: 15px; 
  overflow-y: auto; 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  gap: 20px; 
}

/* Títulos de Sección */
.titulo-seccion { 
  color: var(--text-secondary); 
  font-size: 11px; 
  font-weight: 800; 
  letter-spacing: 1px; 
  margin: 5px 0 10px 0; 
  text-transform: uppercase;
}

/* --- BOTONES DE SELECCIÓN (Inputs) --- */
.btn-select-dark { 
  width: 100%; 
  background: var(--bg-body); /* En lugar de blanco fijo, usa el fondo del body */
  border: 1px solid var(--border-color); 
  color: var(--text-main); 
  padding: 10px 12px; 
  border-radius: 8px; 
  text-align: left; 
  cursor: pointer; 
  font-size: 13px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  transition: all 0.2s; 
  box-shadow: 0 1px 2px 0 var(--shadow-color);
}

.btn-select-dark:hover { 
  border-color: var(--primary); 
  background: var(--hover-bg);
  transform: translateY(-1px);
}

/* Estado Ocupado: Usamos transparencia para que funcione en Dark Mode */
.btn-select-dark.ocupado { 
  background: rgba(59, 130, 246, 0.15); /* Azul translúcido */
  border-color: #3b82f6; 
  color: var(--primary);
}

.separador-dark { 
  height: 1px; 
  background: var(--border-color); 
  margin: 15px 0;
}

/* Items de Personal */
.lista-personal { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }

.item-personal { 
  display: flex; justify-content: space-between; align-items: center; 
  background: var(--bg-body); /* Fondo dinámico */
  padding: 6px 10px; border-radius: 6px; font-size: 13px; 
  border: 1px solid var(--border-color); color: var(--text-main);
}
.item-personal.clickable:hover { background: var(--hover-bg); }

.btn-add-dark { 
  background: none; border: 1px dashed var(--text-secondary); color: var(--text-secondary); 
  width: 100%; padding: 8px; border-radius: 6px; cursor: pointer; display: flex; 
  justify-content: center; gap: 6px; font-size: 12px; 
}
.btn-add-dark:hover { background: var(--hover-bg); color: var(--text-main); }


/* ==========================================================================
   PANEL DE DISCURSOS (Derecha)
   ========================================================================== */
.panel-discursos { 
  background: var(--bg-card); /* Usa variable global */
  border-radius: 10px; 
  border: 1px solid var(--border-color); 
  display: flex; flex-direction: column; overflow: hidden; 
}

.header-sesion { 
  padding: 15px 20px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  flex-wrap: wrap; /* 👈 LA CLAVE 1: Permite bajar de línea */
  border-bottom: 1px solid var(--border-color); 
  gap: 15px; 
  background: var(--bg-card); 
}

.header-sesion h2 { 
  margin: 0; 
  font-size: 18px; 
  color: var(--text-main); 
  white-space: nowrap; /* 👈 Evita que el título se parta en dos líneas */
}

.header-sesion-left { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  flex-wrap: wrap; /* 👈 Permite que el botón JWPUB baje si es necesario */
}

/* Tabs */
.tabs { display: flex; background: var(--bg-body); border-bottom: 1px solid var(--border-color); }
.tabs button { 
  flex: 1; padding: 15px; border: none; background: transparent; 
  font-weight: 600; color: var(--text-secondary); cursor: pointer; 
  border-bottom: 3px solid transparent; 
}
.tabs button.active { 
  color: var(--primary); border-bottom-color: var(--primary); 
  background: var(--bg-card); 
}

.lista-partes { padding: 20px; overflow-y: auto; flex: 1; background: var(--bg-body); }

/* --- TARJETAS ACORDEÓN --- */
.tarjeta-acordeon { 
  background: var(--bg-card); /* Clave para el modo oscuro */
  border-radius: 8px; 
  border: 1px solid var(--border-color); 
  margin-bottom: 10px; 
  overflow: hidden; 
  transition: box-shadow 0.2s; 
  color: var(--text-main);
}
.tarjeta-acordeon:hover { box-shadow: 0 4px 6px var(--shadow-color); }
.tarjeta-acordeon.expanded { border-color: var(--text-secondary); box-shadow: 0 4px 12px var(--shadow-color); }

.header-parte { 
  display: flex; align-items: center; padding: 12px 15px; 
  cursor: pointer; gap: 15px; background: transparent; 
}
.header-parte:hover { background: var(--hover-bg); }
.body-parte { 
  border-top: 1px solid var(--border-color); 
  background: var(--bg-body); 
  padding: 15px 20px; 
  color: var(--text-main); 
}

/* --- ESTADOS Y COLORES SUAVES (Compatibles con Dark Mode) --- */
/* Usamos RGBA (transparencia) en lugar de colores sólidos. 
   Así se ve pastel en blanco y tintado en negro. */

.tarjeta-acordeon.estado-presente { 
  border-left: 6px solid #10b981 !important; 
  background-color: rgba(16, 185, 129, 0.12) !important; /* Verde transparente */
}
.tarjeta-acordeon.estado-confirmado { 
  border-left: 6px solid #3b82f6 !important; 
  background-color: rgba(59, 130, 246, 0.12) !important; /* Azul transparente */
}
.tarjeta-acordeon.estado-ensayo { 
  border-left: 6px solid #eab308 !important; 
  background-color: rgba(234, 179, 8, 0.12) !important; /* Amarillo transparente */
}

/* Hover suave en estados */
.tarjeta-acordeon.estado-presente:hover { background-color: rgba(16, 185, 129, 0.2) !important; }
.tarjeta-acordeon.estado-confirmado:hover { background-color: rgba(59, 130, 246, 0.2) !important; }
.tarjeta-acordeon.estado-ensayo:hover { background-color: rgba(234, 179, 8, 0.2) !important; }

/* Textos */
.hora { font-weight: 800; color: var(--primary); font-size: 14px; }
.duracion { font-size: 11px; color: var(--text-secondary); }
.tema-txt { font-weight: 600; color: var(--text-main); font-size: 14px; line-height: 1.2; }
.orador-nombre { font-weight: 600; color: var(--text-main); font-size: 13px; text-transform: uppercase; }
.cong-mini { font-size: 11px; color: var(--text-secondary); }

/* --- ICONOS MINI (Horizontal Fix) --- */
.col-estados-mini { 
  display: flex !important;
  flex-direction: row !important; /* Fuerza horizontal */
  gap: 6px; 
  min-width: 60px; 
  justify-content: flex-end; 
  align-items: center; 
}

/* Círculos de estado */
.icon-indicator { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; }
.icon-indicator.green { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.icon-indicator.blue { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.icon-indicator.yellow { background: rgba(234, 179, 8, 0.2); color: #eab308; }

.dot-icon { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; }
.dot-icon.blue { background: #3b82f6; color: white; }
.dot-icon.green { background: #10b981; color: white; }
.dot-icon.yellow { background: #eab308; color: white; }

/* Pulse Animation */
.estado-presente .icon-indicator.green { animation: pulse-green 2s infinite; }
@keyframes pulse-green { 
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } 
}

/* Badges */
.badge-video { font-size: 10px; background: var(--bg-body); color: var(--text-secondary); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; width: fit-content; margin-top: 4px; border: 1px solid var(--border-color); }
.badge-bosquejo { font-size: 10px; background: rgba(234, 179, 8, 0.2); color: #ca8a04; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; width: fit-content; margin-top: 4px; border: 1px solid var(--border-color); }
.badge-dark { background: var(--primary); color: white; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; }

/* Botones Cabecera */
.acciones-header { 
  display: flex; 
  gap: 10px; 
  align-items: center;
  flex-wrap: wrap; /* 👈 LA CLAVE 2: Los botones saltan de línea como Tetris */
}

/* 👈 Protegemos los textos de TODOS los botones del header para que no se rompan */
.header-sesion button {
  white-space: nowrap; 
}

.btn-header-orange { background: var(--bg-card); border: 1px solid #f97316; color: #f97316; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; transition: all 0.2s; }
.btn-header-orange:hover { background: rgba(249, 115, 22, 0.1); }
.btn-header-csv { background: var(--bg-card); border: 1px solid #10b981; color: #10b981; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; transition: all 0.2s; }
.btn-header-csv:hover { background: rgba(16, 185, 129, 0.1); }
.btn-header-delete { background: var(--bg-card); border: 1px solid #ef4444; color: #ef4444; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; transition: all 0.2s; }
.btn-header-delete:hover { background: rgba(239, 68, 68, 0.1); }
.btn-primary { background: var(--primary); color: white; padding: 8px 16px; border-radius: 6px; border: none; display: flex; gap: 6px; cursor: pointer; align-items: center; font-size: 12px; font-weight: 600; }

/* Botones Grandes Estado */
.checks-grandes { display: flex; gap: 10px; align-items: center; }
.btn-status-toggle { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: var(--bg-card); border: 1px solid var(--border-color); padding: 5px 2px; width: 70px; border-radius: 6px; cursor: pointer; color: var(--text-secondary); transition: all 0.2s; }
.btn-status-toggle span { font-size: 8.5px; font-weight: 800; text-transform: uppercase; }

.btn-status-toggle.blue.active { background: rgba(59, 130, 246, 0.15); border-color: #3b82f6; color: #2563eb; }
.btn-status-toggle.green.active { background: rgba(16, 185, 129, 0.15); border-color: #10b981; color: #059669; }
.btn-status-toggle.yellow.active { background: rgba(234, 179, 8, 0.15); border-color: #eab308; color: #ca8a04; }

/* Utilidades varias */
.col-tiempo { display: flex; flex-direction: column; min-width: 60px; }
.col-tema { flex: 1; display: flex; flex-direction: column; }
.col-orador-mini { width: 180px; display: flex; flex-direction: column; }
.col-toggle { color: var(--text-secondary); margin-left: 10px; }
.fila-superior-control { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.info-orador-full { display: flex; flex-direction: column; gap: 3px; }
.label-tiny { font-size: 10px; font-weight: bold; color: var(--text-secondary); letter-spacing: 0.5px; }
.info-orador-full strong { font-size: 16px; color: var(--text-main); }
.detalles-contacto-panel { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 3px; }
.cong-tag { background: var(--hover-bg); color: var(--text-main); font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 600; }
.contact-pill { display: flex; align-items: center; gap: 4px; background: var(--bg-card); border: 1px solid var(--border-color); padding: 3px 8px; border-radius: 4px; font-size: 11px; color: var(--text-secondary); }

/* Grid Acciones */
.grid-acciones { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
.grupo-accion { display: flex; flex-direction: column; gap: 5px; }
.grupo-accion.center { align-items: center; }
.grupo-accion.right { align-items: flex-end; }
.btn-outline-blue { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--bg-card); border: 1px solid #2563eb; color: #2563eb; padding: 8px 4px; border-radius: 4px; font-weight: 600; font-size: 11px; cursor: pointer; text-transform: uppercase; transition: all 0.2s; text-align: center; }
.btn-outline-blue:hover { background: rgba(59, 130, 246, 0.1); }
.btn-outline-orange { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--bg-card); border: 1px solid #ea580c; color: #ea580c; padding: 8px 4px; border-radius: 4px; font-weight: 600; font-size: 11px; cursor: pointer; text-transform: uppercase; transition: all 0.2s; text-align: center; }
.btn-outline-orange:hover { background: rgba(249, 115, 22, 0.1); }
.btn-outline-gray { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--bg-card); border: 1px solid var(--text-secondary); color: var(--text-secondary); padding: 8px 4px; border-radius: 4px; font-weight: 600; font-size: 11px; cursor: pointer; text-transform: uppercase; text-align: center; }
.btn-outline-gray:hover { background: var(--hover-bg); color: var(--text-main); }
.btn-outline-green { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--bg-card); border: 1px solid #10b981; color: #10b981; padding: 8px 4px; border-radius: 4px; font-weight: 600; font-size: 11px; cursor: pointer; text-transform: uppercase; text-align: center; }
.btn-outline-green:hover { background: rgba(16, 185, 129, 0.1); }

/* Modales */
.btn-guardar { background: var(--primary); color: white; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; width: 100%; }
.modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal { background: var(--bg-card); width: 450px; border-radius: 12px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border-color); color: var(--text-main); }
.modal-header { padding: 15px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { color: var(--text-main); margin: 0; }
.modal-body { padding: 20px; overflow-y: auto; background: var(--bg-body); }
.btn-close { color: var(--text-secondary); opacity: 0.7; background: none; border: none; cursor: pointer; }
.btn-close:hover { opacity: 1; }
.modal-gestion { width: 750px; max-width: 95vw; }
.header-gestion { background: var(--bg-card); color: var(--text-main); padding: 20px; border-bottom: none; }
.titulo-gestion h3 { margin: 0; font-size: 20px; font-weight: 600; }
.subtitulo-rol { font-size: 12px; background: #3b82f6; padding: 2px 8px; border-radius: 4px; font-weight: bold; margin-top: 5px; display: inline-block; color: white; }
.body-gestion { padding: 30px; background: var(--bg-body); }
.divider { height: 1px; background: var(--border-color); margin: 25px 0; }
.footer-gestion { padding: 15px 30px; background: var(--bg-card); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; }
.btn-delete-full { color: #ef4444; background: #fef2f2; border: 1px solid #fee2e2; padding: 10px 20px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; }
.btn-delete-full:hover { background: #fee2e2; border-color: #fecaca; }

/* Buscador Modal */
.buscador { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); }
.buscador input { border: none; outline: none; flex: 1; background: transparent; color: var(--text-main); }
.lista-opciones { margin-top: 10px; }
.item-opcion { display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-card); border: none; border-bottom: 1px solid var(--border-color); cursor: pointer; width: 100%; text-align: left; color: var(--text-main); }
.item-opcion:hover { background: var(--hover-bg); }
.avatar { width: 32px; height: 32px; background: var(--hover-bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--text-secondary); }
.nombre { font-weight: 600; font-size: 14px; color: var(--text-main); }
.detalle { font-size: 12px; color: var(--text-secondary); }
.form-title { margin: 0; font-size: 14px; border-left: 3px solid var(--primary); padding-left: 8px; color: var(--text-main); }
.separator-line { height: 1px; background: var(--border-color); margin: 10px 0; }
.campo { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
.campo label { font-size: 12px; font-weight: bold; color: var(--text-secondary); }
.campo input, .campo select { padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; background: var(--bg-body); color: var(--text-main); }
.input-icon { position: relative; display: flex; align-items: center; }
.input-icon :global(svg) { position: absolute; left: 10px; color: var(--text-secondary); }
.input-icon input { padding-left: 32px; width: 100%; }
.fila { display: flex; gap: 15px; }
.fila .campo { flex: 1; }
.autocomplete-container { position: relative; }
.sugerencias-lista { position: absolute; top: 100%; left: 0; width: 100%; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; box-shadow: 0 4px 10px var(--shadow-color); z-index: 100; max-height: 200px; overflow-y: auto; margin-top: 5px; }
.sugerencia-item { display: flex; justify-content: space-between; width: 100%; padding: 10px; border: none; background: var(--bg-card); text-align: left; cursor: pointer; border-bottom: 1px solid var(--border-color); color: var(--text-main); }
.sugerencia-item:hover { background: var(--hover-bg); }
.btn-content-left { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.campo-dark { margin-bottom: 12px; }
.campo-dark label { font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 3px; }
.check-inline { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); cursor: pointer; }
.checks-row { display: flex; flex-direction: column; gap: 2px; }
.strong-check { color: var(--text-main); font-weight: 600; font-size: 11px; }
.footer-tools { display: flex; justify-content: flex-end; gap: 15px; border-top: 1px solid var(--border-color); padding-top: 15px; }
.btn-tool { background: none; border: none; font-size: 12px; display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text-secondary); }
.btn-tool:hover { color: var(--primary); text-decoration: underline; }
.btn-tool.delete:hover { color: #ef4444; }
.col-tema { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
/* Forzar que los iconos pequeños de estado (Oficina) se vean horizontales */
.indicadores-mini {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

/* Botón PDF Oficina: Estilo "Ghost" (Fantasma/Limpio) */
.btn-icon-pdf {
  background: transparent;      /* Sin fondo feo */
  border: none;                 /* Sin borde */
  color: var(--text-secondary); /* Color gris suave */
  
  width: 32px;
  height: 32px;
  border-radius: 6px;           /* Bordes redondeados */
  
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  
  margin-left: auto;            /* Empuja el botón a la derecha */
  margin-right: 8px;            /* Un poco de aire con la etiqueta del día */
  transition: all 0.2s ease;
}

/* Efecto al pasar el mouse */
.btn-icon-pdf:hover {
  background-color: var(--hover-bg); /* Fondo sutil al tocar */
  color: var(--primary);             /* El icono se pone azul (o tu color primario) */
  transform: translateY(-1px);       /* Efecto visual de "clic" */
}

/* Efecto al hacer clic */
.btn-icon-pdf:active {
  transform: translateY(1px);
}

/* =========================================
   BOTÓN EXPORTAR PDF (Estilo Profesional)
   ========================================= */

.btn-header-pdf {
  /* Estructura */
  display: flex;
  align-items: center;
  gap: 6px;                /* Espacio entre el icono y el texto */
  
  /* Tamaño y Forma */
  padding: 8px 14px;       /* Un poco más ancho para que se vea bien */
  border-radius: 6px;
  
  /* Colores (Rojo PDF estándar) */
  background-color: transparent; 
  border: 1px solid #ef4444;  /* Rojo vibrante pero elegante */
  color: #ef4444;
  
  /* Texto */
  font-size: 12px;
  font-weight: 700;        /* Letra un poco más gruesa */
  cursor: pointer;
  
  /* Animación suave */
  transition: all 0.2s ease-in-out;
}

/* Efecto al pasar el mouse (Hover) */
.btn-header-pdf:hover {
  background-color: rgba(239, 68, 68, 0.08); /* Fondo rojo muy sutil */
  transform: translateY(-2px);               /* Se eleva un poquito */
  box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2); /* Sombrita roja */
}

/* Efecto al hacer click */
.btn-header-pdf:active {
  transform: translateY(0);
  background-color: rgba(239, 68, 68, 0.15);
}

/* ==========================================================================
   RESPONSIVIDAD: MODO COMPACTO PARA BOTONES DE PROGRAMA
   ========================================================================== */
@media (max-width: 850px) {
  /* Ocultamos las palabras (Importar, Limpiar, PDF, etc.) */
  .header-sesion-left button span,
  .acciones-header button span {
      display: none; 
  }
  
  /* Convertimos los botones en cuadrados perfectos centrando el icono */
  .header-sesion-left button,
  .acciones-header button {
      padding: 8px 10px; 
      justify-content: center;
  }
}

/* ==========================================================================
   RESPONSIVIDAD: MÓVILES Y TABLETAS (Paneles ajustados)
   ========================================================================== */
@media (max-width: 900px) {
  .layout-programa {
    /* Una sola columna que ocupa el 100% del ancho */
    grid-template-columns: 1fr; 
    
    /* LA MAGIA DEL REPARTO VERTICAL: 
       - Fila 1 (Oficina): 220px de alto (Suficiente para ver el buscador y 1-2 campos).
       - Fila 2 (Discursos): 1fr (Se queda con tooooodo el espacio restante). */
    grid-template-rows: 220px 1fr; 
    
    gap: 12px; /* Reducimos un poquito el hueco entre los dos paneles para ganar espacio */
  }

  .panel-oficina.dark-theme {
    max-height: none; /* Quitamos el 350px, ahora el Grid es quien manda */
    margin-bottom: 0; 
  }
}
</style>