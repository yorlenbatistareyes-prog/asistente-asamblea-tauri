<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openDialog } from '@tauri-apps/plugin-dialog';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { slide } from 'svelte/transition';
  import { fade } from 'svelte/transition'; 
  import { onDestroy } from 'svelte';
  
  import { generarContexto } from '$lib/utils/contexto_impresion';
  import { generarCartaPDF } from '$lib/utils/impresion';
  import { exportarProgramaPDF } from '$lib/utils/exportar';
  
  import { 
    UnfoldVertical, FoldVertical, Users, Video, Mic, Search, X, Plus, Trash2, FileUp, 
    MapPin, Phone, Mail, UserPlus, UserMinus, ChevronRight, ChevronDown, ChevronUp,
    FileCheck, UserCheck, User, Printer, FileJson, Edit, Clock, MessageCircle, FileSpreadsheet, Settings, CheckSquare,
    FileText, Download, ListFilter, Calendar, Globe, Languages, Plane  
  } from 'lucide-svelte';

  import { prepararContenidoEmail, prepararAsuntoEmail } from '$lib/utils/contextoEmail';
  import { emailTemplates, obtenerPlantillaPorId, cargarPlantillasEmail } from '$lib/utils/plantillasEmail';
  import { whatsAppTemplates, obtenerPlantillaWhatsAppPorId, cargarPlantillasWhatsApp } from '$lib/utils/plantillasWhatsApp';
  import { prepararContenidoWhatsApp } from '$lib/utils/contextoWhatsApp';
  import { oradoresPendientes } from '$lib/stores/gestion';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { DB } from '$lib/services/db';
  
  // ==================== ESTADO PRINCIPAL ====================
  let asambleaId = 0; 
  let diaSeleccionado = 'Viernes';
  let partes: any[] = []; 

  // --- MODALS ---
  let mostrarModalAsignar = false; 
  let mostrarModalCrear = false;   
  let parteEditando: any = null; 
  
  let listaHermanos: any[] = []; 
  let terminoBusqueda = "";

  let nuevaParte = { 
    dia: 'Viernes', hora: '', tema: '', tipo: 'Discurso', duracion: 0, sesion: 'Mañana', 
    nombre_orador: '', congregacion: '', email: '', telefono: '', numero_bosquejo: '',
    fuente: 'en_persona', es_betelita: false, es_interprete: false, es_visitante: false,
    color_destacado: ''
  };

  let sugerenciasOradores: any[] = [];
  let mostrarSugerencias = false;

  // ==================== FILTROS Y ORDENAMIENTO ====================
  let mostrarPanelFiltros = false;
  let mostrarSelectorDia = false;
  let mostrarSelectorOrdenar = false;          // ← DECLARADA AQUÍ (faltaba)
  let mostrarMenuEmailTodos = false;           // ← también la declaro aquí

  let diasSeleccionados: string[] = ['Viernes', 'Sábado', 'Domingo'];
  let filtroEstado = 'todos';
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
  let ordenarPor = 'secuencia';

  // --- FILTROS TEMPORALES (MODAL) ---
  let tempFiltroEstado = 'todos';
  let tempFiltrosCaracteristicas = { betelita: false, interprete: false, visitante: false };
  let tempFiltrosFuente = { en_persona: false, jw_stream: false, transmision_remota: false, video: false };

  // --- BUSCADOR DEL MODAL DE EDICIÓN ---
  let busquedaEdit = "";
  let sugerenciasEdit: any[] = [];
  let mostrarSugerenciasEdit = false;

  // ==================== FUNCIONES AUXILIARES (NO USAN VARIABLES REACTIVAS) ====================
  function filtrarOradoresEdit() {
    const t = busquedaEdit.toLowerCase();
    if (t.length < 2) {
      sugerenciasEdit = [];
      mostrarSugerenciasEdit = false;
      return;
    }
    sugerenciasEdit = listaHermanos.filter(h => h.nombre_completo.toLowerCase().includes(t));
    mostrarSugerenciasEdit = true;
  }
  
  function abrirPanelFiltros() {
    tempFiltroEstado = filtroEstado;
    tempFiltrosCaracteristicas = { ...filtrosCaracteristicas };
    tempFiltrosFuente = { ...filtrosFuente };
    mostrarPanelFiltros = true;
  }

  function aplicarCambiosFiltros() {
    filtroEstado = tempFiltroEstado;
    filtrosCaracteristicas = { ...tempFiltrosCaracteristicas };
    filtrosFuente = { ...tempFiltrosFuente };
    mostrarPanelFiltros = false;
  }

  function limpiarFiltrosTemporales() {
    tempFiltroEstado = 'todos';
    tempFiltrosCaracteristicas = { betelita: false, interprete: false, visitante: false };
    tempFiltrosFuente = { en_persona: false, jw_stream: false, transmision_remota: false, video: false };
  }

  function tieneOrador(parte: any): boolean {
    if (parte.es_video) return false;
    const tiposSinOrador = ['Video musical', 'Producción audiovisual', 'Anuncio', 'Serie'];
    if (tiposSinOrador.some(t => t.toLowerCase() === (parte.tipo || '').toLowerCase())) {
      return false;
    }
    return true;
  }

  // ==================== FUNCIONES DE FILTRADO Y ORDENAMIENTO ====================
  function aplicarFiltros(listaPartes: any[], dias: string[], estado: string, caracteristicas: any, fuente: any, orden: string) {
    let resultado = [...listaPartes];
    if (dias.length > 0) {
      resultado = resultado.filter(p => dias.includes(p.dia));
    } else {
      return [];
    }
    if (estado === 'asignada') {
      resultado = resultado.filter(p => p.nombre_orador && p.nombre_orador.trim() !== '');
    } else if (estado === 'sin_asignar') {
      resultado = resultado.filter(p => !p.nombre_orador || p.nombre_orador.trim() === '');
    }
    let filtroCaracActivo = caracteristicas.betelita || caracteristicas.interprete || caracteristicas.visitante;
    let filtroFuenteActivo = fuente.video || fuente.en_persona || fuente.jw_stream || fuente.transmision_remota;
    if (filtroCaracActivo || filtroFuenteActivo) {
      resultado = resultado.filter(p => {
        let f = p.fuente || '';
        let isVid = p.es_video === true || f.toLowerCase().includes('video') || f.toLowerCase().includes('vídeo');
        let isStr = f === 'jw_stream' || f === 'Descarga de JW Stream';
        let isRem = f === 'transmision_remota' || f === 'Transmisión remota en directo';
        let isPer = !isVid && !isStr && !isRem;
        let coincideCarac = (caracteristicas.betelita && p.es_betelita) ||
                            (caracteristicas.interprete && p.es_interprete) ||
                            (caracteristicas.visitante && p.es_visitante);
        let coincideFuente = (fuente.video && isVid) ||
                             (fuente.jw_stream && isStr) ||
                             (fuente.transmision_remota && isRem) ||
                             (fuente.en_persona && isPer);
        if (filtroCaracActivo && !filtroFuenteActivo) return coincideCarac;
        if (!filtroCaracActivo && filtroFuenteActivo) return coincideFuente;
        return coincideCarac || coincideFuente;
      });
    }
    return resultado;
  }

  function ordenarPartes(partesAOrdenar: any[]) {
    if (ordenarPor === 'orador') {
      return [...partesAOrdenar].sort((a, b) => {
        const nombreA = a.nombre_orador || 'ZZZ';
        const nombreB = b.nombre_orador || 'ZZZ';
        return nombreA.localeCompare(nombreB);
      });
    }
    return [...partesAOrdenar].sort((a, b) => {
      const orden = { 'Viernes': 1, 'Sábado': 2, 'Domingo': 3 };
      const ordenDia = orden[a.dia as keyof typeof orden] - orden[b.dia as keyof typeof orden];
      if (ordenDia !== 0) return ordenDia;
      return (a.hora_inicio || '').localeCompare(b.hora_inicio || '');
    });
  }

  function toggleDia(dia: string) {
    if (dia === 'Todos') {
      if (diasSeleccionados.length === 3) {
        diasSeleccionados = [];
      } else {
        diasSeleccionados = ['Viernes', 'Sábado', 'Domingo'];
      }
    } else {
      const index = diasSeleccionados.indexOf(dia);
      if (index > -1) {
        diasSeleccionados = diasSeleccionados.filter(d => d !== dia);
      } else {
        diasSeleccionados = [...diasSeleccionados, dia];
      }
    }
    localStorage.setItem('memoriaDias', JSON.stringify(diasSeleccionados));
  }

  // ==================== DECLARACIONES REACTIVAS ====================
  $: partesFiltradas = ordenarPartes(aplicarFiltros(partes, diasSeleccionados, filtroEstado, filtrosCaracteristicas, filtrosFuente, ordenarPor));
  $: todasExpandidas = partesFiltradas.length > 0 && partesFiltradas.every(p => p._expanded);
  $: labelDia = (() => {
    if (diasSeleccionados.length === 0) return 'Seleccionar día';
    if (diasSeleccionados.length === 3) return 'Todos los días';
    if (diasSeleccionados.length === 1) return diasSeleccionados[0];
    if (diasSeleccionados.length === 2) return diasSeleccionados.join(' y ');
    return `${diasSeleccionados.length} días`;
  })();

  // Contadores para email masivo
  $: cantidadCorreosMasivos = new Set(
    partesFiltradas
      .filter(p => p.email_orador && p.email_orador.trim() && !p.es_video)
      .map(p => p.email_orador.trim())
  ).size;
  $: cantidadSinCorreo = partesFiltradas.filter(p => 
    !p.es_video && 
    p.nombre_orador && p.nombre_orador.trim() !== '' && 
    (!p.email_orador || p.email_orador.trim() === '')
  ).length;

  // ==================== FUNCIONES PARA COLORES Y SERIES ====================
  function getColorValue(color: string): string {
    const mapa: Record<string, string> = {
      'naranja': '#f97316',
      'azul': '#3b82f6',
      'verde': '#10b981',
      'morado': '#8b5cf6',
      'rojo': '#ef4444',
      'gris': '#64748b'
    };
    return mapa[color] || 'transparent';
  }

  function extraerBaseSerie(tema: string): string | null {
    const patron = /\s*\([Pp]arte\s*\d+\)|\s*\(\s*\d+\s*\)|\s*\([IVXLCDM]+\)|\s*\([Ss]erie\s+de\s+discursos\)/;
    const base = tema.split(patron)[0]?.trim();
    if (base && base.length > 10 && base !== tema) return base;
    return null;
  }

  let coloresSeries = new Map<string, string>();

async function guardarColorSerie(baseTitulo: string, color: string) {
  coloresSeries.set(baseTitulo, color);
  await DB.guardarColorSerie(asambleaId, baseTitulo, color);
  console.log("💾 Color guardado en BD:", baseTitulo, color);
}

