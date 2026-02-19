<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { open as openUrl } from '@tauri-apps/plugin-shell';
  import { slide } from 'svelte/transition';
  import { fade } from 'svelte/transition'; 
  import { onDestroy } from 'svelte';
  
  import { generarContexto } from '$lib/utils/contexto_impresion';
  import { generarCartaPDF } from '$lib/utils/impresion';
  import { exportarProgramaPDF } from '$lib/utils/exportar';
  
  import { 
    Users, Video, Mic, Search, X, Plus, Trash2, FileUp, 
    MapPin, Phone, Mail, UserPlus, UserMinus, ChevronRight, ChevronDown, ChevronUp,
    FileCheck, UserCheck, User, Printer, FileJson, Edit, Clock, MessageCircle, FileSpreadsheet, Settings, CheckSquare,
    FileText, Download, ListFilter, Calendar, Globe, Languages, Plane  
  } from 'lucide-svelte';

  import { prepararContenidoEmail, prepararAsuntoEmail } from '$lib/utils/contextoEmail';
  import { emailTemplates, obtenerPlantillaPorId, cargarPlantillasEmail } from '$lib/utils/plantillasEmail';
  import { whatsAppTemplates, obtenerPlantillaWhatsAppPorId, cargarPlantillasWhatsApp } from '$lib/utils/plantillasWhatsApp';
  import { prepararContenidoWhatsApp } from '$lib/utils/contextoWhatsApp';
  import { oradoresPendientes } from '$lib/stores/gestion';
  
  // --- ESTADO ---
  let asambleaId = 0; 
  let diaSeleccionado = 'Viernes';
  let partes: any[] = []; 

  // --- MODALS ---
  let mostrarModalAsignar = false; 
  let mostrarModalCrear = false;   

  let parteEditando: any = null; 
  
  let listaHermanos: any[] = []; 
  let terminoBusqueda = "";
  let nuevaParte = { hora: '', tema: '', tipo: 'Discurso', duracion: 10, sesion: 'Mañana', nombre_orador: '', congregacion: '', email: '', telefono: '', numero_bosquejo: '' };
  
  let sugerenciasOradores: any[] = [];
  let mostrarSugerencias = false;

// --- FILTROS Y ORDENAMIENTO ---
let mostrarPanelFiltros = false;
let mostrarSelectorDia = false;
let diasSeleccionados: string[] = []; // Por defecto todos
let filtroEstado = 'todos'; // 'todos', 'asignada', 'sin_asignar'
let filtrosCaracteristicas = {
  betelita: false,
  interprete: false,
  visitante: false
};
let filtrosFuente = {
  en_persona: false,
  jw_stream: false,
  transmision_remota: false,
  video: false
};
let ordenarPor = 'secuencia'; // 'secuencia' o 'orador'

  // --- onMount ---
  onMount(async () => {
  const datosGuardados = localStorage.getItem('asambleaActiva');
  if (datosGuardados) {
      asambleaId = JSON.parse(datosGuardados).id;
      
      await Promise.all([
          cargarTodosDias(),
          cargarHermanos(),
          cargarPlantillasEmail(),  
          cargarPlantillasWhatsApp()
      ]);
  } else {
      alert("⚠️ No hay asamblea seleccionada.");
  }
  
  // Event listener para cerrar el dropdown
  window.addEventListener('click', handleClickOutside);
});

onDestroy(() => {
  window.removeEventListener('click', handleClickOutside);
  window.removeEventListener('confirmar-parte', onSolicitudConfirmar as EventListener);
});

