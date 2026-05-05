<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open as openUrl } from '@tauri-apps/plugin-shell';
  
  // Iconos
  import { 
    Users, Search, X, Trash2, Phone, Mail, UserPlus, UserCheck, 
    Settings, ChevronRight, MessageCircle, ClipboardList, Printer,
    Briefcase, Calendar, Clock, Edit2, Download
  } from 'lucide-svelte';

  // --- ESTADO ---
  let asambleaId = 0; 
  let tabPrincipal = 'auxiliares'; 
  let diaSeleccionado = 'Viernes';
  
  // Datos procesados
  let oficina: { [key: string]: any } = {
      personal: [] as any[],
      asignaciones: {} 
  };

  let listaHermanos: any[] = []; 
  let terminoBusqueda = "";
  let mostrarSugerencias = false; // Controla la lista de autocompletado
  
  // Modales
  let mostrarModalAsignar = false;      
  let mostrarModalBloqueAsignacion = false; 
  
  let rolOficinaEditando: string | null = null; 

  // Formulario para el nuevo modal de Asignaciones
  let formAsignacion = {
      dia: 'Viernes',
      seccion: 'manana',
      presidente: null as number | null,
      registro: null as number | null,
      ensayos: null as number | null,
      orientaciones: null as number | null,
      plataforma: null as number | null
  };
  
  // Estados para checkboxes del modal de "Añadir Auxiliar"
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

  // 👇 ERROR DE TYPESCRIPT CORREGIDO AQUÍ (p: any)
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
                  await invoke('guardar_asignacion_especial', {
                      asambleaId,
                      dia: formAsignacion.dia,
                      tipoAsignacion: tipoAsignacion,
                      personaId: Number(personaId)
                  });
              }
          }
          mostrarModalBloqueAsignacion = false;
          diaSeleccionado = formAsignacion.dia;
          await cargarDatos();
      } catch (e) { alert("Error: " + e); }
  }

  async function vaciarBloque(seccion: string) {
      if (!confirm(`¿Borrar todo el horario de la ${seccion}?`)) return;
      const roles = ['presidente', 'registro', 'ensayos', 'orientaciones', 'plataforma'];
      try {
          for (const rol of roles) {
              const obj = oficina.asignaciones[`${rol}_${seccion}`];
              if (obj && obj.id) await invoke('eliminar_asignacion_especial', { id: obj.id });
          }
          await cargarDatos();
      } catch(e) { alert(e); }
  }

  // --- LÓGICA AUXILIARES ---
  function abrirModalAsignar(rol: string) { 
    rolOficinaEditando = rol; 
    terminoBusqueda = "";
    personaSeleccionadaId = null;
    mostrarSugerencias = false; // Resetear sugerencias
    responsabilidades = { registro: false, ensayos: false, orientaciones: false, presidentes: false, acompañar_plataforma: false };
    disponibilidad = { viernes: false, sabado: false, domingo: false };
    mostrarModalAsignar = true; 
  }

  function cerrarModales() { 
      mostrarModalAsignar = false; 
      mostrarModalBloqueAsignacion = false;
      rolOficinaEditando = null; 
  }

  // 👇 LÓGICA AUTOCOMPLETADO
  function seleccionarHermano(h: any) {
      terminoBusqueda = h.nombre_completo;
      personaSeleccionadaId = h.id;
      mostrarSugerencias = false; // Oculta la lista al hacer clic
  }

  async function asignarHermano(oradorId: number) {
      if (!oradorId || !rolOficinaEditando) return;
      try {
          await invoke('guardar_asignacion_especial', { 
              asambleaId, dia: diaSeleccionado, tipoAsignacion: rolOficinaEditando, personaId: oradorId 
          });

          if (rolOficinaEditando === 'personal_oficina') {
              await invoke('guardar_detalles_oficina', {
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
          await invoke('eliminar_asignacion_especial', { id });
          await cargarDatos(); 
      } catch (e) { alert("Error: " + e); }
  }

  const nombreTxt = (obj: any) => obj && obj.nombre_completo ? obj.nombre_completo : "Sin asignar";
  const iniciales = (obj: any) => obj && obj.nombre_completo ? obj.nombre_completo.substring(0, 2).toUpperCase() : "-";
  
  const getHermanosFiltrados = () => !terminoBusqueda ? listaHermanos : listaHermanos.filter(h => h && h.nombre_completo && h.nombre_completo.toLowerCase().includes(terminoBusqueda.toLowerCase()));

</script>

<div class="contenedor-oficina">
    
    <div class="tabs-navegacion">
        <button class:active={tabPrincipal === 'auxiliares'} on:click={() => tabPrincipal = 'auxiliares'}>
            <Users size={18}/> Personal de oficina
        </button>
        <button class:active={tabPrincipal === 'asignaciones'} on:click={() => tabPrincipal = 'asignaciones'}>
            <Calendar size={18}/> Horario de oficina
        </button>
    </div>

    {#if tabPrincipal === 'auxiliares'}
        <div class="area-fade-in">
            <div class="header-seccion">
                <div class="textos">
                    <h2>Personal de oficina</h2>
                    <p>Presidentes de sesión, personal de oficina, orientadores y otras funciones de apoyo.</p>
                </div>
                <button class="btn-primary" on:click={() => abrirModalAsignar('personal_oficina')}>
                    <Edit2 size={16}/> Agregar persona
                </button>
            </div>

            <div class="grid-tarjetas-auxiliares">
                {#each oficina.personal as p}
                    <div class="tarjeta-personal">
                        <div class="tp-top">
                            <div class="tp-avatar">{p?.nombre_completo ? p.nombre_completo.charAt(0) : '?'}</div>
                            <div class="tp-acciones">
                                <button class="btn-icon" title="Editar"><Edit2 size={14}/></button>
                                <button class="btn-icon delete" title="Quitar" on:click={() => eliminarAsignacion(p.id)}><Trash2 size={14}/></button>
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
                            <button class="btn-contacto" on:click={() => p.telefono ? openUrl(`tel:${p.telefono}`) : alert('Sin teléfono')}>
                                <Phone size={14}/> Tel
                            </button>
                            <button class="btn-contacto" on:click={() => p.telefono ? openUrl(`https://wa.me/${p.telefono.replace(/\D/g, '')}`) : alert('Sin teléfono')}>
                                <MessageCircle size={14}/> WA
                            </button>
                            <button class="btn-contacto" on:click={() => openUrl('https://mail.jwpub.org')}>
                                <Mail size={14}/> JW Email
                            </button>
                        </div>
                    </div>
                {/each}
                {#if oficina.personal.length === 0}
                    <div class="vacio-absoluto">
                        <Users size={48} color="#cbd5e1"/>
                        <p>No hay personal registrado en la oficina.</p>
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
                    <button class="btn-outline">
                        <Download size={16}/> Exportar PDF
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
                            <button class="btn-icon delete" title="Vaciar sesión" on:click={() => vaciarBloque('manana')}><Trash2 size={16}/></button>
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
                            <button class="btn-icon delete" title="Vaciar sesión" on:click={() => vaciarBloque('tarde')}><Trash2 size={16}/></button>
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
</div>

{#if mostrarModalAsignar}
  <div class="modal-backdrop" on:click|self={cerrarModales}>
    <div class="modal modal-auxiliares">
      <div class="modal-header">
        <h3><UserPlus size={20}/> Añadir persona a la oficina</h3>
        <button class="btn-close" on:click={cerrarModales}><X size={18}/></button>
      </div>
      <div class="modal-body">
        
        <div class="seccion-selector">
          <label class="label-seccion">Buscar Hermano</label>
          <div class="buscador">
              <Search size={16}/>
              <input 
                  type="text" 
                  bind:value={terminoBusqueda} 
                  on:input={() => { mostrarSugerencias = true; personaSeleccionadaId = null; }}
                  placeholder="Escriba el nombre..."
              />
          </div>
          
          {#if mostrarSugerencias && terminoBusqueda.length > 0}
              <div class="lista-opciones">
                {#each getHermanosFiltrados() as h}
                  <button class="item-opcion" on:click={() => seleccionarHermano(h)}>
                    <div class="avatar-mini">{h.nombre_completo.charAt(0)}</div>
                    <div class="datos-opcion">
                        <span class="n">{h.nombre_completo}</span>
                        <span class="c">{h.nombre_congregacion}</span>
                    </div>
                  </button>
                {/each}
                {#if getHermanosFiltrados().length === 0}
                  <div class="item-opcion" style="justify-content:center; color:gray; cursor:default;">No se encontraron resultados</div>
                {/if}
              </div>
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
        <button class="btn-primary" disabled={!personaSeleccionadaId} on:click={() => asignarHermano(personaSeleccionadaId!)}>Agregar persona</button>
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
                            <option value={c.id}>{c.nombre_completo}</option>
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
    /* VARIABLES Y RESET */
    :root {
        --c-bg: #f8fafc;
        --c-card: #ffffff;
        --c-border: #e2e8f0;
        --c-text: #0f172a;
        --c-text-mut: #64748b;
        --c-blue: #2563eb;
        --c-blue-hover: #1d4ed8;
        --c-blue-light: #eff6ff;
        --shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .contenedor-oficina { padding: 30px 40px; height: 100%; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; font-family: system-ui, sans-serif; }
    .area-fade-in { animation: fadeIn 0.3s ease-in-out; display: flex; flex-direction: column; gap: 20px; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

    /* NAVEGACION TABS */
    .tabs-navegacion { display: flex; gap: 20px; border-bottom: 2px solid var(--c-border); margin-bottom: 10px; }
    .tabs-navegacion button {
        background: none; border: none; padding: 10px 5px; margin-bottom: -2px; border-bottom: 3px solid transparent;
        color: var(--c-text-mut); font-weight: 600; font-size: 15px; cursor: pointer; display: flex; gap: 8px; align-items: center; transition: 0.2s;
    }
    .tabs-navegacion button:hover { color: var(--c-blue); }
    .tabs-navegacion button.active { color: var(--c-blue); border-bottom-color: var(--c-blue); }

    /* BOTONES GLOBALES */
    .btn-primary { background: var(--c-blue); color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
    .btn-primary:hover:not(:disabled) { background: var(--c-blue-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-outline { background: white; color: var(--c-text); border: 1px solid var(--c-border); padding: 10px 16px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; box-shadow: var(--shadow); }
    .btn-outline:hover { background: #f1f5f9; }
    
    .btn-icon { background: none; border: none; color: var(--c-text-mut); cursor: pointer; padding: 6px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
    .btn-icon:hover { background: var(--c-blue-light); color: var(--c-blue); }
    .btn-icon.delete:hover { background: #fee2e2; color: #ef4444; }

    /* CABECERAS DE SECCIÓN */
    .header-seccion { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .header-seccion h2 { margin: 0; font-size: 22px; color: var(--c-text); font-weight: 700; }
    .header-seccion p { margin: 4px 0 0 0; color: var(--c-text-mut); font-size: 14px; }
    .textos-horario { display: flex; align-items: center; gap: 10px; }
    .acciones-derecha { display: flex; align-items: center; gap: 12px; }

    /* FILTRO DIAS */
    .filtro-dias { display: flex; background: var(--c-border); padding: 2px; border-radius: 8px; }
    .filtro-dias button { background: none; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; color: var(--c-text-mut); cursor: pointer; transition: 0.2s; }
    .filtro-dias button.active { background: white; color: var(--c-text); box-shadow: var(--shadow); }

    /* --- PESTAÑA: AUXILIARES --- */
    .grid-tarjetas-auxiliares { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .tarjeta-personal { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 10px; padding: 20px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 15px; }
    
    .tp-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .tp-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--c-blue-light); color: var(--c-blue); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; }
    .tp-acciones { display: flex; gap: 5px; }
    
    .tp-info h4 { margin: 0; font-size: 16px; color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tp-email { font-size: 13px; color: var(--c-text-mut); display: block; margin-top: 2px; }
    .tp-badges { display: flex; gap: 5px; margin-top: 10px; }
    .badge { font-size: 11px; padding: 4px 8px; border-radius: 12px; font-weight: 600; letter-spacing: 0.5px; }
    .badge.gray { background: #f1f5f9; color: #475569; }

    .tp-footer-botones { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: auto; padding-top: 15px; border-top: 1px solid var(--c-border); }
    .btn-contacto { background: none; border: none; padding: 6px; font-size: 12px; font-weight: 600; color: var(--c-text-mut); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; border-radius: 6px; transition: 0.2s; }
    .btn-contacto:hover { background: var(--c-blue-light); color: var(--c-blue); }

    .vacio-absoluto { grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: var(--c-text-mut); text-align: center; background: white; border: 1px dashed var(--c-border); border-radius: 10px; }

    /* --- PESTAÑA: HORARIOS (BLOQUES) --- */
    .grid-horarios { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    .card-horario-bloque { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 10px; box-shadow: var(--shadow); }
    .ch-header { padding: 15px 20px; border-bottom: 1px solid var(--c-border); display: flex; justify-content: space-between; align-items: center; background: #fafafa; border-radius: 10px 10px 0 0; }
    .ch-title { display: flex; align-items: center; gap: 10px; }
    .ch-title h3 { margin: 0; font-size: 16px; color: var(--c-text); }
    .ch-actions { display: flex; gap: 5px; }

    .ch-grid { display: flex; flex-direction: column; gap: 10px; padding: 15px; }
    .chip-rol { background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 8px; padding: 10px 15px; display: flex; align-items: center; gap: 15px; transition: 0.2s; }
    .chip-rol:hover { border-color: #cbd5e1; background: white; }
    
    .chip-avatar { width: 36px; height: 36px; border-radius: 50%; background: #e0f2fe; color: #1e3a8a; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; flex-shrink: 0; }
    .chip-info { display: flex; flex-direction: column; overflow: hidden; }
    .chip-label { font-size: 11px; font-weight: 700; color: var(--c-text-mut); text-transform: uppercase; margin-bottom: 2px; }
    .chip-nombre { font-size: 14px; font-weight: 600; color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chip-nombre.vacio { color: #94a3b8; font-weight: 400; font-style: italic; }

    /* --- MODALES --- */
    .modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.4); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(2px); }
    .modal { background: var(--c-card); border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column; overflow: hidden; }
    .modal-auxiliares { width: 600px; max-height: 85vh; }
    .modal-bloque { width: 450px; }
    
    .modal-header { padding: 20px; border-bottom: 1px solid var(--c-border); display: flex; justify-content: space-between; align-items: center; }
    .modal-header h3 { margin: 0; font-size: 18px; display: flex; align-items: center; gap: 10px; color: var(--c-text); }
    
    .modal-body { padding: 20px; overflow-y: auto; position: relative; }
    .modal-footer { padding: 15px 20px; border-top: 1px solid var(--c-border); display: flex; justify-content: flex-end; gap: 12px; background: #f8fafc; }
    .btn-cancelar { background: white; border: 1px solid var(--c-border); padding: 10px 16px; border-radius: 6px; font-weight: 600; color: var(--c-text); cursor: pointer; }
    .btn-cancelar:hover { background: #f1f5f9; }

    /* Modal Horarios: Formulario */
    .form-row-doble { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .form-grupo { display: flex; flex-direction: column; gap: 6px; }
    .form-grupo label { font-size: 12px; font-weight: 700; color: var(--c-text-mut); text-transform: uppercase; }
    .form-grupo select { padding: 10px; border: 1px solid var(--c-border); border-radius: 6px; background: white; font-family: inherit; font-size: 14px; outline: none; }
    .form-grupo select:focus { border-color: var(--c-blue); }

    .separador-txt { font-size: 13px; font-weight: 600; color: var(--c-text); margin-bottom: 15px; padding-bottom: 5px; border-bottom: 1px solid var(--c-border); }
    
    .lista-selects { display: flex; flex-direction: column; gap: 12px; }
    .rol-box { display: flex; justify-content: space-between; align-items: center; background: var(--c-bg); padding: 10px; border-radius: 8px; border: 1px solid var(--c-border); }
    .rol-box label { font-size: 12px; font-weight: 700; color: var(--c-text-mut); width: 35%; text-transform: uppercase; }
    .rol-box select { width: 65%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; outline: none; }

    /* Modal Auxiliares: Buscador Inteligente */
    .seccion-selector { position: relative; margin-bottom: 25px; }
    .label-seccion { display: block; font-size: 12px; font-weight: 700; color: var(--c-text-mut); text-transform: uppercase; margin-bottom: 10px; }
    .buscador { display: flex; align-items: center; gap: 10px; border: 1px solid var(--c-border); padding: 10px; border-radius: 8px; background: white; }
    .buscador input { border: none; outline: none; flex: 1; font-size: 14px; color: var(--c-text); }
    
    .lista-opciones { position: absolute; z-index: 100; width: 100%; max-height: 200px; overflow-y: auto; background: white; border: 1px solid var(--c-border); border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); margin-top: 5px; }
    .item-opcion { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 15px; background: white; border: none; border-bottom: 1px solid var(--c-border); cursor: pointer; text-align: left; transition: 0.1s; }
    .item-opcion:hover { background: var(--c-bg); }
    .avatar-mini { width: 32px; height: 32px; background: var(--c-blue); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; flex-shrink: 0; }
    .datos-opcion { display: flex; flex-direction: column; flex: 1; }
    .datos-opcion .n { font-weight: 600; font-size: 14px; color: var(--c-text); }
    .datos-opcion .c { font-size: 12px; color: var(--c-text-mut); }

    /* Modal Auxiliares: Checkboxes Blindados */
    .grid-checkboxes { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding-top: 15px; border-top: 1px solid var(--c-border); }
    .lista-checks { display: flex; flex-direction: column; gap: 8px; }
    
    .checkbox-item { display: flex; align-items: center; gap: 12px; padding: 10px 15px; background: white; border: 1px solid var(--c-border); border-radius: 8px; cursor: pointer; transition: 0.2s; }
    .checkbox-item:hover { border-color: var(--c-blue); background: var(--c-blue-light); }
    
    /* 🔴 FUERZA AL NAVEGADOR A MOSTRAR LA CAJITA SÍ O SÍ 🔴 */
    .checkbox-item input[type="checkbox"] { 
        -webkit-appearance: checkbox !important;
        appearance: checkbox !important;
        display: inline-block !important;
        width: 16px !important; 
        height: 16px !important; 
        opacity: 1 !important;
        visibility: visible !important;
        cursor: pointer; 
        margin: 0; 
        position: static !important;
    }
    .checkbox-item span { font-size: 14px; color: var(--c-text); user-select: none; }

</style>