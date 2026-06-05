<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  
  // Iconos
  import { 
    Users, Search, X, Trash2, Phone, Mail, UserPlus, UserCheck, 
    Settings, ChevronRight, MessageCircle, ClipboardList, Printer,
    Briefcase, Calendar, Clock, Edit2, Download, FileUp
  } from 'lucide-svelte';

  import { exportarOficinaPDF } from '$lib/utils/exportar';

  import { generarContexto } from '$lib/utils/contexto_impresion';
  import { prepararContenidoEmail, prepararAsuntoEmail } from '$lib/utils/contextoEmail';
  import { obtenerPlantillaPorId, cargarPlantillasEmail } from '$lib/utils/plantillasEmail';
  import { obtenerPlantillaWhatsAppPorId, cargarPlantillasWhatsApp } from '$lib/utils/plantillasWhatsApp';
  import { prepararContenidoWhatsApp } from '$lib/utils/contextoWhatsApp';

  import { DB } from '$lib/services/db';

  // --- IMPORTACIONES PARA EL PANEL DEL PRESIDENTE ---
  import { get } from 'svelte/store';
  import { configPDF } from '$lib/stores/pdfConfigStore';
  import { generarPlantillaPresidenteDia } from '$lib/utils/plantillasPDF/plantillaPresidente';
  import { generarYGuardarPdfMake } from '$lib/utils/generadorPDF';

  // --- ESTADO ---
  let asambleaId = 0; 
  let tabPrincipal = 'auxiliares'; 
  let diaSeleccionado = 'Viernes';
  
  let oficina: { [key: string]: any } = {
      personal: [] as any[],
      asignaciones: {} 
  };

  let listaHermanos: any[] = []; 
  let terminoBusqueda = "";
  let mostrarSugerencias = false; 
  
  let mostrarModalAsignar = false;      
  let mostrarModalBloqueAsignacion = false; 
  
  let rolOficinaEditando: string | null = null; 
  let modoEdicion = false; 

  let formAsignacion = {
      dia: 'Viernes',
      seccion: 'manana',
      presidente: null as number | null,
      registro: null as number | null,
      ensayos: null as number | null,
      orientaciones: null as number | null,
      plataforma: null as number | null
  };
  
  let personaSeleccionadaId: number | null = null;
  let responsabilidades = {
    registro: false, ensayos: false, orientaciones: false,
    presidentes: false, acompañar_plataforma: false
  };
  let disponibilidad = { viernes: false, sabado: false, domingo: false };

  // --- CARGA DE DATOS ---
  onMount(async () => {
    const datosGuardados = localStorage.getItem('asambleaActiva');
    if (datosGuardados) {
        asambleaId = JSON.parse(datosGuardados).id;
        
        // 👇 Añadir la carga de plantillas aquí
        await cargarPlantillasEmail();
        await cargarPlantillasWhatsApp();

        // 👇 CARGAR CONFIGURACIÓN DESDE LA BASE DE DATOS AL INICIAR 👇
        const configGuardada = await DB.obtenerConfiguracionPDF();
        if (configGuardada) {
            configPDF.set(configGuardada);
        }
        
        await Promise.all([ cargarDatos(), cargarHermanos() ]);
    }
  });

  async function cargarDatos() {
    if (!asambleaId) return;
    try { 
        const datos = await invoke('obtener_asignaciones_especiales', { asambleaId, dia: diaSeleccionado }) as any[]; 
        organizarOficina(datos); 
    } catch (e) { console.error(e); }
  }

  async function cargarHermanos() { 
    if (!asambleaId) return;
    listaHermanos = await invoke('obtener_personas', { asambleaId }) as any[]; 
  }

  $: if (diaSeleccionado && asambleaId) cargarDatos();

  function organizarOficina(datos: any[]) {
      let nuevaOficina: any = { personal: [], asignaciones: {} };
      
      if (datos && Array.isArray(datos)) {
          datos.forEach(d => {
              try {
                  d.resp_obj = JSON.parse(d.responsabilidades || '{}');
                  d.disp_obj = JSON.parse(d.disponibilidad || '{}');
              } catch(e) { d.resp_obj = {}; d.disp_obj = {}; }

              if (d.tipo_asignacion === 'personal_oficina') {
                  nuevaOficina.personal.push(d);
              } else {
                  nuevaOficina.asignaciones[d.tipo_asignacion] = d;
              }
          });
      }
      oficina = nuevaOficina;
  }

  // --- LÓGICA ASIGNACIONES (BLOQUE) ---
  function abrirModalBloqueAsignacion() {
      formAsignacion = { dia: diaSeleccionado, seccion: 'manana', presidente: null, registro: null, ensayos: null, orientaciones: null, plataforma: null };
      mostrarModalBloqueAsignacion = true;
  }

  // 👇 NUEVA FUNCIÓN: CARGAR DATOS EXISTENTES EN EL MODAL 👇
  function abrirModalEditarBloque(seccion: string) {
      formAsignacion.dia = diaSeleccionado;
      formAsignacion.seccion = seccion;
      
      const roles = ['presidente', 'registro', 'ensayos', 'orientaciones', 'plataforma'];
      roles.forEach(rol => {
          const asignacion = oficina.asignaciones[`${rol}_${seccion}`];
          // @ts-ignore
          formAsignacion[rol] = asignacion ? asignacion.persona_id : null;
      });

      mostrarModalBloqueAsignacion = true;
  }

  function getCandidatosPorRol(rolClave: string) {
      let clave = rolClave === 'plataforma' ? 'acompañar_plataforma' : rolClave;
      if (clave === 'presidente') clave = 'presidentes';
      return oficina.personal.filter((p: any) => p.resp_obj && p.resp_obj[clave] === true);
  }

  async function guardarBloqueAsignaciones() {
      try {
          const roles = ['presidente', 'registro', 'ensayos', 'orientaciones', 'plataforma'];
          for (const rol of roles) {
              const personaId = formAsignacion[rol as keyof typeof formAsignacion];
              if (personaId) {
                  const tipoAsignacion = `${rol}_${formAsignacion.seccion}`;
                  
                  // 🔥 USAMOS EL EMBUDO PARA GUARDAR EL BLOQUE
                  await DB.guardarAsignacionEspecial({
                      asambleaId,
                      dia: formAsignacion.dia,
                      tipoAsignacion: tipoAsignacion,
                      personaId: Number(personaId)
                  });
              }
          }
          mostrarModalBloqueAsignacion = false;
          await cargarDatos();
      } catch (e) { alert("Error: " + e); }
  }

  async function vaciarBloque(seccion: string) {
      if (!confirm(`¿Borrar todo el horario de la ${seccion}?`)) return;
      const roles = ['presidente', 'registro', 'ensayos', 'orientaciones', 'plataforma'];
      try {
          for (const rol of roles) {
              const obj = oficina.asignaciones[`${rol}_${seccion}`];
              
              // 🔥 USAMOS EL EMBUDO PARA ELIMINAR CADA ROL DEL BLOQUE
              if (obj && obj.id) await DB.eliminarAsignacionEspecial({ id: obj.id });
          }
          await cargarDatos();
      } catch(e) { alert(e); }
  }

  // --- LÓGICA AUXILIARES ---
  function abrirModalAsignar(rol: string) { 
    modoEdicion = false;
    rolOficinaEditando = rol; 
    terminoBusqueda = "";
    personaSeleccionadaId = null;
    mostrarSugerencias = false; 
    responsabilidades = { registro: false, ensayos: false, orientaciones: false, presidentes: false, acompañar_plataforma: false };
    disponibilidad = { viernes: false, sabado: false, domingo: false };
    mostrarModalAsignar = true; 
  }

  function abrirModalEditar(p: any) {
    modoEdicion = true;
    rolOficinaEditando = 'personal_oficina';
    terminoBusqueda = p.nombre_completo;
    personaSeleccionadaId = p.persona_id; 
    mostrarSugerencias = false;
    responsabilidades = {
      registro: p.resp_obj?.registro || false,
      ensayos: p.resp_obj?.ensayos || false,
      orientaciones: p.resp_obj?.orientaciones || false,
      presidentes: p.resp_obj?.presidentes || false,
      acompañar_plataforma: p.resp_obj?.acompañar_plataforma || false
    };
    disponibilidad = {
      viernes: p.disp_obj?.viernes || false,
      sabado: p.disp_obj?.sabado || false,
      domingo: p.disp_obj?.domingo || false
    };
    mostrarModalAsignar = true;
  }

  function cerrarModales() { 
      mostrarModalAsignar = false; 
      mostrarModalBloqueAsignacion = false;
      rolOficinaEditando = null; 
      modoEdicion = false;
  }

  function seleccionarHermano(h: any) {
      terminoBusqueda = h.nombre_completo;
      personaSeleccionadaId = h.id;
      mostrarSugerencias = false; 
  }

 async function asignarHermano(oradorId: number) {
      if (!oradorId || !rolOficinaEditando) return;
      try {
          if (!modoEdicion) {
              // 🔥 USAMOS EL EMBUDO
              await DB.guardarAsignacionEspecial({ 
                  asambleaId, dia: diaSeleccionado, tipoAsignacion: rolOficinaEditando, personaId: oradorId 
              });
          }
          if (rolOficinaEditando === 'personal_oficina') {
              // 🔥 USAMOS EL EMBUDO
              await DB.guardarDetallesOficina({
                  personaId: oradorId,
                  responsabilidades: JSON.stringify(responsabilidades),
                  disponibilidad: JSON.stringify(disponibilidad)
              });
          }
          cerrarModales();
          await cargarDatos(); 
      } catch (e) { alert("Error: " + e); }
  }

  async function eliminarAsignacion(id: number) {
      if (!confirm("¿Quitar a este hermano permanentemente de la oficina?")) return;
      try {
          // 🔥 USAMOS EL EMBUDO
          await DB.eliminarAsignacionEspecial({ id });
          await cargarDatos(); 
      } catch (e) { alert("Error: " + e); }
  }

  const nombreTxt = (obj: any) => obj && obj.nombre_completo ? obj.nombre_completo : "Sin asignar";
  const iniciales = (obj: any) => obj && obj.nombre_completo ? obj.nombre_completo.substring(0, 2).toUpperCase() : "-";
  
  $: hermanosFiltrados = terminoBusqueda.trim() === "" 
      ? listaHermanos 
      : listaHermanos.filter(h => h?.nombre_completo?.toLowerCase().includes(terminoBusqueda.toLowerCase().trim()));


  // --- CONEXIÓN CON PLANTILLAS PARA AUXILIARES DE OFICINA ---
  async function enviarCorreoAuxiliar(p: any) {
      const emailDestino = (p.email || "").trim();
      if (!emailDestino) {
          return alert("⚠️ No hay correo registrado para este auxiliar.");
      }

      const plantilla = obtenerPlantillaPorId('oficina');
      const asuntoBase = plantilla?.subject || "Asignación en la Oficina de la Asamblea";
      const cuerpoBase = plantilla?.body || "⚠️ No se ha definido la plantilla de la oficina.";

      // Objeto simulado compatible con tu motor de contexto
      const objetoSimulado = {
          nombre_orador: p.nombre_completo,
          email_orador: p.email,
          telefono_orador: p.telefono,
          congregacion_orador: p.nombre_congregacion,
          tema: 'Asignación de Oficina',
          tipo_asignacion: 'Personal de Oficina'
      };

      const contexto = await generarContexto(objetoSimulado, asambleaId, false);
      let asuntoFinal = prepararAsuntoEmail(asuntoBase, contexto);
      let cuerpoFinal = prepararContenidoEmail(cuerpoBase, contexto);

      const url = `https://mail.jwpub.org/owa/#path=/mail/action/compose` +
         `&to=${encodeURIComponent(emailDestino)}` +
         `&subject=${encodeURIComponent(asuntoFinal)}` +
         `&body=${encodeURIComponent(cuerpoFinal)}`;
         
      openUrl(url).catch(e => console.error(e));
  }

  async function enviarWhatsAppAuxiliar(p: any) {
      const telefono = (p.telefono || "").trim();
      if (!telefono) {
          return alert("⚠️ No hay teléfono registrado para este auxiliar.");
      }

      let plantilla = obtenerPlantillaWhatsAppPorId('oficina');
      let cuerpoBase = plantilla?.body || "";

      if (!cuerpoBase) {
          try {
              const res: any = await invoke('obtener_plantilla_mensaje', { id: 'oficina' });
              if (res && res.cuerpo) cuerpoBase = res.cuerpo;
          } catch (e) {
              console.error("Error cargando plantilla WhatsApp oficina:", e);
          }
      }

      if (!cuerpoBase) cuerpoBase = "⚠️ No se ha definido la plantilla de oficina.";

      const objetoSimulado = {
          nombre_orador: p.nombre_completo,
          telefono_orador: p.telefono,
          congregacion_orador: p.nombre_congregacion,
          tema: 'Asignación de Oficina',
          tipo_asignacion: 'Personal de Oficina'
      };

      const contexto = await generarContexto(objetoSimulado, asambleaId, false);
      let mensaje = prepararContenidoWhatsApp(cuerpoBase, contexto);
      
      let telWa = telefono.replace(/\D/g, '').replace(/^\+/, '');
      if (!telWa.startsWith('53') && telWa.length === 8) telWa = '53' + telWa;

      // --- LÓGICA OPENER: Nativo con fallback a Web ---
      const nativeUrl = `whatsapp://send?phone=${telWa}&text=${encodeURIComponent(mensaje)}`;
      const webUrl = `https://wa.me/${telWa}?text=${encodeURIComponent(mensaje)}`;

      try {
          await openUrl(nativeUrl);
      } catch (error) {
          console.warn("App nativa no encontrada, usando fallback web:", error);
          try {
              await openUrl(webUrl);
          } catch (fallbackError) {
              console.error("Error al abrir WhatsApp:", fallbackError);
              alert("No se pudo abrir WhatsApp. Verifica tu navegador predeterminado.");
          }
      }
  }
  

      // --- EXPORTACIÓN A PDF ---
  async function manejarExportacionTotal() {
      if (!asambleaId) return alert("⚠️ No hay asamblea seleccionada.");
      
      try {
          const dias = ['Viernes', 'Sábado', 'Domingo'];
          const asignacionesPorDia: { [key: string]: any } = {};
          let todosLosAuxiliares: any[] = []; 

          // Buscar datos de los 3 días
          for (const dia of dias) {
              const datos = await invoke('obtener_asignaciones_especiales', { asambleaId, dia }) as any[];
              
              // Guardar auxiliares generales para la lista del final
              const auxiliaresDelDia = datos.filter(d => d.tipo_asignacion === 'personal_oficina');
              todosLosAuxiliares = [...todosLosAuxiliares, ...auxiliaresDelDia];
              
              // Mapear los roles específicos
              asignacionesPorDia[dia] = {
                  presidente_manana: datos.find(d => d.tipo_asignacion === 'presidente_manana'),
                  registro_manana: datos.find(d => d.tipo_asignacion === 'registro_manana'),
                  ensayos_manana: datos.find(d => d.tipo_asignacion === 'ensayos_manana'),
                  orientaciones_manana: datos.find(d => d.tipo_asignacion === 'orientaciones_manana'),
                  plataforma_manana: datos.find(d => d.tipo_asignacion === 'plataforma_manana'),
                  
                  presidente_tarde: datos.find(d => d.tipo_asignacion === 'presidente_tarde'),
                  registro_tarde: datos.find(d => d.tipo_asignacion === 'registro_tarde'),
                  ensayos_tarde: datos.find(d => d.tipo_asignacion === 'ensayos_tarde'),
                  orientaciones_tarde: datos.find(d => d.tipo_asignacion === 'orientaciones_tarde'),
                  plataforma_tarde: datos.find(d => d.tipo_asignacion === 'plataforma_tarde')
              };
          }

          // Eliminar auxiliares duplicados (porque aparecen en todos los días)
          const auxiliaresUnicos = Array.from(new Map(todosLosAuxiliares.map(p => [p.persona_id, p])).values());

          // Llamar a la librería pdfmake
          await exportarOficinaPDF(asignacionesPorDia, auxiliaresUnicos, "Resumen General de Oficina");

      } catch (e) {
          console.error("Error al generar PDF:", e);
          alert("Error al generar PDF: " + e);
      }
  }