// ELIMINA esta línea que está más abajo:
// $: if (diaSeleccionado && asambleaId) cargarDatos();

  async function cargarDatos() {
    if (!asambleaId) return;
    const abiertos = new Set(partes.filter(p => p._expanded).map(p => p.id));

    try { 
        const res = await invoke('obtener_programa_dia', { asambleaId, dia: diaSeleccionado }) as any[]; 
        partes = res.map(p => ({ 
          ...p, 
          _expanded: abiertos.has(p.id), 
          recibido_manual: p.estado === 'Confirmado',
          estado: p.estado || 'Pendiente',
          esta_presente: p.esta_presente === true || p.esta_presente === 1,
          numero_bosquejo: p.numero_bosquejo || "",
          email_enviado: false, 
          carta_recibida_check: false, 
          jwpub_enviado: false, 
          recordatorio_enviado: false, 
          ensayo_terminado: p.ensayo_terminado || false,
          whatsapp_enviado: false,
          recordatorio_whatsapp_enviado: false,
          fuente: p.fuente || 'en_persona',
          es_betelita: p.es_betelita || false,
          es_interprete: p.es_interprete || false,
          es_visitante: p.es_visitante || false
        }));
        const pendientes = partes
          .filter(p => p.nombre_orador && (!p.estado || p.estado !== 'Confirmado'))
          .map(p => ({ id: p.id, nombre: p.nombre_orador, tema: p.tema, estado: p.estado || 'Pendiente' }));
        oradoresPendientes.set(pendientes);
    } catch (e) { console.error(e); }
  }

  // Escuchar solicitudes externas de confirmación (desde Resumen u otros)
  function onSolicitudConfirmar(e: Event) {
    const parteId = (e as CustomEvent)?.detail?.id;
    if (!parteId) return;
    const encontrado = partes.find(p => p.id === parteId);
    if (encontrado) {
      (async () => {
        await toggleConfirmado(encontrado);
        const pendientes = partes
          .filter(p => p.nombre_orador && (!p.estado || p.estado !== 'Confirmado'))
          .map(p => ({ id: p.id, nombre: p.nombre_orador, tema: p.tema, estado: p.estado || 'Pendiente' }));
        oradoresPendientes.set(pendientes);
      })();
    }
  }

  window.addEventListener('confirmar-parte', onSolicitudConfirmar as EventListener);
  onDestroy(() => { window.removeEventListener('confirmar-parte', onSolicitudConfirmar as EventListener); });

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

  // --- FUNCIONES DE ESTADO (sin oficina) ---
  async function toggleStatus(objeto: any, campo: string) {
    if (!objeto || !objeto.id) return;

    const estadoAnterior = objeto[campo];
    const nuevoEstado = !objeto[campo];

    try {
        objeto[campo] = nuevoEstado;
        partes = partes;

        await invoke('alternar_estado_parte', {
            id: objeto.id,
            tipoAccion: campo,
            valorNuevo: nuevoEstado
        });

    } catch (e) {
        console.error('Error en toggleStatus:', e);
        alert('Error al guardar: ' + e);
        objeto[campo] = estadoAnterior;
        partes = partes;
    }
  }

  async function toggleConfirmado(objeto: any) {
    if (!objeto || !objeto.id) return;

    const estadoAnterior = objeto.recibido_manual;
    const nuevoEstado = !objeto.recibido_manual;

    try {
        objeto.recibido_manual = nuevoEstado;
        objeto.estado = nuevoEstado ? 'Confirmado' : 'Pendiente';
        partes = partes;

        await invoke('alternar_estado_parte', {
            id: objeto.id,
            tipoAccion: 'confirmacion',
            valorNuevo: nuevoEstado
        });

        if (typeof oradoresPendientes !== 'undefined') {
            const pendientes = partes
                .filter(p => p.nombre_orador && (!p.recibido_manual))
                .map(p => ({ id: p.id, nombre: p.nombre_orador, tema: p.tema, estado: 'Pendiente' }));
            oradoresPendientes.set(pendientes);
        }
    } catch (e) {
        console.error('Error toggleConfirmado:', e);
        alert('Error backend: ' + e);
        objeto.recibido_manual = estadoAnterior;
        objeto.estado = estadoAnterior ? 'Confirmado' : 'Pendiente';
        partes = partes;
    }
  }

  async function togglePresente(objeto: any) {
    if (!objeto || !objeto.id) return;

    const estadoAnterior = objeto.esta_presente;
    const nuevoEstado = !objeto.esta_presente;

    try {
        objeto.esta_presente = nuevoEstado;
        partes = partes;
        
        await invoke('alternar_estado_parte', {
            id: objeto.id,
            tipoAccion: 'presencia',
            valorNuevo: nuevoEstado
        });

    } catch (e) {
        console.error('Error togglePresente:', e);
        alert('Error: ' + e);
        objeto.esta_presente = estadoAnterior;
        partes = partes;
    }
  }

  // --- WHATSAPP ---
  async function abrirWhatsAppAsignacion(objeto: any) {
    const url = await obtenerUrlWhatsApp(objeto, false);
    if (url) {
        openUrl(url).catch(e => console.error(e));
        objeto.whatsapp_enviado = true;
        partes = partes;
    }
  }

  async function abrirWhatsAppRecordatorio(objeto: any) {
    const url = await obtenerUrlWhatsApp(objeto, true);
    if (url) {
        openUrl(url).catch(e => console.error(e));
        objeto.recordatorio_whatsapp_enviado = true;
        partes = partes;
    }
  }

  // --- CORREOS ---
  async function obtenerUrlCorreo(objeto: any, esRecordatorio: boolean): Promise<string | null> {
    const emailDestino = (objeto.email_visual || objeto.email_orador || objeto.email || "").trim();
    if (!emailDestino) {
        alert("⚠️ No hay correo registrado.");
        return null;
    }

    let idPlantilla = 'oradores';
    const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();
    if (rol.includes('presidente')) idPlantilla = 'presidentes';
    else if (rol.includes('oracion')) idPlantilla = 'oraciones';

    const plantilla = obtenerPlantillaPorId(idPlantilla);
    const asuntoBase = plantilla?.subject || "Asignación JWPUB";
    const cuerpoBase = plantilla?.body || "⚠️ No se ha definido una plantilla para este tipo de asignación.";

    const contexto = await generarContexto(objeto, asambleaId, true);
    let asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
    let cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);

    if (esRecordatorio) {
        asuntoFinal = "RECORDATORIO: " + asuntoFinal;
    }

    return `https://mail.jwpub.org/owa/#path=/mail/action/compose` +
       `&to=${encodeURIComponent(emailDestino)}` +
       `&subject=${encodeURIComponent(asuntoFinal)}` +
       `&body=${encodeURIComponent(cuerpoFinal)}`;
  }

  async function abrirJWPUBCarta(objeto: any) {
    const url = await obtenerUrlCorreo(objeto, false);
    if (url) {
        openUrl(url).catch(e => console.error(e));
        objeto.jwpub_enviado = true;
        partes = partes; 
    }
  }

  async function abrirJWPUBRecordatorio(objeto: any) {
    const url = await obtenerUrlCorreo(objeto, true);
    if (url) {
        openUrl(url).catch(e => console.error(e));
        objeto.recordatorio_enviado = true;
        partes = partes;
    }
  }

  // --- WHATSAPP URL ---
  async function obtenerUrlWhatsApp(objeto: any, esRecordatorio: boolean = false): Promise<string | null> {
    const telefono = (objeto.telefono_visual || objeto.telefono_orador || objeto.telefono || "").trim();
    if (!telefono) {
        alert("⚠️ No hay teléfono registrado.");
        return null;
    }

    let idPlantilla = 'oradores';
    const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();
    if (rol.includes('presidente')) idPlantilla = 'presidentes';
    else if (rol.includes('oracion')) idPlantilla = 'oraciones';
    else if (esRecordatorio) idPlantilla = 'ensayo';

    let plantilla = obtenerPlantillaWhatsAppPorId(idPlantilla);
    let cuerpoBase = plantilla?.body || "";

    if (!cuerpoBase) {
        console.log(`📱 Plantilla WhatsApp "${idPlantilla}" no encontrada en store, cargando desde Rust...`);
        try {
            const res: any = await invoke('obtener_plantilla_mensaje', { id: idPlantilla });
            if (res && res.cuerpo) {
                cuerpoBase = res.cuerpo;
            }
        } catch (e) {
            console.error(`Error cargando plantilla WhatsApp ${idPlantilla}:`, e);
        }
    }

    if (!cuerpoBase) {
        cuerpoBase = "⚠️ No se ha definido una plantilla para WhatsApp.";
    }

    const contexto = await generarContexto(objeto, asambleaId, true);
    let mensaje = prepararContenidoWhatsApp(cuerpoBase, contexto);
    mensaje = mensaje.substring(0, 4000);

    const numero = telefono.replace(/\D/g, '');
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  }

  // --- MAPA DE PLANTILLAS PARA IMPRESIÓN ---
  const MAPA_PLANTILLAS: Record<string, string> = {
      'programa': 'oradores',
      'presidente': 'presidentes',
      'oracion': 'oraciones',
      'plataforma': 'oradores',
      'personal': 'oradores',
      'default': 'oradores'         
  };

  async function procesarImpresion(objeto: any, esPartePrograma: boolean) {
      if (!objeto || !asambleaId) return alert("⚠️ Seleccione una fila.");
      
      try {
          const contexto = await generarContexto(objeto, asambleaId, esPartePrograma);
          let plantillaId = '';

          if (esPartePrograma) {
              plantillaId = MAPA_PLANTILLAS['programa'];
          } else {
              const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();
              if (rol.includes('presidente')) {
                  plantillaId = MAPA_PLANTILLAS['presidente']; 
              } else if (rol.includes('oracion') || rol.includes('oración')) {
                  plantillaId = MAPA_PLANTILLAS['oracion'];
              } else if (rol.includes('plataforma')) {
                  plantillaId = MAPA_PLANTILLAS['plataforma'];
              } else {
                  plantillaId = MAPA_PLANTILLAS['default'];
              }
          }

          console.log(`🖨️ Rol: "${contexto.tipo_asignacion}" -> Buscando plantilla ID: "${plantillaId}"`);

          const existe = await invoke('obtener_plantilla', { id: plantillaId });
          
          if (!existe) {
              const disponibles: any[] = await invoke('obtener_todas_plantillas');
              const ids = disponibles.map(p => p.id).join(', ');
              alert(`⛔ ERROR: No se encuentra la plantilla con ID "${plantillaId}".\n\nIDs disponibles: [ ${ids} ]`);
              return;
          }

          await generarCartaPDF(contexto, plantillaId);

      } catch (e) { 
          console.error("Error impresión:", e);
          alert("Error al procesar: " + e); 
      }
  }

  function abrirModalPrograma(parte: any) { 
    parteEditando = { ...parte }; 
    terminoBusqueda = ""; 
    mostrarModalAsignar = true; 
  }

  function cerrarModales() { 
      mostrarModalAsignar = false; 
      mostrarModalCrear = false; 
      parteEditando = null; 
  }

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

  async function asignarOrador(oradorId: number | null, esVideo: boolean) {
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
  
  let mostrarModalLimpiar = false;

  async function limpiarTodoConfirmado() {
    mostrarModalLimpiar = false;
    try {
        await invoke('limpiar_programa', { asambleaId });
        await cargarDatos();
    } catch (e) {
        alert('Error al limpiar: ' + e);
    }
  }

  let mostrarModalEliminar = false;
  let idParteAEliminar: number | null = null;

  async function confirmarEliminarParte() {
    if (!idParteAEliminar) return;
    mostrarModalEliminar = false;
    try {
        await invoke('eliminar_parte', { id: idParteAEliminar });
        await cargarDatos();
        idParteAEliminar = null;
    } catch (e) {
        alert('Error al eliminar: ' + e);
    }
  }
  
  async function importarPrograma() { 
      try { 
          const f = await openDialog({ filters: [{ name: 'CSV', extensions: ['csv'] }] }); 
          if(f) { 
              await invoke('importar_programa_jw', { asambleaId, rutaArchivo: f }); 
              await cargarTodosDias(); 
              await cargarHermanos(); 
          } 
      } catch(e) { alert("Error al importar: " + e); }
  }

  async function handleExportarPrograma() {
    await exportarProgramaPDF(partes, diaSeleccionado);
  }

  // --- MÓDULO DE EMAILS MASIVOS ---
  let mostrarModalEmails = false;
  let cargandoEmails = false;
  let diaFiltroEmail = 'Viernes';
  let todosLosDatosEmails: { email: string, dia: string }[] = [];
  let metodoSeleccion: 'mailto' | 'jwpub' = 'mailto';
  let asuntoTodos: string = '';
  let cuerpoTodos: string = '';
  let plantillaSeleccionada: string | null = null;

  $: emailsFiltrados = (() => {
      if (!todosLosDatosEmails || todosLosDatosEmails.length === 0) return [];
      if (diaFiltroEmail === 'Todos') {
        const s = new Set<string>();
        todosLosDatosEmails.forEach(i => { if (i.email && i.email.trim()) s.add(i.email.trim()); });
        return Array.from(s);
      }
      return todosLosDatosEmails.filter(item => item.dia === diaFiltroEmail).map(item => item.email);
  })();

  async function prepararModalEmails() {
    cargandoEmails = true;
    todosLosDatosEmails = [];
    
    const defecto = $emailTemplates && $emailTemplates.length ? $emailTemplates[0] : null;
    plantillaSeleccionada = defecto?.id || null;
    asuntoTodos = defecto?.subject || 'Asignación de asamblea';
    cuerpoTodos = defecto?.body || 'Estimado hermano,\n\nLe informamos sobre su asignación...';

    const dias = ['Viernes', 'Sábado', 'Domingo'];
    
    await Promise.all(dias.map(async (dia) => {
        try {
            const res = await invoke('obtener_programa_dia', { asambleaId, dia }) as any[];
            res.forEach(parte => { 
                if (parte.email_orador && !parte.es_video) {
                    todosLosDatosEmails.push({ 
                        email: parte.email_orador.trim(), 
                        dia: dia 
                    });
                } 
            });
        } catch (e) { console.error(e); }
    }));
    
    todosLosDatosEmails = todosLosDatosEmails;
    diaFiltroEmail = diaSeleccionado;
    cargandoEmails = false;
    mostrarModalEmails = true;
  }

  function cambiarDiaFiltro(dia: string) {
      diaFiltroEmail = dia;
  }

  function copiarEmailsAlPortapapeles() {
    if (emailsFiltrados.length === 0) return alert(`No hay correos para copiar del ${diaFiltroEmail}.`);
    const texto = emailsFiltrados.join(';');
    
    if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText(texto)
            .then(() => alert(`¡Listo! ${emailsFiltrados.length} correos copiados.`))
            .catch(() => prompt('Copiar (Ctrl+C):', texto));
    } else {
        prompt('Copiar (Ctrl+C):', texto);
    }
  }

  function aplicarPlantillaSeleccionada() {
    if (!plantillaSeleccionada) return;
    const p = obtenerPlantillaPorId(plantillaSeleccionada);
    if (p) {
        asuntoTodos = p.subject || asuntoTodos;
        cuerpoTodos = p.body || cuerpoTodos;
    }
  }

  async function enviarEmailADia() {
      if (emailsFiltrados.length === 0) return alert(`No hay destinatarios el ${diaFiltroEmail}.`);
      openUrl(`mailto:${emailsFiltrados.join(';')}`);
  }

  async function enviarJWPUBADia() {
      if (emailsFiltrados.length === 0) return alert(`No hay destinatarios el ${diaFiltroEmail}.`);
      openUrl(`https://mail.jwpub.org/owa/?path=/mail/action/compose&to=${encodeURIComponent(emailsFiltrados.join(';'))}`);
  }

  async function enviarEmailRecordatorioADia() {
      if (emailsFiltrados.length === 0) return alert(`No hay destinatarios el ${diaFiltroEmail}.`);
      const asunto = encodeURIComponent(`RECORDATORIO: Asignación ${diaFiltroEmail}`);
      openUrl(`mailto:${emailsFiltrados.join(';')}?subject=${asunto}`);
  }

  async function enviarJWPUBRecordatorioADia() {
      if (emailsFiltrados.length === 0) return alert(`No hay destinatarios el ${diaFiltroEmail}.`);
      const asunto = encodeURIComponent(`RECORDATORIO: Asignación ${diaFiltroEmail}`);
      openUrl(`https://mail.jwpub.org/owa/?path=/mail/action/compose&to=${encodeURIComponent(emailsFiltrados.join(';'))}&subject=${asunto}`);
  }

  async function abrirTodosPorMetodo() {
    if (emailsFiltrados.length === 0) return alert(`⚠️ No hay correos para el ${diaFiltroEmail}.`);
    const lista = emailsFiltrados.join(';');
    
    if (metodoSeleccion === 'jwpub') {
      const url = `https://mail.jwpub.org/owa/?path=/mail/action/compose&to=${encodeURIComponent(lista)}&subject=${encodeURIComponent(asuntoTodos)}&body=${encodeURIComponent(cuerpoTodos)}`;
      openUrl(url);
    } else {
      const mailto = `mailto:${lista}?subject=${encodeURIComponent(asuntoTodos)}&body=${encodeURIComponent(cuerpoTodos)}`;
      openUrl(mailto);
    }
    mostrarModalEmails = false;
  }

  // --- FILTRADO PARA SUGERENCIAS ---
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
  
  function getHermanosFiltrados() {
    if (!terminoBusqueda) return listaHermanos;
    return listaHermanos.filter(h => 
      h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase())
    );
  }

  const nombreTxt = (obj: any) => obj ? obj.nombre_completo : "Seleccionar...";