async function cargarColoresSeriesBD() {
  if (!asambleaId) {
    console.warn("asambleaId no definido, no se pueden cargar colores");
    return;
  }
  const mapa = await DB.cargarColoresSeries(asambleaId);
  coloresSeries = mapa;
  console.log("📥 Colores cargados desde BD:", Array.from(coloresSeries.entries()));
}

  let paletaAbierta: string | null = null;

  function togglePaletaSerie(id: string) {
    paletaAbierta = paletaAbierta === id ? null : id;
  }

  // --- AGRUPACIÓN VISUAL DE SERIES DE DISCURSOS ---
  interface GrupoPartes {
    tipo: 'normal' | 'serie';
    cabecera?: any;
    partes: any[];
  }

  $: gruposPartes = (() => {
    const grupos: GrupoPartes[] = [];
    let i = 0;
    const total = partesFiltradas.length;

    while (i < total) {
      const parte = partesFiltradas[i];
      if (parte.tipo === 'Serie') {
        let grupoManual: GrupoPartes = { tipo: 'serie', cabecera: parte, partes: [] };
        let j = i + 1;
        while (j < total && 
               partesFiltradas[j].tipo === 'Discurso' &&
               partesFiltradas[j].dia === parte.dia &&
               partesFiltradas[j].sesion === parte.sesion) {
          grupoManual.partes.push(partesFiltradas[j]);
          j++;
        }
        grupos.push(grupoManual);
        i = j;
        continue;
      }
      if (parte.tipo === 'Discurso' && !parte.es_video) {
        const baseActual = extraerBaseSerie(parte.tema);
        if (baseActual) {
          let j = i + 1;
          while (j < total && 
                 partesFiltradas[j].tipo === 'Discurso' && 
                 extraerBaseSerie(partesFiltradas[j].tema) === baseActual) {
            j++;
          }
          if (j - i >= 2) {
            const discursosSerie = partesFiltradas.slice(i, j);
            const claveSerie = `${parte.dia}|${parte.sesion}|${baseActual}`;
            const cabeceraVirtual = {
               ...parte,
               id: `serie_${Date.now()}_${i}`,
               tema: baseActual,
               hora_inicio: parte.hora_inicio,
               tipo: 'Serie',
               color_destacado: coloresSeries.get(claveSerie) || ''
            };
            cabeceraVirtual._claveSerie = claveSerie;
            grupos.push({ tipo: 'serie', cabecera: cabeceraVirtual, partes: discursosSerie });
            i = j;
            continue;
          }
        }
      }
      grupos.push({ tipo: 'normal', partes: [parte] });
      i++;
    }
    return grupos;
  })();

  // ==================== FUNCIONES QUE USAN VARIABLES REACTIVAS ====================
  function handleClickOutside(event: MouseEvent) {
    paletaAbierta = null;
    const target = event.target as HTMLElement;
    if (mostrarSelectorDia && !target.closest('.dia-sel')) {
      mostrarSelectorDia = false;
    }
    if (mostrarSelectorOrdenar && !target.closest('.ord-sel')) {
      mostrarSelectorOrdenar = false;
    }
    if (mostrarMenuEmailTodos && !target.closest('.email-masivo-container')) {
      mostrarMenuEmailTodos = false;
    }
  }

  // ==================== CARGA DE DATOS Y FUNCIONES PRINCIPALES ====================
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
        es_visitante: p.es_visitante || false,
        color_destacado: p.color_destacado || '',
      }));
      const pendientes = partes
        .filter(p => p.nombre_orador && (!p.estado || p.estado !== 'Confirmado'))
        .map(p => ({ id: p.id, nombre: p.nombre_orador, tema: p.tema, estado: p.estado || 'Pendiente' }));
      oradoresPendientes.set(pendientes);
    } catch (e) { console.error(e); }
  }

  async function cargarHermanos() { 
    if (!asambleaId) return;
    listaHermanos = await invoke('obtener_personas', { asambleaId }) as any[]; 
  }

  function toggleExpandir(id: number) {
    partes = partes.map(p => {
      if (p.id === id) return { ...p, _expanded: !p._expanded };
      return p; 
    });
  }

  function toggleExpandirTodas() {
    const nuevoEstado = !todasExpandidas;
    partes = partes.map(p => ({ ...p, _expanded: nuevoEstado }));
  }

  // --- WHATSAPP ---
  async function abrirWhatsAppAsignacion(objeto: any) {
    const urls = await obtenerUrlsWhatsApp(objeto, false);
    if (urls) {
      try {
        await openUrl(urls.nativeUrl);
        objeto.whatsapp_enviado = true;
        partes = partes;
      } catch (e) {
        console.warn("App nativa no encontrada, usando fallback web:", e);
        try {
          await openUrl(urls.webUrl);
          objeto.whatsapp_enviado = true;
          partes = partes;
        } catch (err) {
          console.error("No se pudo abrir WhatsApp:", err);
          alert("No se pudo abrir WhatsApp. Verifica tu navegador predeterminado.");
        }
      }
    }
  }

  async function abrirWhatsAppRecordatorio(objeto: any) {
    const urls = await obtenerUrlsWhatsApp(objeto, true);
    if (urls) {
      try {
        await openUrl(urls.nativeUrl);
        objeto.recordatorio_whatsapp_enviado = true;
        partes = partes;
      } catch (e) {
        console.warn("App nativa no encontrada, usando fallback web:", e);
        try {
          await openUrl(urls.webUrl);
          objeto.recordatorio_whatsapp_enviado = true;
          partes = partes;
        } catch (err) {
          console.error("No se pudo abrir WhatsApp:", err);
          alert("No se pudo abrir WhatsApp. Verifica tu navegador predeterminado.");
        }
      }
    }
  }

  // --- CORREOS ---
  async function obtenerUrlCorreo(objeto: any, esRecordatorio: boolean): Promise<string | null> {
    const emailDestino = (objeto.email_visual || objeto.email_orador || objeto.email || "").trim();
    if (!emailDestino) {
      alert("⚠️ No hay correo registrado.");
      return null;
    }
    let idPlantilla = esRecordatorio ? 'programa_recordatorio' : 'programa_individual';
    const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();
    if (rol.includes('oficina') || rol.includes('auxiliar')) {
      idPlantilla = 'oficina';
    } else if (rol.includes('comite') || rol.includes('comité')) {
      idPlantilla = 'comite';
    } else if (rol.includes('audio') || rol.includes('video') || rol.includes('soporte') || rol.includes('departamento')) {
      idPlantilla = 'departamentos';
    }
    const plantilla = obtenerPlantillaPorId(idPlantilla);
    const asuntoBase = plantilla?.subject || "Asignación JWPUB";
    const cuerpoBase = plantilla?.body || "⚠️ No se ha definido una plantilla para este tipo de asignación.";
    const contexto = await generarContexto(objeto, asambleaId, true);
    let asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
    let cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);
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
  async function obtenerUrlsWhatsApp(objeto: any, esRecordatorio: boolean = false): Promise<{ nativeUrl: string, webUrl: string } | null> {
    const telefono = (objeto.telefono_visual || objeto.telefono_orador || objeto.telefono || "").trim();
    if (!telefono) {
      alert("⚠️ No hay teléfono registrado.");
      return null;
    }
    let idPlantilla = esRecordatorio ? 'programa_recordatorio' : 'programa_individual';
    const rol = (objeto.rol_key || objeto.tipo_asignacion || '').toLowerCase();
    if (rol.includes('oficina') || rol.includes('auxiliar')) {
      idPlantilla = 'oficina';
    } else if (rol.includes('comite') || rol.includes('comité')) {
      idPlantilla = 'comite';
    } else if (rol.includes('audio') || rol.includes('video') || rol.includes('soporte') || rol.includes('departamento')) {
      idPlantilla = 'departamentos';
    }
    let plantilla = obtenerPlantillaWhatsAppPorId(idPlantilla);
    let cuerpoBase = plantilla?.body || "";
    if (!cuerpoBase) {
      console.log(`📱 Plantilla WhatsApp "${idPlantilla}" no encontrada en store, cargando desde Rust...`);
      try {
        const res: any = await invoke('obtener_plantilla_mensaje', { id: idPlantilla });
        if (res && res.cuerpo) cuerpoBase = res.cuerpo;
      } catch (e) { console.error(`Error cargando plantilla WhatsApp ${idPlantilla}:`, e); }
    }
    if (!cuerpoBase) cuerpoBase = "⚠️ No se ha definido una plantilla para WhatsApp.";
    const contexto = await generarContexto(objeto, asambleaId, true);
    let mensaje = prepararContenidoWhatsApp(cuerpoBase, contexto);
    mensaje = mensaje.substring(0, 4000);
    const numero = telefono.replace(/\D/g, '');
    return {
      nativeUrl: `whatsapp://send?phone=${numero}&text=${encodeURIComponent(mensaje)}`,
      webUrl: `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
    };
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
    busquedaEdit = ""; 
    mostrarSugerenciasEdit = false;
    mostrarModalAsignar = true; 
  }

  function cerrarModales() { 
    mostrarModalAsignar = false; 
    mostrarModalCrear = false; 
    parteEditando = null; 
  }

  async function actualizarDetallesParte(parteId: number) {
    if (!parteEditando) return;
    try {
      await DB.actualizarDetallesParte({ 
        idParte: parteId, 
        tema: parteEditando.tipo === 'Canción' ? String(parteEditando.tema) : parteEditando.tema,
        colorDestacado: parteEditando.color_destacado || null,
        numeroBosquejo: parteEditando.numero_bosquejo?.trim() || null,
        fuente: parteEditando.fuente || 'en_persona',
        esBetelita: parteEditando.es_betelita || false,
        esInterprete: parteEditando.es_interprete || false,
        esVisitante: parteEditando.es_visitante || false,
        duracion: Number(parteEditando.duracion) || 0,
        requiereEnsayo: parteEditando.requiere_ensayo || false,
        fechaEnsayo: parteEditando.fecha_ensayo || null,
        horaEnsayo: parteEditando.hora_ensayo || null,
        lugarEnsayo: parteEditando.lugar_ensayo || null,
        notasEnsayo: parteEditando.notas_ensayo || null
      });
      await cargarTodosDias();
      alert("✅ Datos de la parte actualizados correctamente.");
    } catch (e) {
      console.error("Error al actualizar detalles:", e);
      alert("Error al guardar: " + e);
    }
  }

  async function asignarOrador(oradorId: number | null, esVideo: boolean) {
    if (parteEditando) {
      const bsq = parteEditando?.numero_bosquejo?.trim() || "";
      try {
        await DB.actualizarDetallesParte({ 
          idParte: parteEditando.id, 
          tema: parteEditando.tema, 
          colorDestacado: parteEditando.color_destacado || null,
          numeroBosquejo: bsq || null,
          fuente: parteEditando.fuente || 'en_persona',
          esBetelita: parteEditando.es_betelita || false,
          esInterprete: parteEditando.es_interprete || false,
          esVisitante: parteEditando.es_visitante || false,
          duracion: Number(parteEditando.duracion) || 0,
          requiereEnsayo: parteEditando.requiere_ensayo || false,
          fechaEnsayo: parteEditando.fecha_ensayo || null,
          horaEnsayo: parteEditando.hora_ensayo || null,
          lugarEnsayo: parteEditando.lugar_ensayo || null,
          notasEnsayo: parteEditando.notas_ensayo || null
        });
        await DB.asignarParte({ 
          idParte: parteEditando.id, 
          oradorId: oradorId, 
          esVideo: esVideo,
          numeroBosquejo: bsq || null
        });
        cerrarModales();
        await cargarTodosDias(); 
      } catch (e) {
        alert("Error al guardar parte: " + e);
      }
    }
  }

  async function guardarNuevaParte() {
    if(!nuevaParte.hora || !nuevaParte.tema) return alert("Faltan datos");
    try {
      await DB.crearParte({ 
        asambleaId, 
        dia: nuevaParte.dia, 
        sesion: nuevaParte.sesion, 
        hora: nuevaParte.hora, 
        tema: nuevaParte.tipo === 'Canción' ? String(nuevaParte.tema) : nuevaParte.tema, 
        tipo: nuevaParte.tipo, 
        duracion: Number(nuevaParte.duracion), 
        nombre_orador: nuevaParte.nombre_orador.trim() || null, 
        congregacion: nuevaParte.congregacion.trim() || null, 
        email: nuevaParte.email.trim() || null, 
        telefono: nuevaParte.telefono.trim() || null,
        numero_bosquejo: nuevaParte.numero_bosquejo.trim() || null,
        fuente: nuevaParte.fuente,
        esBetelita: nuevaParte.es_betelita,
        esInterprete: nuevaParte.es_interprete,
        esVisitante: nuevaParte.es_visitante,
        colorDestacado: nuevaParte.color_destacado || null
      });
      mostrarModalCrear = false; 
      nuevaParte = { dia: diaSeleccionado, hora: '', tema: '', tipo: 'Discurso', duracion: 0, sesion: 'Mañana', nombre_orador: '', congregacion: '', email: '', telefono: '', numero_bosquejo: '', fuente: 'en_persona', es_betelita: false, es_interprete: false, es_visitante: false, color_destacado: '' };
      await cargarTodosDias(); 
    } catch (e) { 
      alert("Error al crear parte: " + e); 
    }
  }
  
  let mostrarModalLimpiar = false;

  async function limpiarTodoConfirmado() {
    mostrarModalLimpiar = false;
    try {
      await DB.limpiarPrograma({ asambleaId });
      await cargarTodosDias();
    } catch (e) { alert('Error al limpiar: ' + e); }
  }

  let mostrarModalEliminar = false;
  let idParteAEliminar: number | null = null;

  async function confirmarEliminarParte() {
    if (!idParteAEliminar) return;
    mostrarModalEliminar = false;
    try {
      await DB.eliminarParte({ id: idParteAEliminar });
      await cargarTodosDias();
      idParteAEliminar = null;
    } catch (e) { alert('Error al eliminar: ' + e); }
  }
  
  async function importarPrograma() { 
    try { 
      const f = await openDialog({ filters: [{ name: 'CSV', extensions: ['csv'] }] }); 
      if(f) { 
        await DB.importarProgramaJw({ asambleaId, rutaArchivo: f }); 
        await cargarTodosDias(); 
        await cargarHermanos(); 
      } 
    } catch(e) { alert("Error al importar: " + e); }
  }

  async function handleExportarPrograma() {
    let tituloPDF = labelDia;
    if (diasSeleccionados.length === 3) {
      tituloPDF = 'Programa Completo (3 días)';
    } else if (diasSeleccionados.length === 0) {
      return alert("⚠️ Seleccione al menos un día para generar el PDF.");
    }
    await exportarProgramaPDF(partesFiltradas, tituloPDF, coloresSeries);
  }

  async function enviarEmailMasivo(idPlantilla: string) {
    const emails = new Set<string>();
    partesFiltradas.forEach(p => {
      if (p.email_orador && p.email_orador.trim() && !p.es_video) {
        emails.add(p.email_orador.trim());
      }
    });
    const listaCorreos = Array.from(emails).join(';');
    if (listaCorreos.length === 0) {
      return alert("⚠️ No hay correos registrados para las partes que estás viendo actualmente en pantalla.");
    }
    try {
      const plantilla = obtenerPlantillaPorId(idPlantilla);
      const asuntoBase = plantilla?.subject || "Información de la Asamblea";
      const cuerpoBase = plantilla?.body || "";
      const objetoSimulado = {
        nombre_completo: 'Hermanos', nombre_pila: 'Hermanos', apellidos: '',
        tema: '', hora_inicio: '', hora: '', tipo_asignacion: 'General',
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
      mostrarMenuEmailTodos = false;
    } catch (error) {
      console.error("Error al procesar el email masivo:", error);
      alert("Ocurrió un error al generar el correo masivo.\n" + error);
    }
  }

  // --- FILTRADO PARA SUGERENCIAS EN CREACIÓN ---
  function filtrarOradores() { 
    const t = nuevaParte.nombre_orador.toLowerCase(); 
    if (t.length < 2) {
      sugerenciasOradores = [];
      mostrarSugerencias = false;
      return;
    } 
    sugerenciasOradores = listaHermanos.filter(h => h.nombre_completo.toLowerCase().includes(t)); 
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
    return listaHermanos.filter(h => h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase()));
  }

  const nombreTxt = (obj: any) => obj ? obj.nombre_completo : "Seleccionar...";

  // ==================== CARGA DE TODOS LOS DÍAS ====================
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
          circuito_orador: p.circuito_orador || '',
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
          es_visitante: p.es_visitante || false,
          requiere_ensayo: p.requiere_ensayo || false,
          fecha_ensayo: p.fecha_ensayo || '',
          hora_ensayo: p.hora_ensayo || '',
          lugar_ensayo: p.lugar_ensayo || '',
          notas_ensayo: p.notas_ensayo || ''
        }));
        todasLasPartes = [...todasLasPartes, ...partesConDia];
      }
      partes = todasLasPartes;
    } catch (e) {
      console.error(e);
    }
  }

  // ==================== onMount ====================
onMount(async () => {
  const diasGuardados = localStorage.getItem('memoriaDias');
  if (diasGuardados) {
    diasSeleccionados = JSON.parse(diasGuardados);
  }
  const datosGuardados = localStorage.getItem('asambleaActiva');
  if (datosGuardados) {
    asambleaId = JSON.parse(datosGuardados).id;
    await Promise.all([
      cargarTodosDias(),
      cargarHermanos(),
      cargarPlantillasEmail(),
      cargarPlantillasWhatsApp(),
      cargarColoresSeriesBD().catch(e => console.error("Error cargando colores:", e))
    ]);
  } else {
    alert("⚠️ No hay asamblea seleccionada.");
  }
  window.addEventListener('click', handleClickOutside);
});

  onDestroy(() => {
    window.removeEventListener('click', handleClickOutside);
  });
</script>

<!-- ========== HTML ========== -->
<div class="layout-programa">
  <Panel padding="0" clasesExtra="panel-discursos-override">

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

   <button class="btn-header-filtros" on:click={abrirPanelFiltros}>
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

     <button class="btn-header-csv" on:click={importarPrograma} title="Importar programa desde archivo CSV">
      <FileSpreadsheet size={18}/> <span>Importar desde CSV</span>
    </button>
    
    <button class="btn-primary" on:click={() => mostrarModalCrear = true} title="Añadir nueva parte al programa">
      <Plus size={18}/> <span>Añadir parte</span>
    </button>
   

    <button class="btn-header-pdf" title="Exportar lista de discursos a PDF" on:click={handleExportarPrograma}>
      <FileUp size={18}/> <span>Generar PDF</span>
    </button>

    <button class="btn-header-delete" on:click={() => mostrarModalLimpiar = true} title="Borrar todo el programa del día">
      <Trash2 size={18}/> <span>Limpiar toda la lista</span>
    </button>

    <div class="selector-dia-container email-masivo-container">
      <button class="btn-header-orange" on:click|stopPropagation={() => {mostrarMenuEmailTodos = !mostrarMenuEmailTodos; mostrarSelectorDia = false; mostrarSelectorOrdenar = false;}}>
        <Mail size={18}/> <span>Email a todos</span>
      </button>
      
      {#if mostrarMenuEmailTodos}
        <div class="dropdown-dias" style="right: 0; left: auto; min-width: 260px; padding: 0; overflow: hidden;" on:click|stopPropagation>
          
          <div style="padding: 12px 15px; background: var(--bg-secondary); border-bottom: 1px solid var(--border);">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px;">
              Destinatarios listos
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: {cantidadCorreosMasivos > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: {cantidadCorreosMasivos > 0 ? '#10b981' : '#ef4444'}; font-weight: bold; font-size: 12px;">
                {cantidadCorreosMasivos}
              </div>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">
                {cantidadCorreosMasivos === 1 ? 'Orador con correo' : 'Oradores con correo'}
              </span>
            </div>
          </div>

          {#if cantidadSinCorreo > 0}
            <div style="padding: 8px 15px; background: rgba(245, 158, 11, 0.1); border-bottom: 1px solid var(--border); display: flex; gap: 8px; color: #d97706; font-size: 11.5px; font-weight: 600;">
              <span>⚠️ Atención: {cantidadSinCorreo} {cantidadSinCorreo === 1 ? 'asignado' : 'asignados'} sin dirección de correo.</span>
            </div>
          {/if}
          
          <button class="dia-opcion" 
                  on:click={() => enviarEmailMasivo('masivo_general')}
                  disabled={cantidadCorreosMasivos === 0}
                  style={cantidadCorreosMasivos === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}>
            <FileJson size={16} color={cantidadCorreosMasivos > 0 ? "#f97316" : "var(--text-secondary)"}/> 
            <span style="font-weight:600;">JWPUB a todos</span>
          </button>
          
          <div class="separator-dropdown" style="margin: 0;"></div>
          
          <button class="dia-opcion" 
                  on:click={() => enviarEmailMasivo('masivo_recordatorio')}
                  disabled={cantidadCorreosMasivos === 0}
                  style={cantidadCorreosMasivos === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}>
            <Clock size={16} color={cantidadCorreosMasivos > 0 ? "#3b82f6" : "var(--text-secondary)"}/> 
            <span style="font-weight:600;">JWPUB Recordatorio</span>
          </button>
          
        </div>
      {/if}
    </div>

    <button class="btn-expandir-todos" on:click={toggleExpandirTodas} title={todasExpandidas ? "Contraer todas las tarjetas" : "Expandir todas las tarjetas"}>
      {#if todasExpandidas}
        <FoldVertical size={18}/> <span>Contraer</span>
      {:else}
        <UnfoldVertical size={18}/> <span>Expandir</span>
      {/if}
    </button>
    
  </div>
</div>

    <div class="lista-partes">
  {#if partes.length === 0}
    <div class="empty-state"><p>Programa vacío para este día.</p></div>
  {/if}
  
  {#each gruposPartes as grupo}

   {#if grupo.tipo === 'serie'}
  <!-- CABECERA DE SERIE DE DISCURSOS (hover muestra acciones) -->
  <div class="cabecera-serie" 
    style={grupo.cabecera.color_destacado ? `border-left-color: ${getColorValue(grupo.cabecera.color_destacado)};` : ''}>
    
    <div class="serie-meta">
      <span class="serie-dia-badge">{grupo.cabecera.dia}</span>
      <span class="separador-dot">•</span>
      <span class="serie-hora"
        style={grupo.cabecera.color_destacado ? `color: ${getColorValue(grupo.cabecera.color_destacado)};` : ''}>
        {grupo.cabecera.hora_inicio}
      </span>
    </div>

    <div class="serie-titulo-container">
      <span class="serie-etiqueta"
        style={grupo.cabecera.color_destacado ? `color: ${getColorValue(grupo.cabecera.color_destacado)};` : ''}>
        SERIE DE DISCURSOS:
      </span>
      <span class="serie-nombre">{grupo.cabecera.tema}</span>
    </div>

    <div class="serie-acciones">
      <!-- Selector de color -->
      <div class="selector-color-serie" on:click|stopPropagation>
  <button class="btn-icon" on:click={() => togglePaletaSerie(grupo.cabecera.id)} title="Cambiar color de la serie">
    <span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: {getColorValue(grupo.cabecera.color_destacado) || '#ccc'};"></span>
  </button>
  {#if paletaAbierta === grupo.cabecera.id}
    <div class="paleta-colores-serie" style="display: flex;">
      {#each [ { valor: '', etiqueta: 'Sin color', bg: 'transparent', border: 'var(--border)' }, { valor: 'naranja', etiqueta: 'Naranja', bg: '#f97316', border: '#ea580c' }, { valor: 'azul', etiqueta: 'Azul', bg: '#3b82f6', border: '#2563eb' }, { valor: 'verde', etiqueta: 'Verde', bg: '#10b981', border: '#059669' }, { valor: 'morado', etiqueta: 'Morado', bg: '#8b5cf6', border: '#7c3aed' }, { valor: 'rojo', etiqueta: 'Rojo', bg: '#ef4444', border: '#dc2626' }, { valor: 'gris', etiqueta: 'Gris', bg: '#64748b', border: '#475569' } ] as color}
        <button 
          type="button"
          class="circulo-color"
          class:seleccionado={grupo.cabecera.color_destacado === color.valor}
          style="background: {color.bg}; border-color: {color.border};"
          title={color.etiqueta}

          on:click={async () => {
            grupo.cabecera.color_destacado = color.valor;
            await guardarColorSerie(grupo.cabecera._claveSerie, color.valor);
            gruposPartes = gruposPartes;
            paletaAbierta = null;
          }}>

          {#if grupo.cabecera.color_destacado === color.valor}
            <span style="color: {color.valor === '' ? 'var(--text-main)' : 'white'}; font-size: 14px;">✓</span>
          {/if}

        </button>
      {/each}
    </div>
  {/if}
</div>

      <!-- Botones editar/eliminar -->
      <button class="btn-icon-square edit" title="Editar serie" on:click={() => abrirModalPrograma(grupo.cabecera)}>
        <Edit size={14}/>
      </button>
      <button class="btn-icon-square delete" title="Eliminar serie" on:click={() => { 
        if (confirm('¿Eliminar esta serie? (Esto eliminará todos los discursos de la serie)')) {
          for (const discurso of grupo.partes) {
            idParteAEliminar = discurso.id;
            confirmarEliminarParte();
          }
        }
      }}>
        <Trash2 size={14}/>
      </button>
    </div>
  </div>

  <!-- TARJETAS DE LA SERIE (sin cambios, igual que antes) -->
  <div class="contenedor-serie"
    style={grupo.cabecera.color_destacado ? `border-left-color: ${getColorValue(grupo.cabecera.color_destacado)};` : ''}>
    {#each grupo.partes as parte}
      <div class="tarjeta-acordeon tarjeta-en-serie"
        class:expanded={parte._expanded}
        class:estado-presente={parte.esta_presente}
        class:estado-confirmado={parte.recibido_manual && !parte.esta_presente}
        class:estado-ensayo={parte.ensayo_terminado && !parte.esta_presente && !parte.recibido_manual}
        style={parte.color_destacado ? `--color-parte: ${getColorValue(parte.color_destacado)};` : ''}>

        {#if parte.color_destacado}
          <div class="franja-color" style="background: {getColorValue(parte.color_destacado)};"></div>
        {/if}
    
        <div class="header-parte" role="button" tabindex="0" 
             on:click={() => toggleExpandir(parte.id)} 
             on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpandir(parte.id)}>
          <div class="col-main-info">
            <div class="meta-programacion">
              <span class="dia-badge">{parte.dia}</span>
              <span class="separador-dot">•</span>
              <span class="hora-inicio">{parte.hora_inicio}</span>
              {#if parte.duracion && parte.duracion > 0}
                <span class="separador-dot">•</span>
                <span class="minutos-duracion">{parte.duracion} min</span>
              {/if}
            </div>
            <div class="col-tema-bloque">
              <span class="tema-txt">
                {#if parte.numero_bosquejo && parte.numero_bosquejo.trim() !== ''}
                  <span class="bosquejo-parentesis">({parte.numero_bosquejo})</span>
                {/if}
                {#if parte.tipo === 'Canción'}
                  Canción {parte.tema} y oración
                {:else}
                  {parte.tema}
                {/if}
              </span>
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
                {#if parte.requiere_ensayo}
                  <span class="badge-fuente ensayo-req"><Mic size={10}/> Requiere ensayo</span>
                {/if}
              </div>
            </div>
          </div>

          <div class="col-orador-mini">
            {#if tieneOrador(parte)}
              <span class="orador-nombre">{parte.nombre_orador || "Sin asignar"}</span>
              <div class="orador-meta">
                <span class="cong-mini">
                  {#if parte.circuito_orador}
                    <strong style="color: var(--primary);">[{parte.circuito_orador}]</strong> 
                  {/if}
                  {#if parte.congregacion_orador}
                    {parte.congregacion_orador}
                  {/if}
                </span>
              </div>
              <div class="traits-container">
                {#if parte.es_betelita}
                  <span class="trait-badge betelita">Betelita</span>
                {/if}
                {#if parte.es_interprete}
                  <span class="trait-badge interprete">Intérprete</span>
                {/if}
                {#if parte.es_visitante}
                  <span class="trait-badge visitante">Visitante</span>
                {/if}
              </div>
            {/if}
          </div>

          <div class="col-toggle">
            {#if parte._expanded}<ChevronUp size={20} color="var(--text-secondary)"/>{:else}<ChevronDown size={20} color="var(--text-secondary)"/>{/if}
          </div>
        </div>

        {#if parte._expanded}
          <div class="body-parte" transition:slide={{ duration: 200 }}>
            {#if tieneOrador(parte)}
              <div class="fila-superior-control">
                <div class="info-orador-full">
                  <span class="label-tiny">ORADOR:</span>
                  <strong>{parte.nombre_orador || "---"}</strong>
                  <div class="detalles-contacto-panel">
                    {#if parte.circuito_orador}
                      <span class="cong-tag" style="font-weight: 800; color: var(--primary);">{parte.circuito_orador}</span>
                    {/if}
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
              </div>
              <div class="grid-acciones">
                <button class="btn-pildora btn-print" on:click={() => procesarImpresion(parte, true)}>
                  <div class="icono-pildora"><Printer size={20}/></div>
                  <span>Imprimir Carta</span>
                </button>
                <button class="btn-pildora btn-jwpub" on:click={() => abrirJWPUBCarta(parte)}>
                  <div class="icono-pildora"><Mail size={20}/></div>
                  <span>Enviar Carta</span>
                  <span class="jw-badge">JW</span>
                </button>
                <button class="btn-pildora btn-whatsapp" on:click={() => abrirWhatsAppRecordatorio(parte)}>
                  <div class="icono-pildora"><MessageCircle size={20}/></div>
                  <span>WhatsApp, recordatorio</span>
                </button>
                <button class="btn-pildora btn-teal" on:click={() => abrirJWPUBRecordatorio(parte)}>
                  <div class="icono-pildora"><Mail size={20}/></div>
                  <span>Asignación, recordatorio</span>
                  <span class="jw-badge">JW</span>
                </button>
              </div>
            {/if}
            <div class="footer-tools">
              <button class="btn-icon-square edit" title="Editar Datos / Asignar" on:click={() => abrirModalPrograma(parte)}>
                <Edit size={20} strokeWidth={2}/>
              </button>
              <button class="btn-icon-square delete" title="Eliminar Parte" on:click={() => {idParteAEliminar = parte.id; mostrarModalEliminar = true;}}>
                <Trash2 size={20} strokeWidth={2}/>
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

{:else}
  <!-- PARTE NORMAL -->
      {#each grupo.partes as parte}
        <div class="tarjeta-acordeon"
          class:expanded={parte._expanded}
          class:estado-presente={parte.esta_presente}
          class:estado-confirmado={parte.recibido_manual && !parte.esta_presente}
          class:estado-ensayo={parte.ensayo_terminado && !parte.esta_presente && !parte.recibido_manual}
          style={parte.color_destacado ? `--color-parte: ${getColorValue(parte.color_destacado)};` : ''}>

          {#if parte.color_destacado}
            <div class="franja-color" style="background: {getColorValue(parte.color_destacado)};"></div>
          {/if}

          <div class="header-parte" role="button" tabindex="0" 
               on:click={() => toggleExpandir(parte.id)} 
               on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpandir(parte.id)}>
            
            <div class="col-main-info">
              <div class="meta-programacion">
                <span class="dia-badge">{parte.dia}</span>
                <span class="separador-dot">•</span>
                <span class="hora-inicio">{parte.hora_inicio}</span>
                {#if parte.duracion && parte.duracion > 0}
                  <span class="separador-dot">•</span>
                  <span class="minutos-duracion">{parte.duracion} min</span>
                {/if}
              </div>
              <div class="col-tema-bloque">
                <span class="tema-txt">
                  {#if parte.numero_bosquejo && parte.numero_bosquejo.trim() !== ''}
                    <span class="bosquejo-parentesis">({parte.numero_bosquejo})</span>
                  {/if}
                  {parte.tema}
                </span>
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
                  {#if parte.requiere_ensayo}
                    <span class="badge-fuente ensayo-req"><Mic size={10}/> Requiere ensayo</span>
                  {/if}
                </div>
              </div>
            </div>

            <div class="col-orador-mini">
              {#if tieneOrador(parte)}
                <span class="orador-nombre">{parte.nombre_orador || "Sin asignar"}</span>
                <div class="orador-meta">
                  <span class="cong-mini">
                    {#if parte.circuito_orador}
                      <strong style="color: var(--primary);">[{parte.circuito_orador}]</strong> 
                    {/if}
                    {#if parte.congregacion_orador}
                      {parte.congregacion_orador}
                    {/if}
                  </span>
                </div>
                <div class="traits-container">
                  {#if parte.es_betelita}
                    <span class="trait-badge betelita">Betelita</span>
                  {/if}
                  {#if parte.es_interprete}
                    <span class="trait-badge interprete">Intérprete</span>
                  {/if}
                  {#if parte.es_visitante}
                    <span class="trait-badge visitante">Visitante</span>
                  {/if}
                </div>
              {/if}
            </div>

            <div class="col-toggle">
              {#if parte._expanded}<ChevronUp size={20} color="var(--text-secondary)"/>{:else}<ChevronDown size={20} color="var(--text-secondary)"/>{/if}
            </div>
          </div>

          {#if parte._expanded}
            <div class="body-parte" transition:slide={{ duration: 200 }}>
              {#if tieneOrador(parte)}
                <div class="fila-superior-control">
                  <div class="info-orador-full">
                    <span class="label-tiny">ORADOR:</span>
                    <strong>{parte.nombre_orador || "---"}</strong>
                    <div class="detalles-contacto-panel">
                      {#if parte.circuito_orador}
                        <span class="cong-tag" style="font-weight: 800; color: var(--primary);">{parte.circuito_orador}</span>
                      {/if}
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
                </div>
                <div class="grid-acciones">
                  <button class="btn-pildora btn-print" on:click={() => procesarImpresion(parte, true)}>
                    <div class="icono-pildora"><Printer size={20}/></div>
                    <span>Imprimir Carta</span>
                  </button>
                  <button class="btn-pildora btn-jwpub" on:click={() => abrirJWPUBCarta(parte)}>
                    <div class="icono-pildora"><Mail size={20}/></div>
                    <span>Enviar Carta</span>
                    <span class="jw-badge">JW</span>
                  </button>
                  <button class="btn-pildora btn-whatsapp" on:click={() => abrirWhatsAppRecordatorio(parte)}>
                    <div class="icono-pildora"><MessageCircle size={20}/></div>
                    <span>WhatsApp, recordatorio</span>
                  </button>
                  <button class="btn-pildora btn-teal" on:click={() => abrirJWPUBRecordatorio(parte)}>
                    <div class="icono-pildora"><Mail size={20}/></div>
                    <span>Asignación, recordatorio</span>
                    <span class="jw-badge">JW</span>
                  </button>
                </div>
              {/if}
              <div class="footer-tools">
                <button class="btn-icon-square edit" title="Editar Datos / Asignar" on:click={() => abrirModalPrograma(parte)}>
                  <Edit size={20} strokeWidth={2}/>
                </button>
                <button class="btn-icon-square delete" title="Eliminar Parte" on:click={() => {idParteAEliminar = parte.id; mostrarModalEliminar = true;}}>
                  <Trash2 size={20} strokeWidth={2}/>
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  {/each}
    </div>
  </Panel>
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
        <h4 class="form-title">Detalles Base</h4>
        
        <div class="fila">
          <div class="campo">
            <label for="dia_select">Día</label>
            <select id="dia_select" bind:value={nuevaParte.dia}>
              <option value="Viernes">Viernes</option>
              <option value="Sábado">Sábado</option>
              <option value="Domingo">Domingo</option>
            </select>
          </div>
          <div class="campo">
            <label for="sesion_select">Sesión</label>
            <select id="sesion_select" bind:value={nuevaParte.sesion}>
              <option>Mañana</option>
              <option>Tarde</option>
            </select>
          </div>
        </div>

        <div class="fila">
          <div class="campo">
            <label for="hora_input">Hora</label>
            <input id="hora_input" type="time" bind:value={nuevaParte.hora} />
          </div>
          <div class="campo">
            <label for="duracion_input">Min</label>
            <input id="duracion_input" type="number" bind:value={nuevaParte.duracion} />
          </div>
        </div>

        <div class="fila">
          <div class="campo">
            <label for="tipo_select">Tipo</label>

           <select id="tipo_select" bind:value={nuevaParte.tipo}>
  <optgroup label="── Partes especiales ──">
    <option value="Video Musical">Video Musical</option>
    <option value="Canción">Canción y oración</option>
    <option value="Oración">Oración</option>
    <option value="Anuncio">Anuncio</option>
    <option value="Serie">Serie de Discursos</option>
  </optgroup>
  <optgroup label="── Partes regulares ──">
    <option value="Presidente">Presidente</option>
    <option value="Discurso">Discurso</option>
    <option value="Video">Video</option>
  </optgroup>
</select>

          </div>
          <div class="campo">
            <label for="fuente_select">Fuente</label>
            <select id="fuente_select" bind:value={nuevaParte.fuente} disabled={nuevaParte.tipo === 'Video'}>
              <option value="en_persona">En persona</option>
              <option value="jw_stream">Descarga de JW Stream</option>
              <option value="transmision_remota">Transmisión remota en directo</option>
              <option value="video">Video</option>
            </select>
          </div>
        </div>

        <div class="campo">
  <label for="tema_input">
    {#if nuevaParte.tipo === 'Canción'}
      Número de canción
    {:else if nuevaParte.tipo === 'Serie'}
      Título de la serie
    {:else if nuevaParte.tipo === 'Video Musical'}
      Descripción (opcional)
    {:else}
      Tema
    {/if}
  </label>
  <input 
    id="tema_input" 
    type={nuevaParte.tipo === 'Canción' ? 'number' : 'text'}
    placeholder={
      nuevaParte.tipo === 'Canción' ? 'Ej: 135' :
      nuevaParte.tipo === 'Serie' ? 'Título de la serie de discursos...' :
      nuevaParte.tipo === 'Video Musical' ? 'Video musical de apertura...' :
      'Tema...'
    }
    bind:value={nuevaParte.tema} 
  />
</div>
        
        <div class="campo">
          <label for="bosquejo_input">Número de Bosquejo</label>
          <input id="bosquejo_input" type="text" placeholder="Ej: 145" bind:value={nuevaParte.numero_bosquejo} />
        </div>

        <!-- SELECTOR DE COLOR DESTACADO -->
<div class="campo">
  <label>Color destacado <span style="font-size:11px; color:var(--text-sec); font-weight:400;">(opcional - para resaltar visualmente)</span></label>
  <div class="paleta-colores">
    {#each [
      { valor: '', etiqueta: 'Sin color', bg: 'transparent', border: 'var(--border)' },
      { valor: 'naranja', etiqueta: 'Naranja', bg: '#f97316', border: '#ea580c' },
      { valor: 'azul', etiqueta: 'Azul', bg: '#3b82f6', border: '#2563eb' },
      { valor: 'verde', etiqueta: 'Verde', bg: '#10b981', border: '#059669' },
      { valor: 'morado', etiqueta: 'Morado', bg: '#8b5cf6', border: '#7c3aed' },
      { valor: 'rojo', etiqueta: 'Rojo', bg: '#ef4444', border: '#dc2626' },
      { valor: 'gris', etiqueta: 'Gris', bg: '#64748b', border: '#475569' },
    ] as color}
      <button 
        type="button"
        class="circulo-color"
        class:seleccionado={nuevaParte.color_destacado === color.valor}
        style="background: {color.bg}; border-color: {color.border};"
        title={color.etiqueta}
        on:click={() => nuevaParte.color_destacado = color.valor}>
        {#if nuevaParte.color_destacado === color.valor}
          <span style="color: {color.valor === '' ? 'var(--text-main)' : 'white'}; font-size: 14px;">✓</span>
        {/if}
      </button>
    {/each}
  </div>
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
            <div class="campo" style="margin-top: 5px; margin-bottom: 15px;">
              <label>Características del Orador</label>
              <div style="display: flex; gap: 15px; margin-top: 8px;">
                <label class="checkbox-label"><input type="checkbox" bind:checked={nuevaParte.es_betelita}> Betelita</label>
                <label class="checkbox-label"><input type="checkbox" bind:checked={nuevaParte.es_interprete}> Intérprete</label>
                <label class="checkbox-label"><input type="checkbox" bind:checked={nuevaParte.es_visitante}> Visitante</label>
              </div>
            </div>

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
        <button class="btn-guardar" on:click={guardarNuevaParte}>Guardar Parte</button>
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
        <h3>Editar Parte</h3>
        <button class="btn-close" on:click={cerrarModales}><X size={18}/></button>
      </div>
      
      <div class="modal-body form-body">
        
        {#if parteEditando}
          <div class="campo-bosquejo" style="margin-bottom: 10px; background: var(--bg-body); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
            
            <div class="fila">
              <div class="campo">
                <label>Día</label>
                <select bind:value={parteEditando.dia}>
                  <option value="Viernes">Viernes</option>
                  <option value="Sábado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>
              <div class="campo">
                <label>Sesión</label>
                <select bind:value={parteEditando.sesion}>
                  <option>Mañana</option>
                  <option>Tarde</option>
                </select>
              </div>
            </div>

            <div class="fila">
              <div class="campo">
                <label>Hora</label>
                <input type="time" bind:value={parteEditando.hora_inicio} />
              </div>
              <div class="campo">
                <label>Tipo de Parte</label>
                <select bind:value={parteEditando.tipo}>
                  <optgroup label="── Partes especiales ──">
                    <option value="Video Musical">Video Musical</option>
                    <option value="Canción">Canción y oración</option>
                    <option value="Oración">Oración</option>
                    <option value="Anuncio">Anuncio</option>
                    <option value="Serie">Serie de Discursos</option>
                  </optgroup>
                  <optgroup label="── Partes regulares ──">
                    <option value="Presidente">Presidente</option>
                    <option value="Discurso">Discurso</option>
                    <option value="Video">Video</option>
                  </optgroup>
                </select>
              </div>
            </div>
            <div class="campo">
              <label for="edit_tema_input">
                {#if parteEditando.tipo === 'Canción'} Canción (escribe el número o texto completo)
                {:else if parteEditando.tipo === 'Serie'} Título de la serie
                {:else if parteEditando.tipo === 'Video Musical'} Descripción (opcional)
                {:else} Tema {/if}
              </label>
              <input 
                 id="edit_tema_input" 
                 type="text" 
                 bind:value={parteEditando.tema} 
              />
            </div>

            <div class="campo">
              <label>Color destacado <span style="font-size:11px; color:var(--text-sec); font-weight:400;">(opcional)</span></label>
              <div class="paleta-colores">
                {#each [
                  { valor: '', etiqueta: 'Sin color', bg: 'transparent', border: 'var(--border)' },
                  { valor: 'naranja', etiqueta: 'Naranja', bg: '#f97316', border: '#ea580c' },
                  { valor: 'azul', etiqueta: 'Azul', bg: '#3b82f6', border: '#2563eb' },
                  { valor: 'verde', etiqueta: 'Verde', bg: '#10b981', border: '#059669' },
                  { valor: 'morado', etiqueta: 'Morado', bg: '#8b5cf6', border: '#7c3aed' },
                  { valor: 'rojo', etiqueta: 'Rojo', bg: '#ef4444', border: '#dc2626' },
                  { valor: 'gris', etiqueta: 'Gris', bg: '#64748b', border: '#475569' },
                ] as color}
                  <button 
                    type="button" 
                    class="circulo-color" 
                    class:seleccionado={parteEditando.color_destacado === color.valor} 
                    style="background: {color.bg}; border-color: {color.border};" 
                    title={color.etiqueta} 
                    on:click={() => parteEditando.color_destacado = color.valor}>
                    {#if parteEditando.color_destacado === color.valor}
                      <span style="color: {color.valor === '' ? 'var(--text-main)' : 'white'}; font-size: 14px;">✓</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

            {#if !['Canción', 'Video Musical', 'Anuncio', 'Serie'].includes(parteEditando.tipo)}
                <div class="fila" style="margin-bottom: 15px; margin-top: 15px;">
                  <div class="campo" style="margin-bottom: 0; max-width: 90px;">
                    <label>Minutos</label>
                    <div class="input-icon">
                      <Clock size={16}/>
                      <input type="number" min="0" placeholder="0" bind:value={parteEditando.duracion} />
                    </div>
                  </div>
                  
                  <div class="campo" style="margin-bottom: 0;">
                    <label>Núm. Bosquejo</label>
                    <div class="input-icon">
                      <FileText size={16}/>
                      <input id="edit_bosquejo" type="text" placeholder="Ej: 178" bind:value={parteEditando.numero_bosquejo} />
                    </div>
                  </div>
                  
                  <div class="campo" style="margin-bottom: 0;">
                    <label>Fuente</label>
                    <select bind:value={parteEditando.fuente} disabled={parteEditando.es_video}>
                      <option value="en_persona">En persona</option>
                      <option value="jw_stream">Descarga JW Stream</option>
                      <option value="transmision_remota">Transmisión remota</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                </div>

                {#if !parteEditando.es_video}
                  <div class="campo" style="margin-bottom: 0;">
                    <label>Características del Orador</label>
                    <div style="display: flex; gap: 15px; margin-top: 8px;">
                      <label class="checkbox-label" style="font-size: 13px;"><input type="checkbox" bind:checked={parteEditando.es_betelita}> Betelita</label>
                      <label class="checkbox-label" style="font-size: 13px;"><input type="checkbox" bind:checked={parteEditando.es_interprete}> Intérprete</label>
                      <label class="checkbox-label" style="font-size: 13px;"><input type="checkbox" bind:checked={parteEditando.es_visitante}> Visitante</label>
                    </div>
                  </div>
                {/if}
            {/if}
          </div>

          {#if !['Video Musical', 'Anuncio', 'Serie'].includes(parteEditando.tipo)}
              <div class="separator-line" style="margin: 15px 0;"></div>

              <div class="ensayos-card" style="border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 15px; background: var(--bg-body);">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-main);">Ensayos</h4>
                <label class="checkbox-label" style="margin-bottom: 12px; font-weight: bold;">
                  <input type="checkbox" bind:checked={parteEditando.requiere_ensayo}> Agregar a ensayos
                </label>
                
                {#if parteEditando.requiere_ensayo}
                  <small style="display: block; margin-bottom: 15px; color: var(--text-secondary); font-style: italic; line-height: 1.3;">
                    * Deja estos campos siguientes en blanco para usar la información general de los ensayos de la asamblea
                  </small>

                  <div class="fila" style="margin-top: 5px; margin-bottom: 15px;">
                    <div class="campo">
                      <label>Fecha de ensayos</label>
                      <input type="date" bind:value={parteEditando.fecha_ensayo} />
                    </div>
                    <div class="campo">
                      <label>Hora de ensayos</label>
                      <div class="input-icon">
                        <Clock size={14}/>
                        <input type="time" bind:value={parteEditando.hora_ensayo} />
                      </div>
                    </div>
                  </div>
                  
                  <div class="campo" style="margin-bottom: 15px;">
                    <label>Lugar de ensayos</label>
                    <input type="text" bind:value={parteEditando.lugar_ensayo} />
                  </div>
                  
                  <div class="campo" style="margin-bottom: 0;">
                    <label>Notas de los ensayos</label>
                    <textarea bind:value={parteEditando.notas_ensayo} style="min-height: 80px;"></textarea>
                  </div>
                {/if}
              </div>

              <div class="campo autocomplete-container" style="margin-bottom: 20px;">
                <label style="margin-bottom: 10px; display: block; font-size: 13px;">
                  Orador actual: <strong style="color: var(--primary);">{parteEditando.nombre_orador || 'Sin asignar'}</strong>
                </label>
                <label>Buscar y Asignar Nuevo Orador</label>
                <div class="input-icon">
                  <Search size={16} />
                  <input type="text" placeholder="Escribe para buscar hermano..." 
                         bind:value={busquedaEdit} 
                         on:input={filtrarOradoresEdit}
                         on:blur={() => setTimeout(() => mostrarSugerenciasEdit = false, 200)} />
                </div>
                
                {#if mostrarSugerenciasEdit}
                  <div class="sugerencias-lista" style="position: absolute; max-height: 220px; margin-top: 8px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <button class="sugerencia-item video-option" style="color: #3b82f6; border-bottom: 1px solid var(--border);" on:click={() => asignarOrador(null, true)}>
                      <Video size={14} style="margin-right: 8px;"/> <span style="font-weight: 600;">Asignar como Video</span>
                    </button>
                    {#each sugerenciasEdit as h}
                      <button class="sugerencia-item" on:click={() => asignarOrador(h.id, false)}>
                        <span style="font-weight: 600;">{h.nombre_completo}</span>
                        <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;">{h.nombre_congregacion || '-'}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
          {/if}

          <div style="display: flex; flex-direction: column; gap: 5px; border-top: 1px solid var(--border); padding-top: 15px;">
            <button 
              class="btn-guardar" 
              style="margin-top: 0;"
              on:click={() => actualizarDetallesParte(parteEditando.id)}
            >
              Guardar Cambios
            </button>
            <small style="font-size: 10.5px; color: var(--text-secondary); font-style: italic; text-align: center; margin-top: 4px;">
              * Estos datos se guardan independientemente de quién sea el orador asignado arriba.
            </small>
          </div>

        {/if}
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
  <div class="modal-backdrop" role="dialog" aria-modal="true" on:click|self={() => mostrarPanelFiltros = false} on:keydown={(e) => { if (e.key === 'Escape') mostrarPanelFiltros = false; }}>
    <div class="modal-filtros">
      <div class="modal-header">
        <h3><Settings size={20}/> Filtros</h3>
        <button class="btn-close" on:click={() => mostrarPanelFiltros = false}>
          <X size={20}/>
        </button>
      </div>
      
      <div class="modal-body-filtros">
        <div class="filtros-activos-info">
          <h4>Filtros de búsqueda</h4>
          <p class="texto-secundario">Selecciona los criterios y presiona "Aplicar"</p>
        </div>

        <div class="grupo-filtro">
          <button class="filtro-header">
            <span>Estado de la asignación</span>
            <ChevronDown size={16}/>
          </button>
          <div class="filtro-contenido">
            <button class="btn-eliminar-filtro" on:click={() => tempFiltroEstado = 'todos'}>
              Eliminar
            </button>
            <label class="radio-label-filtro">
              <input type="radio" bind:group={tempFiltroEstado} value="todos">
              <span>Todos</span>
            </label>
            <label class="radio-label-filtro">
              <input type="radio" bind:group={tempFiltroEstado} value="asignada">
              <span>Asignada</span>
            </label>
            <label class="radio-label-filtro">
              <input type="radio" bind:group={tempFiltroEstado} value="sin_asignar">
              <span>Sin asignar</span>
            </label>
          </div>
        </div>

        <div class="grupo-filtro">
          <button class="filtro-header">
            <span>Características del orador</span>
            <ChevronDown size={16}/>
          </button>
          <div class="filtro-contenido">
            <button class="btn-eliminar-filtro" on:click={() => tempFiltrosCaracteristicas = {betelita: false, interprete: false, visitante: false}}>
              Eliminar
            </button>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={tempFiltrosCaracteristicas.betelita}>
              <span>Betelita</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={tempFiltrosCaracteristicas.interprete}>
              <span>Intérprete</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={tempFiltrosCaracteristicas.visitante}>
              <span>Visitante</span>
            </label>
          </div>
        </div>

        <div class="grupo-filtro">
          <button class="filtro-header">
            <span>Fuente</span>
            <ChevronDown size={16}/>
          </button>
          <div class="filtro-contenido">
            <button class="btn-eliminar-filtro" on:click={() => tempFiltrosFuente = {en_persona: false, jw_stream: false, transmision_remota: false, video: false}}>
              Eliminar
            </button>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={tempFiltrosFuente.en_persona}>
              <span>En persona</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={tempFiltrosFuente.jw_stream}>
              <span>Descarga de JW Stream</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={tempFiltrosFuente.transmision_remota}>
              <span>Transmisión remota en directo</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={tempFiltrosFuente.video}>
              <span>Video</span>
            </label>
          </div>
        </div>
      </div>

      <div class="modal-footer-filtros">
        <button class="btn-cancel" on:click={() => mostrarPanelFiltros = false}>Cancelar</button>
        <button class="btn-limpiar" on:click={limpiarFiltrosTemporales}>Limpiar Todo</button>
        <button class="btn-aplicar" on:click={aplicarCambiosFiltros}>Aplicar</button>
      </div>
    </div>
  </div>
{/if}

<style>
/* ==========================================================================
   PROGRAMA.SVELTE - ESTILOS UNIFICADOS CON VARIABLES GLOBALES
   ========================================================================== */

/* --- LAYOUT PRINCIPAL --- */
.layout-programa {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  padding-bottom: 0;
}

:global(.panel-discursos-override) {
  flex: 1 !important;
  width: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

/* --- CABECERA --- */
.header-sesion {
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
  gap: 15px;
  background: transparent;
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

/* --- LISTA DE PARTES --- */
.lista-partes {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  background: var(--bg-body);
}

/* --- TARJETAS ACORDEÓN --- */
.tarjeta-acordeon {
  background: var(--bg-card);
  border-radius: 10px;
  border: 1.5px solid var(--border);
  margin-bottom: 14px;
  overflow: hidden;
  transition: all 0.2s ease;
  color: var(--text-main);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
}
.tarjeta-acordeon:hover {
  box-shadow: var(--shadow-premium);
  transform: translateY(-2px);
  border-color: var(--primary);
}
.tarjeta-acordeon.expanded {
  border-color: var(--primary);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
}
.header-parte {
  display: flex;
  align-items: center;
  padding: 14px 15px;
  cursor: pointer;
  gap: 15px;
  background: transparent;
}
.header-parte:hover {
  background: var(--hover-bg);
}
.body-parte {
  border-top: 1px solid var(--border);
  background: var(--bg-body);
  padding: 15px 20px;
  color: var(--text-main);
}

/* --- ESTADOS HOVER POR TIPO (MANTIENEN COLORES SEMÁNTICOS) --- */
.tarjeta-acordeon.estado-presente:hover {
  background-color: rgba(16, 185, 129, 0.12);
}
.tarjeta-acordeon.estado-confirmado:hover {
  background-color: rgba(59, 130, 246, 0.12);
}
.tarjeta-acordeon.estado-ensayo:hover {
  background-color: rgba(249, 115, 22, 0.12);
}

/* --- TEXTO Y ELEMENTOS COMUNES --- */
.tema-txt {
  font-weight: 600;
  color: var(--text-main);
  font-size: 15px;
  line-height: 1.3;
}
.orador-nombre {
  font-weight: 600;
  color: var(--text-main);
  font-size: 13px;
  text-transform: uppercase;
}
.bosquejo-parentesis {
  color: var(--text-sec);
  font-weight: 600;
  font-size: 0.9em;
  margin-left: 5px;
}

/* --- CONTROLES DE CABECERA (BOTONES) --- */
.acciones-header {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  width: 100%;
  margin-top: 5px;
}
.header-sesion button {
  white-space: nowrap;
}
.btn-header-orange {
  background: transparent;
  border: 1px solid #f97316;
  color: #f97316;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-header-orange:hover {
  background: rgba(249, 115, 22, 0.1);
}
.btn-header-csv {
  background: transparent;
  border: 1px solid var(--accent-success);
  color: var(--accent-success);
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-header-csv:hover {
  background: rgba(16, 185, 129, 0.1);
}
.btn-header-delete {
  background: transparent;
  border: 1px solid var(--accent-danger);
  color: var(--accent-danger);
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-header-delete:hover {
  background: rgba(239, 68, 68, 0.1);
}
.btn-header-pdf {
  background: #dc2626;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-header-pdf:hover {
  background: #b91c1c;
  transform: translateY(-1px);
}
.btn-primary {
  background: var(--primary);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  display: flex;
  gap: 6px;
  cursor: pointer;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  transition: transform 0.2s;
}
.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
.btn-expandir-todos {
  background: #475569;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
}
.btn-expandir-todos:hover {
  background: #334155;
  transform: translateY(-1px);
}
.btn-header-filtros {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-main);
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
  border-color: var(--primary);
}

/* --- SELECTOR DE DÍAS Y ORDEN --- */
.selector-dia-container {
  position: relative;
}
.btn-selector-dia {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-main);
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  min-width: 200px;
  transition: all 0.2s;
}
.btn-selector-dia:hover {
  background: var(--hover-bg);
  border-color: var(--primary);
}
.dropdown-dias {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 5px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-premium);
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
  border-bottom: 1px solid var(--border);
  transition: background 0.2s;
}
.dia-opcion:last-child {
  border-bottom: none;
}
.dia-opcion:hover {
  background: var(--hover-bg);
}
.separator-dropdown {
  height: 1px;
  background: var(--border);
  margin: 5px 10px;
}
/* Forzar visibilidad de checkboxes en el dropdown */
.dia-opcion input[type="checkbox"],
.dia-opcion input[type="radio"] {
  display: inline-block !important;
  appearance: auto !important;
  -webkit-appearance: checkbox !important;
  width: 16px !important;
  height: 16px !important;
  opacity: 1 !important;
  visibility: visible !important;
  margin: 0 !important;
  pointer-events: none;
}
.dia-opcion input[type="radio"] {
  -webkit-appearance: radio !important;
}

/* --- METADATOS DE LA TARJETA --- */
.col-main-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}
.meta-programacion {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.dia-badge {
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-sec);
  font-size: 10px;
  letter-spacing: 0.5px;
}
.hora-inicio {
  font-weight: 700;
  color: var(--primary);
  font-size: 12px;
}
.separador-dot {
  color: var(--border);
  font-size: 12px;
}
.minutos-duracion {
  color: var(--text-sec);
  font-weight: 500;
}
.col-tema-bloque {
  display: flex;
  flex-direction: column;
}
.col-orador-mini {
  width: 180px;
  display: flex;
  flex-direction: column;
}
.col-toggle {
  color: var(--text-sec);
  margin-left: 10px;
}
.orador-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}
.cong-mini {
  font-size: 11px;
  color: var(--text-sec);
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
.traits-container {
  display: flex;
  gap: 5px;
  margin-top: 5px;
  flex-wrap: wrap;
}
/* --- ETIQUETAS DEL ORADOR (BETELITA / VISITANTE / INTÉRPRETE) --- */
.trait-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700; /* Subimos el grosor de la fuente para que resalte más */
  letter-spacing: 0.2px;
}

/* 🔵 BETELITA: Azul Índigo */
.trait-badge.betelita {
  background-color: #e0e7ff; 
  color: #3730a3; 
  border: 1px solid #c7d2fe;
}

/* 🟣 VISITANTE: Púrpura */
.trait-badge.visitante {
  background-color: #f3e8ff; 
  color: #6b21a8; 
  border: 1px solid #e9d5ff;
}

/* 🟢 INTÉRPRETE: Verde Esmeralda/Turquesa */
.trait-badge.interprete {
  background-color: #ccfbf1; 
  color: #0f766e; 
  border: 1px solid #99f6e4;
}

/* Compatibilidad Tema Oscuro (Para que no encandilen de noche) */
:global(.dark-theme) .trait-badge.betelita {
  background-color: rgba(55, 48, 163, 0.25);
  color: #a5b4fc;
  border-color: rgba(99, 102, 241, 0.3);
}
:global(.dark-theme) .trait-badge.visitante {
  background-color: rgba(107, 33, 168, 0.25);
  color: #d8b4fe;
  border-color: rgba(168, 85, 247, 0.3);
}
:global(.dark-theme) .trait-badge.interprete {
  background-color: rgba(15, 118, 110, 0.25);
  color: #5eead4;
  border-color: rgba(20, 184, 166, 0.3);
}

/* --- BADGES DE FUENTE Y ENSAYO --- */
.badges-row {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.badge-fuente {
  font-size: 9px;
  padding: 3px 7px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-weight: 700;
  text-transform: uppercase;
  border: 1px solid transparent;
}
.badge-fuente.video {
  background: rgba(225, 29, 72, 0.12); /* Fondo rojizo muy suave */
  color: #e11d48; /* Rojo carmesí intenso */
  border-color: rgba(225, 29, 72, 0.3); /* Borde rojizo visible */
}

/* Y si quieres asegurarte de que se vea perfecto en modo oscuro, añade esto justo debajo: */
:global(.dark-theme) .badge-fuente.video {
  background: rgba(225, 29, 72, 0.25);
  color: #fda4af;
  border-color: rgba(244, 63, 94, 0.3);
}

.badge-fuente.stream {
  background: rgba(37, 99, 235, 0.15);
  color: #3b82f6;
  border-color: rgba(37, 99, 235, 0.3);
}
.badge-fuente.remota {
  background: rgba(147, 51, 234, 0.15);
  color: #9333ea;
  border-color: rgba(147, 51, 234, 0.3);
}
.badge-fuente.en-persona {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}
.badge-fuente.ensayo-req {
  background: rgba(249, 115, 22, 0.15);
  color: #ea580c;
  border-color: rgba(249, 115, 22, 0.3);
}

/* --- DETALLES EXPANDIDOS --- */
.fila-superior-control {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.info-orador-full {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.label-tiny {
  font-size: 10px;
  font-weight: bold;
  color: var(--text-sec);
  letter-spacing: 0.5px;
}
.info-orador-full strong {
  font-size: 16px;
  color: var(--text-main);
}
.detalles-contacto-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 3px;
}
.cong-tag {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-main);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
}
.contact-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-sec);
}

/* --- GRID DE BOTONES PÍLDORA --- */
.grid-acciones {
  display: flex;
  justify-content: flex-start;
  gap: 12px;
  margin-top: 15px;
  margin-bottom: 15px;
  flex-wrap: nowrap;
  width: 100%;
}
.btn-pildora {
  display: flex;
  align-items: center;
  border-radius: 50px;
  border: none;
  padding: 5px 18px 5px 5px;
  color: white;
  font-weight: 600;
  font-size: 12.5px;
  letter-spacing: 0.2px;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  position: relative;
  height: 40px;
}
.btn-pildora:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
.icono-pildora {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.2);
  margin-right: 10px;
}
.icono-pildora :global(svg) {
  width: 15px !important;
  height: 15px !important;
}
.btn-print {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
}
.btn-jwpub {
  background: linear-gradient(135deg, #0f766e, #0e7490);
}
.btn-whatsapp {
  background: linear-gradient(135deg, #16a34a, #22c55e);
}
.btn-teal {
  background: linear-gradient(135deg, #0891b2, #06b6d4);
}
.jw-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: #0f172a;
  color: white;
  font-size: 9px;
  font-weight: 800;
  padding: 3px 6px;
  border-radius: 10px;
  border: 1.5px solid var(--bg-card);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.5px;
}

/* --- BOTONES CUADRADOS EDITAR/ELIMINAR --- */
.footer-tools {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border);
  padding-top: 15px;
}
.btn-icon-square {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ffffff;
  transition: transform 0.2s ease, filter 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.btn-icon-square:hover {
  transform: translateY(-2px);
  filter: brightness(1.15);
}
.btn-icon-square.edit {
  background-color: #5c1424;
}
.btn-icon-square.delete {
  background-color: #ff2b3d;
}

/* --- MODALES COMUNES --- */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 60px 20px;
}
.modal {
  background: var(--bg-card);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-premium);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 75vh;
  width: 480px;
  max-width: 100%;
}
.modal-confirm {
  width: 400px;
  max-width: 90vw;
}
.modal-header {
  padding: 16px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.modal-header h3 {
  color: var(--text-main);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.btn-close {
  color: var(--text-sec);
  opacity: 0.7;
  background: none;
  border: none;
  cursor: pointer;
}
.btn-close:hover {
  opacity: 1;
  color: var(--accent-danger);
}
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  background: var(--bg-body);
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-card);
}
.modal-footer-filtros {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-card);
}

/* --- FORMULARIOS --- */
.form-title {
  margin: 0 0 16px 0;
  font-size: 13px;
  font-weight: 800;
  color: var(--primary);
  text-transform: uppercase;
  border-bottom: 2px solid var(--border);
  padding-bottom: 8px;
}
.separator-line {
  height: 1px;
  background: transparent;
  margin: 10px 0 20px 0;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
  width: 100%;
}
.campo label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sec);
}
.campo input,
.campo select,
.input-icon input {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  background: var(--bg-body);
  color: var(--text-main);
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s ease;
  width: 100%;
  box-sizing: border-box;
}
.campo input:focus,
.campo select:focus,
.input-icon input:focus {
  border-color: var(--primary);
  background: var(--bg-card);
  box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15);
}
.input-icon {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}
.input-icon :global(svg) {
  position: absolute;
  left: 12px;
  color: var(--text-sec);
  pointer-events: none;
}
.input-icon input {
  padding-left: 38px !important;
}
.fila {
  display: flex;
  gap: 16px;
  width: 100%;
}
.fila .campo {
  flex: 1;
  margin-bottom: 0;
}
.btn-guardar {
  background: var(--primary);
  color: white;
  border: none;
  padding: 10px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 10px;
  width: 100%;
}
.btn-cancel {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-sec);
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel:hover {
  background: var(--hover-bg);
}
.btn-delete {
  background: rgba(239, 68, 68, 0.1);
  color: var(--accent-danger);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-delete:hover {
  background: rgba(239, 68, 68, 0.2);
}
.btn-limpiar {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-sec);
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
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

/* --- AUTOCOMPLETADO --- */
.autocomplete-container {
  position: relative;
}
.sugerencias-lista {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow-premium);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 5px;
}
.sugerencia-item {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 10px;
  border: none;
  background: var(--bg-card);
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  color: var(--text-main);
}
.sugerencia-item:hover {
  background: var(--hover-bg);
}

/* --- FILTROS (MODAL) --- */
.modal-filtros {
  background: var(--bg-card);
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
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
  border-bottom: 1px solid var(--border);
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
  color: var(--text-sec);
  font-style: italic;
}
.grupo-filtro {
  margin-bottom: 15px;
  border: 1px solid var(--border);
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
  border-top: 1px solid var(--border);
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
.checkbox-label,
.radio-label-filtro {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-main);
}
.checkbox-label input,
.radio-label-filtro input {
  accent-color: var(--primary);
  display: inline-block !important;
  appearance: auto !important;
  opacity: 1 !important;
  visibility: visible !important;
  width: 16px !important;
  height: 16px !important;
  margin: 0 !important;
  cursor: pointer !important;
}
.radio-label-filtro input[type="radio"] {
  -webkit-appearance: radio !important;
  appearance: radio !important;
}
.checkbox-label input[type="checkbox"] {
  -webkit-appearance: checkbox !important;
  appearance: checkbox !important;
}

/* --- ENSAYOS CARD DENTRO DEL MODAL --- */
.ensayos-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 15px;
  background: var(--bg-body);
}
.ensayos-card h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-main);
}
.ensayos-card textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-main);
  font-family: inherit;
  resize: vertical;
}

/* --- RESPONSIVE (MÓVILES Y TABLETS) --- */
@media (max-width: 768px) {
  .header-sesion {
    flex-direction: column;
    align-items: stretch;
    padding: 15px;
    gap: 12px;
  }
  .header-sesion-left {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }
  .header-sesion-left button span,
  .acciones-header button span {
    display: inline !important;
  }
  .selector-dia-container,
  .btn-selector-dia {
    width: 100% !important;
    min-width: 100% !important;
    height: 48px;
  }
  .acciones-header {
    flex-direction: column;
    gap: 10px;
  }
  .acciones-header button,
  .btn-header-filtros,
  .btn-expandir-todos {
    width: 100%;
    height: 48px;
    justify-content: center;
    margin: 0 !important;
  }
  .dropdown-dias {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90vw !important;
    max-height: 80vh;
    z-index: 10001;
  }
  .header-parte {
    flex-direction: column;
    align-items: flex-start;
    position: relative;
    padding: 15px;
  }
  .col-main-info {
    width: 100%;
    padding-right: 30px;
  }
  .col-orador-mini {
    width: 100%;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--border);
  }
  .col-toggle {
    position: absolute;
    top: 15px;
    right: 10px;
    margin: 0;
  }
  .body-parte {
    padding: 15px;
  }
  .fila-superior-control {
    flex-direction: column;
    gap: 15px;
  }
  .grid-acciones {
    flex-wrap: wrap;
  }
  .btn-pildora {
    width: 100%;
    justify-content: flex-start;
  }
  .footer-tools {
    flex-direction: row;
    justify-content: flex-end;
    gap: 12px;
  }
  .modal,
  .modal-filtros,
  .modal-confirm {
    width: 95vw !important;
    padding: 0;
  }
  .modal-body .fila {
    flex-direction: column;
    gap: 0;
  }
  .modal-body .campo,
  .grid-modal .campo {
    width: 100%;
  }
  .modal-footer,
  .modal-footer-filtros {
    flex-direction: column-reverse;
    gap: 10px;
  }
  .modal-footer button,
  .modal-footer-filtros button {
    width: 100%;
    height: 48px;
    justify-content: center;
  }
}

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
    overflow: visible;
    padding-bottom: 20px;
  }
  .lista-partes {
    overflow: visible;
  }
}

/* --- PALETA DE COLORES --- */
.paleta-colores {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 5px;
}

.circulo-color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  outline: none;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.circulo-color:hover {
  transform: scale(1.15);
}

.circulo-color.seleccionado {
  transform: scale(1.2);
  box-shadow: 0 0 0 3px var(--bg-card), 0 0 0 5px currentColor;
}

/* Sin color tiene borde especial */
.circulo-color:first-child {
  background: var(--bg-body) !important;
  border: 2px dashed var(--border) !important;
}

/* --- FRANJA DE COLOR EN TARJETAS DESTACADAS --- */
.tarjeta-acordeon {
  position: relative;
}

.franja-color {
  height: 4px;
  width: 100%;
  border-radius: 0;
}

/* Cuando tiene color, el tema se muestra con ese color */
.tarjeta-acordeon:has(.franja-color) .tema-txt {
  color: var(--color-parte, var(--text-main));
  font-weight: 700;
}

/* Borde izquierdo de acento */
.tarjeta-acordeon:has(.franja-color) {
  border-left: 3px solid var(--color-parte, var(--border));
}

/* Hora también toma el color */
.tarjeta-acordeon:has(.franja-color) .hora-inicio {
  color: var(--color-parte, var(--primary));
}

/* Selector de color para series */
.selector-color-serie {
  position: relative;
  display: inline-block;
}
.paleta-colores-serie {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  width: 200px;
  z-index: 200;
  box-shadow: var(--shadow-premium);
}
/* Asegurar que el círculo de color se vea bien */
.selector-color-serie .circulo-color {
  width: 28px;
  height: 28px;
}
/* Mostrar/ocultar la paleta al hacer clic (con JS simple) */
.selector-color-serie .paleta-colores-serie {
  display: none;
}
.selector-color-serie:hover .paleta-colores-serie {
  display: flex;
}

/* Estilos específicos para los botones de la cabecera de serie */
.cabecera-serie .serie-acciones {
  display: flex;
  gap: 6px;
  align-items: center;
}

.cabecera-serie .btn-icon-square {
  width: 28px !important;
  height: 28px !important;
  background: var(--bg-secondary) !important;
  color: var(--text-sec) !important;
  box-shadow: none !important;
  border-radius: 6px !important;
}

.cabecera-serie .btn-icon-square.edit {
  background: transparent !important;
  color: var(--primary) !important;
}
.cabecera-serie .btn-icon-square.edit:hover {
  background: rgba(var(--primary-rgb), 0.1) !important;
}

.cabecera-serie .btn-icon-square.delete {
  background: transparent !important;
  color: var(--accent-danger) !important;
}
.cabecera-serie .btn-icon-square.delete:hover {
  background: rgba(239, 68, 68, 0.1) !important;
}

/* Botón de color más pequeño */
/* Forzar tamaño correcto del botón selector de color */
.cabecera-serie .selector-color-serie .btn-icon {
  width: 18px !important;
  height: 18px !important;
  min-width: 18px !important;
  min-height: 18px !important;
  background: var(--bg-secondary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0 !important;
}

/* Reducir el ancho de la paleta de colores */
.paleta-colores-serie {
  width: 160px !important;
  padding: 6px !important;
  gap: 4px !important;
}

/* Reducir el tamaño de los círculos de color dentro de la paleta */
.paleta-colores-serie .circulo-color {
  width: 20px !important;
  height: 20px !important;
  min-width: 20px !important;
  min-height: 20px !important;
}

/* Ajustar el espacio entre círculos */
.paleta-colores-serie {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 6px !important;
}
.cabecera-serie .selector-color-serie .btn-icon:hover {
  background: var(--hover-bg);
}

.cabecera-serie .serie-titulo {
  font-size: 1rem;
  margin: 0;
  flex: 1;
  word-break: break-word;
  padding-right: 10px;
}

/* Cabecera de serie con hover en acciones */
.cabecera-serie {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 20px;
  background: var(--bg-card);
  border-left: 4px solid transparent;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: background 0.2s;
}
.cabecera-serie:hover {
  background: var(--hover-bg);
}
.serie-titulo-container {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
}
.serie-etiqueta {
  font-weight: 800;
  font-size: 0.9rem;
  letter-spacing: 0.5px;
  transition: color 0.2s;
}
.serie-nombre {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-main);
}
.serie-acciones {
  display: flex;
  gap: 6px;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.cabecera-serie:hover .serie-acciones {
  opacity: 1;
}
.cabecera-serie .btn-icon-square {
  width: 28px !important;
  height: 28px !important;
  background: var(--bg-secondary) !important;
  border-radius: 6px !important;
  box-shadow: none !important;
}
.cabecera-serie .btn-icon-square.edit {
  background: transparent !important;
  color: var(--primary) !important;
}
.cabecera-serie .btn-icon-square.edit:hover {
  background: rgba(var(--primary-rgb), 0.1) !important;
}
.cabecera-serie .btn-icon-square.delete {
  background: transparent !important;
  color: var(--accent-danger) !important;
}
.cabecera-serie .btn-icon-square.delete:hover {
  background: rgba(239, 68, 68, 0.1) !important;
}
.cabecera-serie .selector-color-serie .btn-icon {
  width: 18px;
  height: 18px;
  background: var(--bg-secondary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.cabecera-serie .selector-color-serie .btn-icon:hover {
  background: var(--hover-bg);
}

</style>