async function manejarExportacionPresidente() {
        if (!asambleaId) return alert("⚠️ No hay asamblea seleccionada.");
        
        try {
            const asamblea = JSON.parse(localStorage.getItem('asambleaActiva') || '{}');
            const config = get(configPDF);
            const dias = ['Viernes', 'Sábado', 'Domingo'];

            let exportados = 0;

            // Ahora iteramos y generamos un documento NUEVO por cada día
            for (const dia of dias) {
                const res = await invoke('obtener_programa_dia', { asambleaId, dia }) as any[];
                
                if (res && res.length > 0) {
                    // Llamamos a la plantilla pasándole solo 1 día
                    const docDef = generarPlantillaPresidenteDia(res, asamblea, config, dia);
                    
                    // Guarda el documento con el nombre del día
                    await generarYGuardarPdfMake(docDef, `Tablero_Presidente_${dia}_${asamblea.identificador || '000'}`);
                    exportados++;
                }
            }
            
            if (exportados > 0) {
                console.log(`Se exportaron ${exportados} documentos independientes exitosamente.`);
            }

        } catch (error) {
            console.error("Error al generar PDF del Presidente:", error);
            alert("Error al generar el PDF: " + error);
        }
    }

  // 1. FUNCIÓN DE GUARDADO (La que me preguntaste)
    async function manejarCambioConfiguracion() {
        await DB.guardarConfiguracionPDF($configPDF);
        console.log("Configuración guardada en la base de datos");
    }