// --- FUNCIONES DE FILTRADO ---
function aplicarFiltros(listaPartes: any[], dias: string[], estado: string, caracteristicas: any, fuente: any, orden: string) {
  let resultado = [...listaPartes];
  
  // 1. Filtro por día (Filtro base)
  if (dias.length > 0) {
    resultado = resultado.filter(p => dias.includes(p.dia));
  } else {
    return [];
  }
  
  // 2. Filtro por estado (Filtro base)
  if (estado === 'asignada') {
    resultado = resultado.filter(p => p.nombre_orador && p.nombre_orador.trim() !== '');
  } else if (estado === 'sin_asignar') {
    resultado = resultado.filter(p => !p.nombre_orador || p.nombre_orador.trim() === '');
  }
  
  // 3. Filtros Avanzados (Características y Fuentes unificados con lógica inclusiva OR)
  let filtroCaracActivo = caracteristicas.betelita || caracteristicas.interprete || caracteristicas.visitante;
  let filtroFuenteActivo = fuente.video || fuente.en_persona || fuente.jw_stream || fuente.transmision_remota;
  
  if (filtroCaracActivo || filtroFuenteActivo) {
    resultado = resultado.filter(p => {
      // Preparar la verificación de la fuente de la tarjeta actual
      let f = p.fuente || '';
      let isVid = p.es_video === true || f.toLowerCase().includes('video') || f.toLowerCase().includes('vídeo');
      let isStr = f === 'jw_stream' || f === 'Descarga de JW Stream';
      let isRem = f === 'transmision_remota' || f === 'Transmisión remota en directo';
      let isPer = !isVid && !isStr && !isRem; // Si no es ninguna de las otras, es en persona

      // Verificar si la tarjeta coincide con alguna de las opciones marcadas
      let coincideCarac = (caracteristicas.betelita && p.es_betelita) ||
                          (caracteristicas.interprete && p.es_interprete) ||
                          (caracteristicas.visitante && p.es_visitante);
                          
      let coincideFuente = (fuente.video && isVid) ||
                           (fuente.jw_stream && isStr) ||
                           (fuente.transmision_remota && isRem) ||
                           (fuente.en_persona && isPer);

      // LÓGICA DE UNIFICACIÓN:
      // Si solo marcó características, filtra por características
      if (filtroCaracActivo && !filtroFuenteActivo) return coincideCarac;
      // Si solo marcó fuentes, filtra por fuentes
      if (!filtroCaracActivo && filtroFuenteActivo) return coincideFuente;
      
      // Si marcó de AMBOS grupos (ej: Visitante y Video), muestra si cumple UNO u OTRO (OR)
      return coincideCarac || coincideFuente;
    });
  }
  
  return resultado;
}

function ordenarPartes(partesAOrdenar: any[]) {
  // 5. QUINTO: Ordenar los resultados filtrados
  if (ordenarPor === 'orador') {
    return [...partesAOrdenar].sort((a, b) => {
      const nombreA = a.nombre_orador || 'ZZZ'; // Los sin orador van al final
      const nombreB = b.nombre_orador || 'ZZZ';
      return nombreA.localeCompare(nombreB);
    });
  }
  // Por defecto, ordenar por día y hora (secuencia)
  return [...partesAOrdenar].sort((a, b) => {
    const orden = { 'Viernes': 1, 'Sábado': 2, 'Domingo': 3 };
    const ordenDia = orden[a.dia as keyof typeof orden] - orden[b.dia as keyof typeof orden];
    if (ordenDia !== 0) return ordenDia;
    return (a.hora_inicio || '').localeCompare(b.hora_inicio || '');
  });
}

function limpiarFiltros() {
  filtroEstado = 'todos';
  filtrosCaracteristicas = { betelita: false, interprete: false, visitante: false };
  filtrosFuente = { en_persona: false, jw_stream: false, transmision_remota: false, video: false };
  ordenarPor = 'secuencia';
}

function toggleDia(dia: string) {
  if (dia === 'Todos') {
    // Si está todo seleccionado, deseleccionar todo, sino seleccionar todo
    if (diasSeleccionados.length === 3) {
      diasSeleccionados = [];
    } else {
      diasSeleccionados = ['Viernes', 'Sábado', 'Domingo'];
    }
  } else {
    const index = diasSeleccionados.indexOf(dia);
    if (index > -1) {
      // Deseleccionar
      diasSeleccionados = diasSeleccionados.filter(d => d !== dia);
    } else {
      // Seleccionar
      diasSeleccionados = [...diasSeleccionados, dia];
    }
  }
  // NO cerrar el modal aquí
}

// Al incluir `partes` en los argumentos de la función, Svelte detecta el cambio
$: partesFiltradas = ordenarPartes(aplicarFiltros(partes, diasSeleccionados, filtroEstado, filtrosCaracteristicas, filtrosFuente, ordenarPor));

// Variable para controlar el nuevo modal de Ordenar
  let mostrarSelectorOrdenar = false;

  // Reactividad: Esto hace que el texto cambie automáticamente si marcas o desmarcas días
  $: labelDia = (() => {
    if (diasSeleccionados.length === 0) return 'Seleccionar día';
    if (diasSeleccionados.length === 3) return 'Todos los días';
    if (diasSeleccionados.length === 1) return diasSeleccionados[0];
    if (diasSeleccionados.length === 2) return diasSeleccionados.join(' y ');
    return `${diasSeleccionados.length} días`;
  })();

  // Función mejorada para cerrar cualquiera de los dos menús si haces clic fuera
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (mostrarSelectorDia && !target.closest('.dia-sel')) {
      mostrarSelectorDia = false;
    }
    if (mostrarSelectorOrdenar && !target.closest('.ord-sel')) {
      mostrarSelectorOrdenar = false;
    }
  }

// Cargar todos los días
async function cargarTodosDias() {
  if (!asambleaId) return;
  const abiertos = new Set(partes.filter(p => p._expanded).map(p => p.id));
  
  try {
    const dias = ['Viernes', 'Sábado', 'Domingo'];
    let todasLasPartes: any[] = [];
    
    for (const dia of dias) {
      const res = await invoke('obtener_programa_dia', { asambleaId, dia }) as any[];
      const partesConDia = res.map(p => ({ 
        ...p, 
        dia: dia,
        _expanded: abiertos.has(p.id),
        recibido_manual: p.estado === 'Confirmado',
        estado: p.estado || 'Pendiente',
        esta_presente: p.esta_presente === true || p.esta_presente === 1,
        numero_bosquejo: p.numero_bosquejo || "",
        email_enviado: false,
        carta_recibida_check: false,
        jwpub_enviado: false,
        recordatorio_enviado: false,
        ensayo_terminado: p.ensayo_terminado || false,
        whatsapp_enviado: false,
        recordatorio_whatsapp_enviado: false,
        // ✅ NUEVOS CAMPOS PARA FILTROS
        fuente: p.fuente || 'en_persona',
        es_betelita: p.es_betelita || false,
        es_interprete: p.es_interprete || false,
        es_visitante: p.es_visitante || false
      }));
      todasLasPartes = [...todasLasPartes, ...partesConDia];
    }
    
    partes = todasLasPartes;
  } catch (e) {
    console.error(e);
  }
}

// Reactive statement


</script>

<!-- ========== HTML ========== -->
<div class="layout-programa">
  <main class="panel-discursos">

    <div class="header-sesion">