</script>

<div class="contenedor-oficina">
    
    <div class="tabs-navegacion">

        <button class:active={tabPrincipal === 'presidente'} on:click={() => tabPrincipal = 'presidente'}>
           <Briefcase size={18}/> Presidente
        </button>

        <button class:active={tabPrincipal === 'auxiliares'} on:click={() => tabPrincipal = 'auxiliares'}>
            <Users size={18}/> Auxiliares de oficina
        </button>
        <button class:active={tabPrincipal === 'asignaciones'} on:click={() => tabPrincipal = 'asignaciones'}>
            <Calendar size={18}/> Horario de oficina
        </button>
    </div>

    {#if tabPrincipal === 'auxiliares'}
        <div class="area-fade-in">
            <div class="header-seccion">
                <div class="textos">
                    <h2>Auxiliares de oficina</h2>
                    <p>Hermanos que apoyan en las diversas tareas de la oficina.</p>
                </div>
                <button class="btn-primary" on:click={() => abrirModalAsignar('personal_oficina')}>
                    <UserPlus size={16}/> Agregar persona
                </button>
            </div>

            <div class="grid-tarjetas-auxiliares">
                {#each oficina.personal as p}
                    <div class="tarjeta-personal">
                        <div class="tp-top">
                            <div class="tp-avatar">{p?.nombre_completo ? p.nombre_completo.charAt(0) : '?'}</div>
                            <div class="tp-acciones">
                                <button class="btn-icon" title="Editar configuraciones" on:click={() => abrirModalEditar(p)}><Edit2 size={14}/></button>
                                <button class="btn-icon delete" title="Quitar de la oficina" on:click={() => eliminarAsignacion(p.id)}><Trash2 size={14}/></button>
                            </div>
                        </div>
                        <div class="tp-info">
                            <h4 title={p.nombre_completo}>{p?.nombre_completo || 'Sin nombre'}</h4>
                            <span class="tp-email">{p.email || 'Sin correo registrado'}</span>
                            <div class="tp-badges">
                                {#if p.nombre_congregacion}
                                    <span class="badge gray">{p.nombre_congregacion}</span>
                                {/if}
                            </div>
                        </div>

                        <div class="tp-footer-botones">

                            <button class="btn-contacto" on:click={() => p.telefono ? openUrl(`tel:${p.telefono.replace(/[\s\-\(\)]/g, '')}`) : alert('Sin teléfono')}>
                                <Phone size={14}/> Teléfono
                            </button>

                            <button class="btn-contacto" on:click={() => enviarWhatsAppAuxiliar(p)}>
                                <MessageCircle size={14}/> WhatsApp
                            </button>

                            <button class="btn-contacto" on:click={() => enviarCorreoAuxiliar(p)}>
                                <Mail size={14}/> JW Email
                            </button>

                        </div>
                    </div>
                    
                {/each}
                {#if oficina.personal.length === 0}
                    <div class="vacio-absoluto">
                        <Users size={48} color="#cbd5e1"/>
                        <p>No hay personal registrado.</p>
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    {#if tabPrincipal === 'asignaciones'}
        <div class="area-fade-in">
            <div class="header-seccion">
                <div class="textos-horario">
                    <Calendar size={24} color="#1e40af"/>
                    <h2>Horario de oficina</h2>
                </div>
                <div class="acciones-derecha">
                    <div class="filtro-dias">
                        {#each ['Viernes', 'Sábado', 'Domingo'] as dia}
                            <button class:active={diaSeleccionado === dia} on:click={() => diaSeleccionado = dia}>{dia}</button>
                        {/each}
                    </div>

                    <button class="btn-outline" on:click={manejarExportacionTotal}>
                        <FileUp size={16}/> Exportar PDF
                    </button>

                    <button class="btn-primary" on:click={abrirModalBloqueAsignacion}>
                        <Edit2 size={16}/> Agregar horario
                    </button>

                </div>
            </div>

            <div class="grid-horarios">
                <div class="card-horario-bloque">
                    <div class="ch-header">
                        <div class="ch-title">
                            <Clock size={18} color="#3b82f6"/>
                            <h3>{diaSeleccionado} por la Mañana</h3>
                        </div>
                        <div class="ch-actions">
                            <button class="btn-icon" title="Editar este horario" on:click={() => abrirModalEditarBloque('manana')}>
                                <Edit2 size={16}/>
                            </button>
                            <button class="btn-icon delete" title="Vaciar sesión" on:click={() => vaciarBloque('manana')}>
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                    <div class="ch-grid">
                        {#each [
                            { label: 'Presidente de sesión', keyBase: 'presidente' }, 
                            { label: 'Mesa de Registro', keyBase: 'registro' }, 
                            { label: 'Ensayos y Sonido', keyBase: 'ensayos' }, 
                            { label: 'Orientaciones', keyBase: 'orientaciones' }, 
                            { label: 'Acompañante Plataforma', keyBase: 'plataforma' }
                        ] as item}
                            <div class="chip-rol">
                                <div class="chip-avatar">{iniciales(oficina.asignaciones[`${item.keyBase}_manana`])}</div>
                                <div class="chip-info">
                                    <span class="chip-label">{item.label}</span>
                                    <span class="chip-nombre" class:vacio={!oficina.asignaciones[`${item.keyBase}_manana`]}>
                                        {nombreTxt(oficina.asignaciones[`${item.keyBase}_manana`])}
                                    </span>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

                <div class="card-horario-bloque">
                    <div class="ch-header">
                        <div class="ch-title">
                            <Clock size={18} color="#f59e0b"/>
                            <h3>{diaSeleccionado} por la Tarde</h3>
                        </div>
                        <div class="ch-actions">
                            <button class="btn-icon" title="Editar este horario" on:click={() => abrirModalEditarBloque('tarde')}>
                                <Edit2 size={16}/>
                            </button>
                            <button class="btn-icon delete" title="Vaciar sesión" on:click={() => vaciarBloque('tarde')}>
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                    <div class="ch-grid">
                        {#each [
                            { label: 'Presidente de sesión', keyBase: 'presidente' }, 
                            { label: 'Mesa de Registro', keyBase: 'registro' }, 
                            { label: 'Ensayos y Sonido', keyBase: 'ensayos' }, 
                            { label: 'Orientaciones', keyBase: 'orientaciones' }, 
                            { label: 'Acompañante Plataforma', keyBase: 'plataforma' }
                        ] as item}
                            <div class="chip-rol">
                                <div class="chip-avatar">{iniciales(oficina.asignaciones[`${item.keyBase}_tarde`])}</div>
                                <div class="chip-info">
                                    <span class="chip-label">{item.label}</span>
                                    <span class="chip-nombre" class:vacio={!oficina.asignaciones[`${item.keyBase}_tarde`]}>
                                        {nombreTxt(oficina.asignaciones[`${item.keyBase}_tarde`])}
                                    </span>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    {/if}

   {#if tabPrincipal === 'presidente'}
        <div class="area-fade-in">
            <div class="header-seccion">
                <div class="textos">
                    <h2>Panel del Presidente</h2>
                    <p>Configure las especificaciones del tablero de la asamblea para la oficina de la presidencia.</p>
                </div>
                <button class="btn-primary" on:click={manejarExportacionPresidente}>
                    <Printer size={16}/> Generar PDF del Presidente
                </button>
            </div>

            <div class="panel-configuracion-pdf">
                <h3><Settings size={18} /> Dimensiones y Encabezado del Tablero</h3>
                
                <div style="display: flex; gap: 12px; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dashed var(--border);">
                    <button class="btn-outline" on:click={() => alert('Seleccionar archivo de imagen...')}>
                        Agregar imagen de encabezado
                    </button>
                    <button class="btn-outline" style="border-color: var(--accent-danger); color: var(--accent-danger);">
                        Eliminar imagen
                    </button>
                </div>
                
                <div class="config-grid">
                    <div class="config-item">
                        <label>Ancho (pulgadas)</label>
                        <input type="number" step="0.1" bind:value={$configPDF.ajustesTablero.anchoPulgadas} on:change={manejarCambioConfiguracion} style="padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-body); color: var(--text-main);" />
                    </div>

                    <div class="config-item">
                        <label>Alto (pulgadas)</label>
                        <input type="number" step="0.1" bind:value={$configPDF.ajustesTablero.altoPulgadas} on:change={manejarCambioConfiguracion} style="padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-body); color: var(--text-main);" />
                    </div>

                    <div class="config-item">
                        <label>Desplazamiento X</label>
                        <input type="number" step="1" bind:value={$configPDF.ajustesTablero.desplazamientoX} on:change={manejarCambioConfiguracion} style="padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-body); color: var(--text-main);" />
                    </div>

                    <div class="config-item">
                        <label>Desplazamiento Y</label>
                        <input type="number" step="1" bind:value={$configPDF.ajustesTablero.desplazamientoY} on:change={manejarCambioConfiguracion} style="padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-body); color: var(--text-main);" />
                    </div>

                    <div class="config-item" style="grid-column: 1 / -1; flex-direction: row; align-items: center; gap: 10px; margin: 10px 0;">
                        <input 
                            type="checkbox" 
                            id="checkAMPM" 
                            bind:checked={$configPDF.mostrarAMPM} 
                            on:change={manejarCambioConfiguracion} 
                            style="-webkit-appearance: checkbox !important; appearance: checkbox !important; width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer; display: inline-block; margin: 0;" 
                        />
                        <label for="checkAMPM" style="cursor: pointer; text-transform: none; font-size: 15px; font-weight: 600; color: var(--text-main); user-select: none;">
                            Mostrar AM/PM en los horarios
                        </label>
                    </div>

                    <div class="config-item color-picker-item">
                        <label>Color Canción / Oración</label>
                        <div class="input-color-wrapper">
                            <input type="color" bind:value={$configPDF.ajustesTablero.colorCancionOracion} on:change={manejarCambioConfiguracion} />
                            <span>{$configPDF.ajustesTablero.colorCancionOracion}</span>
                        </div>
                    </div>

                    <div class="config-item color-picker-item">
                        <label>Color Bloque Viernes</label>
                        <div class="input-color-wrapper">
                            <input type="color" bind:value={$configPDF.coloresPorDia.viernes} on:change={manejarCambioConfiguracion} />
                            <span>{$configPDF.coloresPorDia.viernes}</span>
                        </div>
                    </div>

                    <div class="config-item color-picker-item">
                        <label>Color Bloque Sábado</label>
                        <div class="input-color-wrapper">
                            <input type="color" bind:value={$configPDF.coloresPorDia.sabado} on:change={manejarCambioConfiguracion} />
                            <span>{$configPDF.coloresPorDia.sabado}</span>
                        </div>
                    </div>

                    <div class="config-item color-picker-item">
                        <label>Color Bloque Domingo</label>
                        <div class="input-color-wrapper">
                            <input type="color" bind:value={$configPDF.coloresPorDia.domingo} on:change={manejarCambioConfiguracion} />
                            <span>{$configPDF.coloresPorDia.domingo}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {/if}

</div>


{#if mostrarModalAsignar}
  <div class="modal-backdrop" on:click|self={cerrarModales}>
    <div class="modal modal-auxiliares">
      <div class="modal-header">
        <h3>
            {#if modoEdicion} <Edit2 size={20}/> Editar datos del auxiliar {:else} <UserPlus size={20}/> Añadir persona {/if}
        </h3>
        <button class="btn-close" on:click={cerrarModales}><X size={18}/></button>
      </div>
      <div class="modal-body">
        <div class="seccion-selector">
          <label class="label-seccion">Hermano Seleccionado</label>
          {#if modoEdicion}
              <div class="buscador solo-lectura">
                  <UserCheck size={16} color="var(--c-blue)"/>
                  <span style="font-weight: 600; color: var(--c-text); font-size: 14px;">{terminoBusqueda}</span>
              </div>
          {:else}
              <div class="buscador">
                  <Search size={16}/>
                  <input type="text" bind:value={terminoBusqueda} on:input={() => { mostrarSugerencias = true; personaSeleccionadaId = null; }} placeholder="Escriba el nombre..."/>
              </div>
              {#if mostrarSugerencias && terminoBusqueda.length > 0}
                  <div class="lista-opciones">
                    {#each hermanosFiltrados as h}
                      <button class="item-opcion" on:click={() => seleccionarHermano(h)}>
                        <div class="avatar-mini">{h.nombre_completo.charAt(0)}</div>
                        <div class="datos-opcion"><span class="n">{h.nombre_completo}</span><span class="c">{h.nombre_congregacion}</span></div>
                      </button>
                    {/each}
                  </div>
              {/if}
          {/if}
        </div>

        <div class="grid-checkboxes">
          <div class="columna-checks">
            <label class="label-seccion">Responsabilidades</label>
            <div class="lista-checks">
              <label class="checkbox-item"><input type="checkbox" bind:checked={responsabilidades.registro}><span>Registro</span></label>
              <label class="checkbox-item"><input type="checkbox" bind:checked={responsabilidades.ensayos}><span>Ensayos</span></label>
              <label class="checkbox-item"><input type="checkbox" bind:checked={responsabilidades.orientaciones}><span>Orientaciones</span></label>
              <label class="checkbox-item"><input type="checkbox" bind:checked={responsabilidades.presidentes}><span>Presidentes</span></label>
              <label class="checkbox-item"><input type="checkbox" bind:checked={responsabilidades.acompañar_plataforma}><span>Plataforma</span></label>
            </div>
          </div>
          <div class="columna-checks">
            <label class="label-seccion">Disponibilidad</label>
            <div class="lista-checks">
              <label class="checkbox-item"><input type="checkbox" bind:checked={disponibilidad.viernes}><span>Viernes</span></label>
              <label class="checkbox-item"><input type="checkbox" bind:checked={disponibilidad.sabado}><span>Sábado</span></label>
              <label class="checkbox-item"><input type="checkbox" bind:checked={disponibilidad.domingo}><span>Domingo</span></label>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancelar" on:click={cerrarModales}>Cancelar</button>
        <button class="btn-primary" disabled={!personaSeleccionadaId} on:click={() => asignarHermano(personaSeleccionadaId!)}>
            {modoEdicion ? 'Actualizar' : 'Agregar persona'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if mostrarModalBloqueAsignacion}
  <div class="modal-backdrop" on:click|self={cerrarModales}>
    <div class="modal modal-bloque">
      <div class="modal-header">
        <h3><Calendar size={20}/> Configurar Horario</h3>
        <button class="btn-close" on:click={cerrarModales}><X size={18}/></button>
      </div>
      
      <div class="modal-body">
        <div class="form-row-doble">
            <div class="form-grupo">
                <label>Día de la Asamblea</label>
                <select bind:value={formAsignacion.dia}>
                    <option value="Viernes">Viernes</option>
                    <option value="Sábado">Sábado</option>
                    <option value="Domingo">Domingo</option>
                </select>
            </div>
            <div class="form-grupo">
                <label>Sesión</label>
                <select bind:value={formAsignacion.seccion}>
                    <option value="manana">Sesión de Mañana</option>
                    <option value="tarde">Sesión de Tarde</option>
                </select>
            </div>
        </div>

        <div class="separador-txt">Seleccione a los hermanos capacitados:</div>

        <div class="lista-selects">
            {#each ['presidente', 'registro', 'ensayos', 'orientaciones', 'plataforma'] as rol}
                <div class="rol-box">
                    <label>{rol.toUpperCase()}</label>
                    <select bind:value={formAsignacion[rol as keyof typeof formAsignacion]}>
                        <option value={null}>-- Dejar vacío --</option>
                        {#each getCandidatosPorRol(rol) as c}
                            <option value={c.persona_id}>{c.nombre_completo}</option>
                        {/each}
                    </select>
                </div>
            {/each}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancelar" on:click={cerrarModales}>Cancelar</button>
        <button class="btn-primary" on:click={guardarBloqueAsignaciones}>Guardar Horario</button>
      </div>
    </div>
  </div>
{/if}

<style>
/* ========================================================
   OFICINA.SVELTE - ESTILOS UNIFICADOS CON VARIABLES GLOBALES
   ======================================================== */

.contenedor-oficina {
  padding: 30px 40px;
  height: 100%;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: transparent;
}

.area-fade-in {
  animation: fadeIn 0.3s ease-in-out;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== TABS NAVEGACIÓN ===== */
.tabs-navegacion {
  display: flex;
  gap: 20px;
  border-bottom: 2px solid var(--border);
  margin-bottom: 10px;
}
.tabs-navegacion button {
  background: none;
  border: none;
  padding: 10px 5px;
  margin-bottom: -2px;
  border-bottom: 3px solid transparent;
  color: var(--text-sec);
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  gap: 8px;
  align-items: center;
  transition: 0.2s;
}
.tabs-navegacion button:hover {
  color: var(--primary);
}
.tabs-navegacion button.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

/* ===== BOTONES GLOBALES ===== */
.btn-primary {
  background: var(--primary);
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: 0.2s;
}
.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-outline {
  background: var(--bg-card);
  color: var(--text-main);
  border: 1px solid var(--border);
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: 0.2s;
  box-shadow: var(--shadow-sm);
}
.btn-outline:hover {
  background: var(--bg-body);
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--text-sec);
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}
.btn-icon:hover {
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--primary);
}
.btn-icon.delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--accent-danger);
}

/* ===== CABECERAS SECCIÓN ===== */
.header-seccion {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}
.header-seccion h2 {
  margin: 0;
  font-size: 22px;
  color: var(--text-main);
  font-weight: 700;
}
.header-seccion p {
  margin: 4px 0 0 0;
  color: var(--text-sec);
  font-size: 14px;
}
.textos-horario {
  display: flex;
  align-items: center;
  gap: 10px;
}
.acciones-derecha {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ===== FILTRO DÍAS ===== */
.filtro-dias {
  display: flex;
  background: var(--border);
  padding: 2px;
  border-radius: 8px;
}
.filtro-dias button {
  background: transparent;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sec);
  cursor: pointer;
  transition: 0.2s;
}
.filtro-dias button.active {
  background: var(--bg-card);
  color: var(--text-main);
  box-shadow: var(--shadow-sm);
}

/* ===== PESTAÑA: AUXILIARES ===== */
.grid-tarjetas-auxiliares {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
.tarjeta-personal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.tp-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.tp-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
}
.tp-acciones {
  display: flex;
  gap: 5px;
}
.tp-info h4 {
  margin: 0;
  font-size: 16px;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tp-email {
  font-size: 13px;
  color: var(--text-sec);
  display: block;
  margin-top: 2px;
}
.tp-badges {
  display: flex;
  gap: 5px;
  margin-top: 10px;
}
.badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.badge.gray {
  background: var(--bg-body);
  color: var(--text-sec);
}
.tp-footer-botones {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-top: auto;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}
.btn-contacto {
  background: transparent;
  border: none;
  padding: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sec);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  transition: 0.2s;
}
.btn-contacto:hover {
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--primary);
}
.vacio-absoluto {
  grid-column: 1/-1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: var(--text-sec);
  text-align: center;
  background: var(--bg-card);
  border: 1px dashed var(--border);
  border-radius: 10px;
}

/* ===== PESTAÑA: HORARIOS ===== */
.grid-horarios {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}
.card-horario-bloque {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.ch-header {
  padding: 15px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-body);
}
.ch-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ch-title h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-main);
}
.ch-actions {
  display: flex;
  gap: 5px;
}
.ch-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px;
}
.chip-rol {
  background: var(--bg-body);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 15px;
  display: flex;
  align-items: center;
  gap: 15px;
  transition: 0.2s;
}
.chip-rol:hover {
  border-color: var(--primary);
  background: var(--bg-card);
}
.chip-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: bold;
  flex-shrink: 0;
}
.chip-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chip-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-sec);
  text-transform: uppercase;
  margin-bottom: 2px;
}
.chip-nombre {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip-nombre.vacio {
  color: var(--text-sec);
  font-weight: 400;
  font-style: italic;
}

/* ===== MODALES ===== */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-premium);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
}
.modal-auxiliares {
  width: 600px;
  max-height: 85vh;
}
.modal-bloque {
  width: 450px;
}
.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-main);
}
.btn-close {
  background: transparent;
  border: none;
  color: var(--text-sec);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: 0.2s;
  display: flex;
  align-items: center;
}
.btn-close:hover {
  background: var(--bg-body);
  color: var(--text-main);
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
}
.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: var(--bg-body);
}
.btn-cancelar {
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  transition: 0.2s;
}
.btn-cancelar:hover {
  background: var(--bg-body);
}
.form-row-doble {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
}
.form-grupo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-grupo label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sec);
  text-transform: uppercase;
}
.form-grupo select {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-card);
  font-family: inherit;
  font-size: 14px;
  color: var(--text-main);
  outline: none;
  transition: border-color 0.2s;
}
.form-grupo select:focus {
  border-color: var(--primary);
}
.separador-txt {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 15px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--border);
}
.lista-selects {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rol-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-body);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
}
.rol-box label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sec);
  width: 35%;
  text-transform: uppercase;
}
.rol-box select {
  width: 65%;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-main);
  outline: none;
}
.rol-box select:focus {
  border-color: var(--primary);
}
.seccion-selector {
  position: relative;
  margin-bottom: 25px;
}
.label-seccion {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sec);
  text-transform: uppercase;
  margin-bottom: 10px;
}
.buscador {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-card);
}
.buscador input {
  border: none;
  outline: none;
  flex: 1;
  font-size: 14px;
  background: transparent;
  color: var(--text-main);
}
.buscador.solo-lectura {
  background: var(--bg-body);
  opacity: 0.8;
}
.lista-opciones {
  position: absolute;
  z-index: 100;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-premium);
  margin-top: 5px;
}
.item-opcion {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 15px;
  background: var(--bg-card);
  border: none;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}