<div class="header-sesion-left">
    <h2>Programa</h2>
      
    <div class="selector-dia-container dia-sel">
      <button class="btn-selector-dia" on:click|stopPropagation={() => {mostrarSelectorDia = !mostrarSelectorDia; mostrarSelectorOrdenar = false;}}>
        <div style="display:flex; align-items:center; gap:8px;">
          <Calendar size={16}/>
          <span>{labelDia}</span>
        </div>
        <ChevronDown size={16}/>
      </button>
      
      {#if mostrarSelectorDia}
        <div class="dropdown-dias" on:click|stopPropagation>
          <button class="dia-opcion" on:click={() => toggleDia('Todos')}>
            <input type="checkbox" checked={diasSeleccionados.length === 3} readonly>
            <span>Todos los días</span>
          </button>
          <div class="separator-dropdown"></div>
          <button class="dia-opcion" on:click={() => toggleDia('Viernes')}>
            <input type="checkbox" checked={diasSeleccionados.includes('Viernes')} readonly>
            <span>Viernes</span>
          </button>
          <button class="dia-opcion" on:click={() => toggleDia('Sábado')}>
            <input type="checkbox" checked={diasSeleccionados.includes('Sábado')} readonly>
            <span>Sábado</span>
          </button>
          <button class="dia-opcion" on:click={() => toggleDia('Domingo')}>
            <input type="checkbox" checked={diasSeleccionados.includes('Domingo')} readonly>
            <span>Domingo</span>
          </button>
        </div>
      {/if}
    </div>

    <button class="btn-header-filtros" on:click={() => mostrarPanelFiltros = true}>
      <ListFilter size={18}/> <span>Otros Filtros</span>
    </button>

    <div class="selector-dia-container ord-sel">
      <button class="btn-selector-dia" style="min-width: 180px;" on:click|stopPropagation={() => {mostrarSelectorOrdenar = !mostrarSelectorOrdenar; mostrarSelectorDia = false;}}>
        <div style="display:flex; align-items:center; gap:8px;">
          <span>Ordenar: <strong style="color:var(--primary);">{ordenarPor === 'secuencia' ? 'Secuencia' : 'Orador'}</strong></span>
        </div>
        <ChevronDown size={16}/>
      </button>
      
      {#if mostrarSelectorOrdenar}
        <div class="dropdown-dias" style="min-width: 180px;" on:click|stopPropagation>
          <button class="dia-opcion" on:click={() => { ordenarPor = 'secuencia'; mostrarSelectorOrdenar = false; }}>
            <input type="checkbox" checked={ordenarPor === 'secuencia'} readonly>
            <span style={ordenarPor === 'secuencia' ? 'font-weight:bold; color:var(--text-main);' : ''}>Secuencia de discursos</span>
          </button>
          <div class="separator-dropdown"></div>
          <button class="dia-opcion" on:click={() => { ordenarPor = 'orador'; mostrarSelectorOrdenar = false; }}>
            <input type="checkbox" checked={ordenarPor === 'orador'} readonly>
            <span style={ordenarPor === 'orador' ? 'font-weight:bold; color:var(--text-main);' : ''}>Orador</span>
          </button>
        </div>
      {/if}
    </div>
  </div>
  
  <div class="acciones-header">
    <button class="btn-header-orange" on:click={() => { mostrarModalEmails = true; prepararModalEmails(); }}>
      <Mail size={18}/> <span>Email a Todos</span>
    </button>

    <button class="btn-header-csv" on:click={importarPrograma} title="Importar programa desde archivo CSV">
      <FileSpreadsheet size={18}/> <span>Importar</span>
    </button>

    <button class="btn-header-pdf" title="Exportar lista de discursos a PDF" on:click={handleExportarPrograma}>
      <FileUp size={18}/> <span>PDF</span>
    </button>

    <button class="btn-header-delete" on:click={() => mostrarModalLimpiar = true} title="Borrar todo el programa del día">
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
      
      {#each partesFiltradas as parte}
        <div class="tarjeta-acordeon" 
          class:expanded={parte._expanded}
          class:estado-presente={parte.esta_presente}
          class:estado-confirmado={parte.recibido_manual && !parte.esta_presente}
          class:estado-ensayo={parte.ensayo_terminado && !parte.esta_presente && !parte.recibido_manual}>
        
          <div class="header-parte" role="button" tabindex="0" 
               on:click={() => toggleExpandir(parte.id)} 
               on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpandir(parte.id)}>
            <div class="col-tiempo">
              <span class="hora">{parte.hora_inicio}</span>
              <span class="duracion">({parte.duracion}m)</span>
            </div>
            
            <div class="col-tema">
              <span class="tema-txt">{parte.tema}</span>
              
              <div class="badges-row">
                {#if parte.es_video || parte.fuente === 'video' || parte.fuente === 'Video'}
                  <span class="badge-fuente video"><Video size={10}/> Video</span>
                {:else if parte.fuente === 'jw_stream' || parte.fuente === 'Descarga de JW Stream'}
                  <span class="badge-fuente stream"><Download size={10}/> JW Stream</span>
                {:else if parte.fuente === 'transmision_remota' || parte.fuente === 'Transmisión remota en directo'}
                  <span class="badge-fuente remota"><Globe size={10}/> Remota</span>
                {:else}
                  <span class="badge-fuente en-persona"><UserCheck size={10}/> En persona</span>
                {/if}

                {#if parte.numero_bosquejo && parte.numero_bosquejo.trim() !== ''}
                  <span class="badge-bosquejo"><FileText size={10}/> Bosquejo: {parte.numero_bosquejo}</span>
                {/if}
              </div>
            </div>

            <div class="col-orador-mini">
              {#if !parte.es_video}
                <span class="orador-nombre">{parte.nombre_orador || "Sin asignar"}</span>
                
                <div class="orador-meta">
                  {#if parte.congregacion_orador}
                    <span class="cong-mini">{parte.congregacion_orador}</span>
                  {/if}
                </div>
                  
                <div class="traits-container">
                  {#if parte.es_betelita}
                    <span class="trait-badge">Betelita</span>
                  {/if}
                  {#if parte.es_interprete}
                    <span class="trait-badge">Intérprete</span>
                  {/if}
                  {#if parte.es_visitante}
                    <span class="trait-badge">Visitante</span>
                  {/if}
                </div>
              {/if}
            </div>

            <div class="col-estados-mini">
              {#if parte.recibido_manual}
                <div class="icon-indicator blue" title="Recibido"><FileCheck size={14} /></div>
              {/if}
              {#if parte.esta_presente}
                <div class="icon-indicator green" title="Presente"><UserCheck size={14} /></div>
              {/if}
              {#if parte.ensayo_terminado}
                <div class="icon-indicator orange" title="Ensayo terminado"><Mic size={14} /></div>
              {/if}
              {#if !parte.recibido_manual && !parte.esta_presente && !parte.ensayo_terminado}
                <div class="icon-indicator gray" title="Pendiente"><Clock size={14} /></div>
              {/if}
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
                            class:active={parte.recibido_manual} 
                            on:click={() => toggleConfirmado(parte)}>
                      <FileCheck size={18} /><span>RECIBIDO</span>
                    </button>

                    <button class="btn-status-toggle green" 
                            class:active={parte.esta_presente} 
                            on:click={() => togglePresente(parte)}>
                      <UserCheck size={18} /><span>PRESENTE</span>
                    </button>

                    <button class="btn-status-toggle orange" 
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
                <button class="btn-tool delete" on:click={() => {idParteAEliminar = parte.id; mostrarModalEliminar = true;}}>
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

<!-- ========== MODALES ========== -->
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

{#if mostrarModalAsignar && parteEditando}
  <div class="modal-backdrop" role="button" tabindex="0" 
       on:click|self={cerrarModales} 
       on:keydown={(e) => e.key === 'Escape' && cerrarModales()}>
    <div class="modal">
      <div class="modal-header">
        <h3>Asignar Orador</h3>
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
          <button class="item-opcion video-option" on:click={() => asignarOrador(null, true)}>
            <div class="icono-video"><Video size={18}/></div>
            <span>Video</span>
          </button>
          
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

{#if mostrarModalEmails}
  <div class="modal-backdrop" role="button" tabindex="0" on:click|self={() => mostrarModalEmails = false} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') && (mostrarModalEmails=false)} transition:fade={{ duration: 200 }}>
    <div class="modal-emails" role="dialog" aria-modal="true" tabindex="0" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && (mostrarModalEmails=false)}>
      
      <div class="modal-header">
        <h3><Mail size={20}/> Email a todos los oradores</h3>
        <button class="btn-close" on:click={() => mostrarModalEmails = false} aria-label="Cerrar">
          <X size={20}/>
        </button>
      </div>
      
      <div class="modal-contenido">
        
        <div class="filtro-dia-contenedor">
          <div class="label-titulo">Enviar correos para el día:</div>
          <div class="selector-dias">
            {#each ['Viernes', 'Sábado', 'Domingo', 'Todos'] as dia}
              <button 
                class="btn-dia {diaFiltroEmail === dia ? 'activo' : ''} " 
                on:click={() => cambiarDiaFiltro(dia)}
                type="button"
                aria-pressed={diaFiltroEmail === dia}
              >
                {dia}
              </button>
            {/each}
          </div>
        </div>

        <div class="label-titulo">Acciones Rápidas ({diaFiltroEmail})</div>
        <div class="opciones-email-grid">
          <button
            class="opcion-email"
            on:click={() => { enviarEmailADia(); mostrarModalEmails = false; }}
            disabled={metodoSeleccion !== 'mailto'}
            aria-disabled={metodoSeleccion !== 'mailto'}
            title={metodoSeleccion !== 'mailto' ? 'Selecciona Gmail/Mail en Método de Envío' : `Enviar emails (${diaFiltroEmail})`}
          >
            <div class="icon-wrapper azul"><Mail size={24}/></div>
            <span>Email {diaFiltroEmail}</span>
          </button>

          <button
            class="opcion-email"
            on:click={() => { enviarJWPUBADia(); mostrarModalEmails = false; }}
            disabled={metodoSeleccion !== 'jwpub'}
            aria-disabled={metodoSeleccion !== 'jwpub'}
            title={metodoSeleccion !== 'jwpub' ? 'Selecciona JWPUB en Método de Envío' : `Enviar JWPUB (${diaFiltroEmail})`}
          >
            <div class="icon-wrapper morado"><FileJson size={24}/></div>
            <span>JWPUB {diaFiltroEmail}</span>
          </button>  
        </div>

        <div class="seccion-editor">
          <div class="editor-header">
            <div class="label-titulo">Personalizar Mensaje</div>
            <div class="destinatarios-badge">
              <span class="status-dot"></span>
              {cargandoEmails ? 'Cargando...' : emailsFiltrados.length + ' oradores del ' + diaFiltroEmail}
            </div>
          </div>

          <div class="grid-form">
            <div class="form-group">
              <label for="metodo">Método de Envío</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" bind:group={metodoSeleccion} value="mailto"> 
                  <span>Gmail/Mail</span>
                </label>
                <label class="radio-label">
                  <input type="radio" bind:group={metodoSeleccion} value="jwpub"> 
                  <span>JWPUB</span>
                </label>
              </div>
            </div>
            <div class="form-group">
              <label for="plantilla">Plantilla</label>
              <select id="plantilla" bind:value={plantillaSeleccionada} on:change={aplicarPlantillaSeleccionada}>
                <option value={null}>-- Texto libre --</option>
                {#each $emailTemplates as tpl}
                  <option value={tpl.id}>{tpl.title || tpl.id}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="asunto">Asunto</label>
            <input type="text" id="asunto" bind:value={asuntoTodos} placeholder="Asunto..." />
          </div>

          <div class="form-group">
            <label for="cuerpo">Cuerpo</label>
            <textarea id="cuerpo" rows="6" bind:value={cuerpoTodos}></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="modal-button" on:click={copiarEmailsAlPortapapeles} disabled={emailsFiltrados.length===0}>
            Copiar correos
          </button>
          <div class="flex-spacer"></div>
          <button class="modal-button secondary" on:click={() => { mostrarModalEmails = false; }}>
            Cancelar
          </button>
          <button class="modal-button primary" on:click={abrirTodosPorMetodo} disabled={emailsFiltrados.length===0}>
            🚀 Enviar a {emailsFiltrados.length} oradores
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if mostrarModalLimpiar}
  <div class="modal-backdrop" role="button" tabindex="0" 
       on:click|self={() => mostrarModalLimpiar = false} 
       on:keydown={(e) => e.key === 'Escape' && (mostrarModalLimpiar = false)}>
    <div class="modal modal-confirm">
      <div class="modal-header">
        <h3>¿Borrar todo el programa?</h3>
        <button class="btn-close" on:click={() => mostrarModalLimpiar = false}><X size={20}/></button>
      </div>
      <div class="modal-body">
        <p>Esta acción eliminará todas las partes del día <strong>{diaSeleccionado}</strong>.</p>
        <p>¿Estás seguro?</p>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => mostrarModalLimpiar = false}>Cancelar</button>
        <button class="btn-delete" on:click={limpiarTodoConfirmado}>Sí, borrar</button>
      </div>
    </div>
  </div>
{/if}

{#if mostrarModalEliminar}
  <div class="modal-backdrop" role="button" tabindex="0" 
       on:click|self={() => { mostrarModalEliminar = false; idParteAEliminar = null; }}
       on:keydown={(e) => e.key === 'Escape' && (mostrarModalEliminar = false) && (idParteAEliminar = null)}>
    <div class="modal modal-confirm">
      <div class="modal-header">
        <h3>Eliminar parte</h3>
        <button class="btn-close" on:click={() => { mostrarModalEliminar = false; idParteAEliminar = null; }}><X size={20}/></button>
      </div>
      <div class="modal-body">
        <p>¿Estás seguro de que deseas eliminar esta parte?</p>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" on:click={() => { mostrarModalEliminar = false; idParteAEliminar = null; }}>Cancelar</button>
        <button class="btn-delete" on:click={confirmarEliminarParte}>Eliminar</button>
      </div>
    </div>
  </div>
{/if}

{#if mostrarPanelFiltros}
  <div class="modal-backdrop" on:click|self={() => mostrarPanelFiltros = false}>
    <div class="modal-filtros">
      <div class="modal-header">
        <h3><Settings size={20}/> Filtros</h3>
        <button class="btn-close" on:click={() => mostrarPanelFiltros = false}>
          <X size={20}/>
        </button>
      </div>
      
      <div class="modal-body-filtros">
        <div class="filtros-activos-info">
          <h4>Filtros activos</h4>
          <p class="texto-secundario">Los filtros no están activos</p>
        </div>

        <!-- ESTADO DE LA ASIGNACIÓN -->
        <div class="grupo-filtro">
          <button class="filtro-header">
            <span>Estado de la asignación</span>
            <ChevronDown size={16}/>
          </button>
          <div class="filtro-contenido">
            <button class="btn-eliminar-filtro" on:click={() => filtroEstado = 'todos'}>
              Eliminar
            </button>
            <label class="radio-label-filtro">
              <input type="radio" bind:group={filtroEstado} value="todos">
              <span>Todos</span>
            </label>
            <label class="radio-label-filtro">
              <input type="radio" bind:group={filtroEstado} value="asignada">
              <span>Asignada</span>
            </label>
            <label class="radio-label-filtro">
              <input type="radio" bind:group={filtroEstado} value="sin_asignar">
              <span>Sin asignar</span>
            </label>
          </div>
        </div>

        <!-- CARACTERÍSTICAS DEL ORADOR -->
        <div class="grupo-filtro">
          <button class="filtro-header">
            <span>Características del orador</span>
            <ChevronDown size={16}/>
          </button>
          <div class="filtro-contenido">
            <button class="btn-eliminar-filtro" on:click={() => filtrosCaracteristicas = {betelita: false, interprete: false, visitante: false}}>
              Eliminar
            </button>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={filtrosCaracteristicas.betelita}>
              <span>Betelita</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={filtrosCaracteristicas.interprete}>
              <span>Intérprete</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={filtrosCaracteristicas.visitante}>
              <span>Visitante</span>
            </label>
          </div>
        </div>

        <!-- FUENTE -->
        <div class="grupo-filtro">
          <button class="filtro-header">
            <span>Fuente</span>
            <ChevronDown size={16}/>
          </button>
          <div class="filtro-contenido">
            <button class="btn-eliminar-filtro" on:click={() => filtrosFuente = {en_persona: false, jw_stream: false, transmision_remota: false, video: false}}>
              Eliminar
            </button>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={filtrosFuente.en_persona}>
              <span>En persona</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={filtrosFuente.jw_stream}>
              <span>Descarga de JW Stream</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={filtrosFuente.transmision_remota}>
              <span>Transmisión remota en directo</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={filtrosFuente.video}>
              <span>Video</span>
            </label>
          </div>
        </div>
      </div>

      <div class="modal-footer-filtros">
        <button class="btn-cancel" on:click={() => mostrarPanelFiltros = false}>Cancelar</button>
        <button class="btn-limpiar" on:click={limpiarFiltros}>Eliminar todo</button>
        <button class="btn-aplicar" on:click={() => mostrarPanelFiltros = false}>Aplicar</button>
      </div>
    </div>
  </div>
{/if}

<style>
/* ==========================================================================
   LAYOUT PRINCIPAL - SOLO PANEL DE DISCURSOS
   ========================================================================== */
.layout-programa {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  padding-bottom: 0;
}

/* ==========================================================================
   PANEL DE DISCURSOS (Único)
   ========================================================================== */
.panel-discursos { 
  flex: 1;
  width: 100%;
  background: var(--bg-card);
  border-radius: 10px; 
  border: 1px solid var(--border-color); 
  display: flex; 
  flex-direction: column; 
  overflow: hidden; 
}

.header-sesion { 
  padding: 15px 20px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-color); 
  gap: 15px; 
  background: var(--bg-card); 
}

.header-sesion h2 { 
  margin: 0; 
  font-size: 18px; 
  color: var(--text-main); 
  white-space: nowrap;
}

.header-sesion-left { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  flex-wrap: wrap;
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

.lista-partes { 
  padding: 20px; 
  overflow-y: auto; 
  flex: 1; 
  background: #f1f5f9;/* Fondo gris muy suave (ya definido en variables) */
}

/* --- TARJETAS ACORDEÓN --- */
.tarjeta-acordeon { 
  background: #ffffff; /* <--- CAMBIO: Blanco puro explícito */
  border-radius: 8px; 
  border: 1px solid #cbd5e1; /* <--- CAMBIO: Color gris sólido (Slate 300) para un borde definido */
  margin-bottom: 10px; 
  overflow: hidden; 
  transition: box-shadow 0.2s, transform 0.2s; 
  color: var(--text-main);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); /* Sombra ligera para dar volumen */
}

.tarjeta-acordeon:hover { 
  box-shadow: 0 8px 16px rgba(0,0,0,0.1); /* Elevación más pronunciada */
  transform: translateY(-2px); /* Ligero levantamiento */
}
.tarjeta-acordeon.expanded { 
  border-color: var(--text-secondary); 
  box-shadow: 0 4px 12px var(--shadow-color); 
}

.header-parte { 
  display: flex; 
  align-items: center; 
  padding: 12px 15px; 
  cursor: pointer; 
  gap: 15px; 
  background: transparent; 
}
.header-parte:hover { background: var(--hover-bg); }
.body-parte { 
  border-top: 1px solid var(--border-color); 
  background: var(--bg-body); 
  padding: 15px 20px; 
  color: var(--text-main); 
}

/* --- ESTADOS Y COLORES SUAVES --- */
.tarjeta-acordeon.estado-presente { 
  border-left: 6px solid #10b981 !important; 
  background-color: rgba(16, 185, 129, 0.12) !important;
}
.tarjeta-acordeon.estado-confirmado { 
  border-left: 6px solid #3b82f6 !important; 
  background-color: rgba(59, 130, 246, 0.12) !important;
}
.tarjeta-acordeon.estado-ensayo { 
  border-left: 6px solid #f97316 !important; /* Naranja más vibrante */
  background-color: rgba(249, 115, 22, 0.12) !important;
}

/* Hover suave en estados */
.tarjeta-acordeon.estado-presente:hover { background-color: rgba(16, 185, 129, 0.2) !important; }
.tarjeta-acordeon.estado-confirmado:hover { background-color: rgba(59, 130, 246, 0.2) !important; }
.tarjeta-acordeon.estado-ensayo:hover { background-color: rgba(249, 115, 22, 0.2) !important; }

/* Textos */
.hora { 
  font-weight: 800; 
  color: var(--primary); 
  font-size: 16px; /* Más grande y clara */
  line-height: 1.2;
}
.duracion { font-size: 11px; color: var(--text-secondary); }
.tema-txt { 
  font-weight: 600; 
  color: var(--text-main); 
  font-size: 15px; /* Un poco más grande */
  line-height: 1.3; 
}
.orador-nombre { font-weight: 600; color: var(--text-main); font-size: 13px; text-transform: uppercase; }

/* --- ICONOS MINI --- */
.col-estados-mini { 
  display: flex !important;
  flex-direction: row !important;
  gap: 6px; 
  min-width: 60px; 
  justify-content: flex-end; 
  align-items: center; 
}

.icon-indicator { 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  width: 24px; 
  height: 24px; 
  border-radius: 50%; 
}
.icon-indicator.green { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.icon-indicator.blue { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.icon-indicator.orange { background: rgba(249, 115, 22, 0.2); color: #f97316; }
.icon-indicator.gray { background: rgba(107, 114, 128, 0.2); color: #6b7280; }

.dot-icon { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; }
.dot-icon.blue { background: #3b82f6; color: white; }
.dot-icon.green { background: #10b981; color: white; }
.dot-icon.yellow { background: #f97316; color: white; } /* Cambiado a naranja vibrante */

/* Pulse Animation */
.estado-presente .icon-indicator.green { animation: pulse-green 2s infinite; }
@keyframes pulse-green { 
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } 
}

/* Badges - Estilo cápsula elegante */
.badge-video { 
  font-size: 10px; 
  background: #e2e8f0; 
  color: #334155; 
  padding: 4px 8px; 
  border-radius: 999px; /* Cápsula */
  display: inline-flex; 
  align-items: center; 
  gap: 4px; 
  width: fit-content; 
  margin-top: 4px; 
  border: none;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Botones Cabecera */
.acciones-header { 
  display: flex; 
  gap: 10px; 
  align-items: center;
  flex-wrap: wrap;
}

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
.btn-status-toggle.orange.active { background: rgba(249, 115, 22, 0.15); border-color: #f97316; color: #f97316; }

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
.opcion-email[disabled], .opcion-email[aria-disabled="true"] {
  opacity: 0.45;
  filter: grayscale(0.25);
  cursor: not-allowed;
}
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

/* Botón PDF */
.btn-header-pdf {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  background-color: transparent; 
  border: 1px solid #ef4444;
  color: #ef4444;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}
.btn-header-pdf:hover {
  background-color: rgba(239, 68, 68, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);
}

/* Responsividad */
@media (max-width: 850px) {
  .header-sesion-left button span,
  .acciones-header button span {
      display: none; 
  }
  .header-sesion-left button,
  .acciones-header button {
      padding: 8px 10px; 
      justify-content: center;
  }
}
@media (max-width: 900px) {
  .layout-programa {
    display: flex;
    flex-direction: column;
    height: auto;
    overflow: visible;
    gap: 15px;
    padding-bottom: 20px;
  }
  .panel-discursos {
    height: auto;
    overflow: visible;
    width: 100%;       
  }
  .lista-partes {
    height: auto;
    overflow: visible;
    padding-bottom: 20px; 
  }
  .tabs {
    flex-wrap: wrap; 
  }
  .tabs button {
    padding: 12px 5px; 
    font-size: 13px;   
  }
}

/* Modal de confirmación */
.modal-confirm {
  width: 400px;
  max-width: 90vw;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid var(--border-color);
}
.btn-delete {
  background: #ef4444;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-delete:hover {
  background: #dc2626;
}
.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel:hover {
  background: var(--hover-bg);
}

/* Estilos específicos para el modal de emails */
.modal-emails {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 90%;
  max-width: 650px;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
}
.modal-emails .modal-header {
  padding: 16px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 10;
}
.modal-emails .modal-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1e293b;
  font-size: 1.1rem;
}
.opciones-email-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 20px;
  background: #ffffff;
}
.opcion-email {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #475569;
  text-align: left;
}
.opcion-email:hover {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
  transform: translateY(-2px);
}
.icon-wrapper.azul { background: #dbeafe; color: #2563eb; }
.icon-wrapper.morado { background: #f3e8ff; color: #9333ea; }
.icon-wrapper.naranja { background: #ffedd5; color: #ea580c; }
.mini-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: #ea580c;
  color: white;
  border-radius: 50%;
  padding: 3px;
  border: 2px solid white;
}
.selector-dias {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.btn-dia {
  background: transparent;
  border: 1px solid #e6eef8;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  color: #1e293b;
  font-weight: 700;
  transition: all 0.15s ease;
}
.btn-dia:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(2,6,23,0.06); }
.btn-dia.activo {
  background: #2563eb;
  color: white;
  border-color: transparent;
  box-shadow: 0 10px 30px rgba(37,99,235,0.14);
}
.seccion-editor {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
}
.destinatarios-badge {
  background: #dcfce7;
  color: #166534;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-dot {
  width: 8px; height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.7; }
}
.grid-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}
.modal-button {
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #cbd5e1;
  background: white;
  color: #334155;
}
.modal-button.primary {
  background: #2563eb;
  color: white;
  border: none;
}
.modal-button.primary:hover:not(:disabled) {
  background: #1d4ed8;
  transform: scale(1.02);
}

/* Modal de emails */
:global(html.dark-theme) .modal-emails {
  background: var(--bg-card);
  border-color: var(--border-color);
  box-shadow: 0 20px 25px -5px var(--shadow-color), 0 10px 10px -5px var(--shadow-color);
}

:global(html.dark-theme) .modal-emails .modal-header {
  background: var(--bg-secondary);
  border-bottom-color: var(--border-color);
}

:global(html.dark-theme) .modal-emails .modal-header h3 {
  color: var(--text-main);
}

:global(html.dark-theme) .opciones-email-grid {
  background: var(--bg-card);
}

:global(html.dark-theme) .opcion-email {
  background: var(--bg-secondary);
  border-color: var(--border-color);
  color: var(--text-main);
}

:global(html.dark-theme) .opcion-email:hover {
  background: var(--hover-bg);
  border-color: var(--primary);
  color: var(--primary);
}

:global(html.dark-theme) .icon-wrapper.azul {
  background: rgba(59, 130, 246, 0.25);
  color: #60a5fa;
}

:global(html.dark-theme) .icon-wrapper.morado {
  background: rgba(147, 51, 234, 0.25);
  color: #c084fc;
}

:global(html.dark-theme) .icon-wrapper.naranja {
  background: rgba(249, 115, 22, 0.25);
  color: #fb923c;
}

:global(html.dark-theme) .mini-badge {
  border-color: var(--bg-card);
}

:global(html.dark-theme) .btn-dia {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-main);
}

:global(html.dark-theme) .btn-dia:hover {
  background: var(--hover-bg);
  border-color: var(--primary);
  box-shadow: 0 8px 18px var(--shadow-color);
}

:global(html.dark-theme) .btn-dia.activo {
  background: var(--primary);
  color: white;
  border-color: transparent;
}

:global(html.dark-theme) .seccion-editor {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

:global(html.dark-theme) .destinatarios-badge {
  background: #10b981;
  color: white;
}

:global(html.dark-theme) .modal-button {
  background: var(--bg-card);
  border-color: var(--border-color);
  color: var(--text-main);
}

:global(html.dark-theme) .modal-button.primary {
  background: var(--primary);
  color: white;
}

/* ========================================
   MODAL EMAILS - Estilos profesionales
   ======================================== */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-emails {
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.modal-emails .modal-header {
  padding: 18px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal-emails .modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-emails .btn-close {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-emails .btn-close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.modal-emails .modal-contenido {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

/* Filtro de días */
.filtro-dia-contenedor {
  margin-bottom: 24px;
}

.label-titulo {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.selector-dias {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-dia {
  background: transparent;
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 30px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-dia:hover {
  background: var(--hover-bg);
  border-color: var(--primary);
  transform: translateY(-1px);
}

.btn-dia.activo {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* Grid de acciones rápidas */
.opciones-email-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.opcion-email {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.opcion-email:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px var(--shadow-color);
}

.opcion-email:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(0.3);
}

.icon-wrapper {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-wrapper.azul {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.icon-wrapper.morado {
  background: rgba(147, 51, 234, 0.2);
  color: #9333ea;
}

.icon-wrapper.naranja {
  background: rgba(249, 115, 22, 0.2);
  color: #f97316;
}

.mini-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: #f97316;
  color: white;
  border-radius: 50%;
  padding: 3px;
  border: 2px solid var(--bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
}

.opcion-email span {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.3;
  flex: 1;
}

/* Sección editor */
.seccion-editor {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.destinatarios-badge {
  background: #10b981;
  color: white;
  padding: 4px 12px;
  border-radius: 30px;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.7; }
}

.grid-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.radio-group {
  display: flex;
  gap: 16px;
  padding: 8px 0;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--text-main);
  font-size: 0.9rem;
}

.radio-label input[type="radio"] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--primary);
}

select, input[type="text"], textarea {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 0.9rem;
  transition: border 0.2s;
}

select:focus, input:focus, textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

textarea {
  resize: vertical;
  min-height: 100px;
}

/* Footer del modal */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  margin-top: 8px;
}

.modal-button {
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-main);
}

.modal-button:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: var(--primary);
}

.modal-button.primary {
  background: var(--primary);
  color: white;
  border: none;
}

.modal-button.primary:hover:not(:disabled) {
  background: var(--primary-dark, #1d4ed8);
  transform: scale(1.02);
}

.modal-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.flex-spacer {
  flex: 1;
}

/* Responsive */
@media (max-width: 600px) {
  .opciones-email-grid {
    grid-template-columns: 1fr;
  }

  .grid-form {
    grid-template-columns: 1fr;
  }

  .modal-emails .modal-contenido {
    padding: 16px;
  }

  .modal-footer {
    flex-wrap: wrap;
    justify-content: center;
  }
}

/* === BOTÓN FILTROS (Borde fino, sin morado) === */
.btn-header-filtros {
  background: var(--bg-card);
  border: 1px solid #cbd5e1; /* Borde gris fino */
  color: var(--text-main);   /* Texto oscuro */
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-header-filtros:hover {
  background: var(--hover-bg);
  border-color: #94a3b8;
}

.ordenar-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ordenar-container label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* === SELECT ORDENAR (Estilo botón con borde fino) === */
.select-ordenar {
  padding: 8px 30px 8px 12px; /* Más padding a la derecha para la flecha */
  border: 1px solid #cbd5e1;  /* Borde gris fino */
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  /* Personalizar la flecha del select */
  appearance: none; 
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>');
  background-repeat: no-repeat;
  background-position: right 8px center;
  transition: all 0.2s;
}
.select-ordenar:hover {
  border-color: #94a3b8;
}

.modal-filtros {
  background: var(--bg-card);
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.modal-body-filtros {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  background: var(--bg-body);
}

.filtros-activos-info {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-color);
}

.filtros-activos-info h4 {
  margin: 0 0 5px 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.texto-secundario {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
}

.grupo-filtro {
  margin-bottom: 15px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  overflow: hidden;
}

.filtro-header {
  width: 100%;
  padding: 12px 15px;
  background: transparent;
  border: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  color: var(--text-main);
  font-weight: 600;
  font-size: 14px;
}

.filtro-header:hover {
  background: var(--hover-bg);
}

.filtro-contenido {
  padding: 15px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn-eliminar-filtro {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 5px;
}

.btn-eliminar-filtro:hover {
  text-decoration: underline;
}

.checkbox-label, .radio-label-filtro {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-main);
}

.checkbox-label input, .radio-label-filtro input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--primary);
}

.modal-footer-filtros {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-card);
}

.btn-limpiar {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.btn-limpiar:hover {
  background: var(--hover-bg);
}

.btn-aplicar {
  background: var(--primary);
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.btn-aplicar:hover {
  opacity: 0.9;
}

/* === SELECTOR DE DÍA === */
.selector-dia-container {
  position: relative;
}

.btn-selector-dia {
  background: var(--bg-card);
  border: 1px solid #cbd5e1; /* Borde gris fino */
  color: var(--text-main);   /* Texto oscuro normal */
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between; /* Flecha a la derecha */
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  min-width: 200px; /* Hace el botón más largo */
  transition: all 0.2s;
}
.btn-selector-dia:hover {
  background: var(--hover-bg);
  border-color: #94a3b8; /* Borde se oscurece al pasar el mouse */
}

.btn-selector-dia span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; /* Si seleccionas muchos textos, pone "..." en vez de romper el botón */
}

.dropdown-dias {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 5px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  z-index: 100;
  min-width: 200px;
  overflow: hidden;
}

.dia-opcion {
  width: 100%;
  padding: 10px 15px;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-main);
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s;
}

.dia-opcion:last-child {
  border-bottom: none;
}

.dia-opcion:hover {
  background: var(--hover-bg);
}

.dia-opcion input[type="checkbox"] {
  pointer-events: none;
  accent-color: var(--primary);
}

.separator-dropdown {
  height: 1px;
  background: var(--border-color);
  margin: 5px 10px;
}

/* --- BADGES Y CARACTERÍSTICAS (NUEVO) --- */
.badges-row {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

/* Estilo base para badges de fuente */
.badge-fuente {
  font-size: 9px;
  padding: 3px 7px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border: 1px solid transparent;
}
/* Colores específicos por fuente */
.badge-fuente.video { background: #e2e8f0; color: #475569; border-color: #cbd5e1; }
.badge-fuente.stream { background: #dbeafe; color: #2563eb; border-color: #bfdbfe; } /* Azul */
.badge-fuente.remota { background: #f3e8ff; color: #9333ea; border-color: #e9d5ff; } /* Morado */

/* Estilo para el bosquejo (mantenido pero ajustado) */
.badge-bosquejo {
  font-size: 9px;
  background: #fff7ed; /* Naranja muy claro */
  color: #c2410c;
  padding: 3px 7px;
  border-radius: 4px; /* Cuadrado redondeado para diferenciarlo */
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-weight: 600;
  border: 1px solid #ffedd5;
}

/* Meta data del orador (congregación + iconos) */
.orador-meta {
  display: flex;
  align-items: center;
  justify-content: space-between; /* Separa cong de los iconos */
  gap: 8px;
  margin-top: 2px;
}
.cong-mini { font-size: 11px; color: var(--text-secondary); text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }

/* Color para Fuente "En persona" */
.badge-fuente.en-persona { background: #f0fdf4; color: #166534; border-color: #bbf7d0; } 
:global(html.dark-theme) .badge-fuente.en-persona { background: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.3); }

/* --- ETIQUETAS ESTILO JW (Gris claro) --- */
.traits-container {
  display: flex;
  gap: 5px;
  margin-top: 5px;
  flex-wrap: wrap;
}
.trait-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb; /* Gris claro igual a la foto */
  color: #374151; /* Texto oscuro */
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500; /* Letra normal/mediana, no negrita fuerte */
  letter-spacing: 0.2px;
}

/* Modo oscuro para las etiquetas */
:global(html.dark-theme) .trait-badge {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}
/* Colores para características */
.trait-badge.betel { background: #1e293b; color: #f8fafc; } /* Oscuro para Betel */
.trait-badge.interprete { background: #059669; color: #ecfdf5; } /* Verde para Intérprete */
.trait-badge.visitante { background: #0891b2; color: #ecfeff; } /* Cian para Visitante */

/* Ajustes para modo oscuro (OPCIONAL, si usas tema oscuro) */
:global(html.dark-theme) .badge-fuente.video { background: var(--bg-secondary); color: var(--text-secondary); border-color: var(--border-color); }
:global(html.dark-theme) .badge-fuente.stream { background: rgba(37, 99, 235, 0.2); color: #60a5fa; border-color: rgba(37, 99, 235, 0.3); }
:global(html.dark-theme) .badge-fuente.remota { background: rgba(147, 51, 234, 0.2); color: #c084fc; border-color: rgba(147, 51, 234, 0.3); }
:global(html.dark-theme) .badge-bosquejo { background: rgba(249, 115, 22, 0.1); color: #fdba74; border-color: rgba(249, 115, 22, 0.2); }

/* ==========================================================================
   CORRECCIÓN MODO OSCURO PARA LAS TARJETAS Y FONDOS
   ========================================================================== */
:global(html.dark-theme) .lista-partes,
:global(body.dark-theme) .lista-partes {
  background: var(--bg-body) !important;
}

:global(html.dark-theme) .tarjeta-acordeon,
:global(body.dark-theme) .tarjeta-acordeon {
  background: var(--bg-card) !important;
  border-color: var(--border-color) !important;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3) !important;
}

:global(html.dark-theme) .body-parte,
:global(body.dark-theme) .body-parte {
  background: var(--bg-body) !important;
  border-top-color: var(--border-color) !important;
}

/* Forzar que los paneles internos de la tarjeta abierta sean oscuros */
:global(html.dark-theme) .fila-superior-control,
:global(body.dark-theme) .fila-superior-control,
:global(html.dark-theme) .grupo-accion,
:global(body.dark-theme) .grupo-accion {
  background: var(--bg-card) !important;
  border-color: var(--border-color) !important;
}

/* Corregir el color del texto si se queda negro */
:global(html.dark-theme) .orador-nombre,
:global(body.dark-theme) .orador-nombre,
:global(html.dark-theme) .tema-txt,
:global(body.dark-theme) .tema-txt,
:global(html.dark-theme) .hora,
:global(body.dark-theme) .hora,
:global(html.dark-theme) .info-orador-full strong,
:global(body.dark-theme) .info-orador-full strong {
  color: var(--text-main) !important;
}

/* Ajuste de píldoras de contacto en modo oscuro */
:global(html.dark-theme) .contact-pill,
:global(body.dark-theme) .contact-pill {
  background: var(--bg-secondary) !important;
  border-color: var(--border-color) !important;
  color: var(--text-secondary) !important;
}
</style>