.item-opcion:hover {
  background: var(--bg-body);
}
.avatar-mini {
  width: 32px;
  height: 32px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 12px;
  flex-shrink: 0;
}
.datos-opcion {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.datos-opcion .n {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-main);
}
.datos-opcion .c {
  font-size: 12px;
  color: var(--text-sec);
}
.grid-checkboxes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}
.lista-checks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.checkbox-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 15px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: 0.2s;
}
.checkbox-item:hover {
  border-color: var(--primary);
  background: rgba(var(--primary-rgb), 0.05);
}
.checkbox-item input[type="checkbox"] {
  -webkit-appearance: checkbox !important;
  appearance: checkbox !important;
  width: 16px !important;
  height: 16px !important;
  cursor: pointer;
  accent-color: var(--primary);
}
.checkbox-item span {
  font-size: 14px;
  color: var(--text-main);
  user-select: none;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .contenedor-oficina {
    padding: 20px;
  }
  .header-seccion {
    flex-direction: column;
    gap: 15px;
  }
  .acciones-derecha {
    flex-wrap: wrap;
  }
  .grid-horarios {
    grid-template-columns: 1fr;
  }
  .modal-auxiliares,
  .modal-bloque {
    width: 95vw;
    max-width: 95vw;
  }
  .grid-checkboxes {
    grid-template-columns: 1fr;
  }
  .form-row-doble {
    grid-template-columns: 1fr;
  }
  .rol-box {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .rol-box label,
  .rol-box select {
    width: 100%;
  }
}

/* ===== PANEL DEL PRESIDENTE ===== */
.panel-configuracion-pdf {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    box-shadow: var(--shadow-sm);
    margin-top: 10px;
}

.panel-configuracion-pdf h3 {
    margin: 0 0 20px 0;
    font-size: 16px;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 10px;
}

.config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
}

.config-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.config-item label {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-sec);
    text-transform: uppercase;
}

.config-item select {
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-body);
    color: var(--text-main);
    outline: none;
    font-family: inherit;
}

.input-color-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg-body);
    border: 1px solid var(--border);
    padding: 6px 12px;
    border-radius: 6px;
}

.input-color-wrapper input[type="color"] {
    -webkit-appearance: none;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
    background: none;
}
.input-color-wrapper input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0;
}
.input-color-wrapper input[type="color"]::-webkit-color-swatch {
    border: 2px solid rgba(0,0,0,0.1);
    border-radius: 4px;
}
.input-color-wrapper span {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-main);
    font-family: monospace;
}
</style>