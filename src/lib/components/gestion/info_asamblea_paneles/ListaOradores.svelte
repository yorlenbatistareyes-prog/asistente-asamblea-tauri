<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
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
              // 1. SI EL ORADOR ES NUEVO EN EL BUCLE
              oradoresMap.set(nombre, {
                persona_id: parte.orador_id,
                nombre: nombre,
                congregacion: parte.congregacion_orador || '---',
                circuito: parte.circuito_orador || '---', 
                telefono: parte.telefono_orador || '',
                email: parte.email_orador || '',
                es_betelita: parte.es_betelita || false,  
                es_interprete: parte.es_interprete || false,
                es_visitante: parte.es_visitante || false,
                recordatorio_texto: '',
                recordatorio_fecha: '',
                // 👇 NUEVO: Aquí guardamos su primer discurso completo
                discursos: [{
                  id: parte.id,
                  numero: parte.numero_bosquejo || '--',
                  tema: parte.tema || 'Sin tema',
                  dia: dia,
                  confirmado: parte.estado === 'Confirmado'
                }]
              });
            } else {
              // 2. SI EL ORADOR YA EXISTE EN EL BUCLE (Tiene más de un discurso)
              const oradorExistente = oradoresMap.get(nombre);
              
              // 👇 NUEVO: Añadimos este nuevo discurso a su lista personal
              oradorExistente.discursos.push({
                id: parte.id,
                numero: parte.numero_bosquejo || '--',
                tema: parte.tema || 'Sin tema',
                dia: dia,
                confirmado: parte.estado === 'Confirmado'
              });
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
  async function obtenerUrlWhatsAppLista(orador: any): Promise<{ nativeUrl: string, webUrl: string } | null> {
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

    return {
        nativeUrl: `whatsapp://send?phone=${telWa}&text=${encodeURIComponent(mensaje)}`,
        webUrl: `https://wa.me/${telWa}?text=${encodeURIComponent(mensaje)}`
    };
  }

  async function accionContacto(tipo: string, orador: any) {
    const email = orador.email?.trim();
    const tel = orador.telefono?.trim();

    try {
      switch (tipo) {
        case 'email':
          if (!email) return alert("No hay correo registrado");
          await openUrl(`mailto:${email}`);
          break;
        case 'jwpub':
          const urlJwpub = await obtenerUrlCorreoLista(orador);
          if (urlJwpub) await openUrl(urlJwpub);
          break;
        case 'llamada':
          if (!tel) return alert("No hay teléfono registrado");
          await openUrl(`tel:${formatearTelCuba(tel)}`);
          break;
        case 'sms':
          if (!tel) return alert("No hay teléfono registrado");
          await openUrl(`sms:${formatearTelCuba(tel)}`);
          break;
        case 'whatsapp':
          const urlsWa = await obtenerUrlWhatsAppLista(orador);
          if (urlsWa) {
              try {
                  // Intento 1: Nativo
                  await openUrl(urlsWa.nativeUrl);
              } catch (e) {
                  console.warn("App nativa no encontrada, fallback web:", e);
                  try {
                      // Intento 2: Web
                      await openUrl(urlsWa.webUrl);
                  } catch (err) {
                      console.error("No se pudo abrir WhatsApp:", err);
                      alert("Error al abrir WhatsApp.");
                  }
              }
          }
          break;
      }
    } catch (e) {
      console.error(`Error al procesar ${tipo}:`, e);
    }
  }

  async function toggleDiscursoEspecifico(discurso: any) {
    const nuevoEstado = !discurso.confirmado;
    
    // 1. Actualización visual inmediata en Svelte
    discurso.confirmado = nuevoEstado;
    oradores = [...oradores]; 

    try {
      // 2. Enviamos a la base de datos el ID de ESTE discurso específico
      await invoke('alternar_estado_parte', {
        id: discurso.id,
        tipoAccion: 'confirmacion',
        valorNuevo: nuevoEstado
      });
    } catch (e) {
      console.error("Error al guardar CO-11 individual:", e);
      alert("Error al guardar en la base de datos: " + e);
      
      // 3. Si falla la conexión, revertimos el check visualmente
      discurso.confirmado = !nuevoEstado;
      oradores = [...oradores];
    }
  }

  // En el script de ListaOradores.svelte
async function guardarRecordatorio(orador: any) {

  const idPersona = Number(orador.persona_id);
  
  if (isNaN(idPersona) || idPersona <= 0) {
    alert("❌ Error: ID de orador inválido (" + orador.persona_id + ")");
    return;
  }

    try {
      await invoke('guardar_nota_directa', {
        asambleaId: asambleaId, 
        id: Number(orador.persona_id), // 👈 Ahora sí enviará el ID real, ej: 45
        nota: orador.recordatorio_texto || ""
      });
      alert("✅ Nota guardada correctamente.");
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
        <div class="tarjeta-orador" 
     class:estado-pendiente={orador.discursos.some((d: any) => !d.confirmado)} 
     class:estado-recibido={orador.discursos.every((d: any) => d.confirmado)}>
          
          <div class="tarjeta-header">
            <div class="header-izq">
              <h2>{orador.nombre}</h2>
              <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                
               {#if orador.discursos.some((d: any) => !d.confirmado)}
                  <span class="badge-alerta">CO-11 needed</span>
               {/if}

               {#if orador.discursos.every((d: any) => d.confirmado)}
                  <span class="badge-exito">CO-11 received</span>
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
              <button class="btn-icon-simple"><Edit2 size={16}/></button>
            </div>
          </div>

          <div class="seccion-discursos-orador">
            <span class="dato-lbl">Confirmación de Discursos (CO-11)</span>
            <div class="lista-discursos-check">
              {#each orador.discursos as discurso}
                <label class="check-co11-individual">
                  <input 
                    type="checkbox" 
                    checked={discurso.confirmado} 
                    on:change={() => toggleDiscursoEspecifico(discurso)} 
                  />
                  <div class="detalles-discurso-check" style="display: flex; flex-direction: column; gap: 4px; margin-top: 2px;">
                     <span class="badge-dia" style="width: fit-content;">{discurso.dia}</span>
  
                     <div style="display: flex; gap: 6px; align-items: baseline;">
                         <span class="numero-discurso-simple">{discurso.numero}.</span>
                         <p class="tema-check" style="margin: 0;">"{discurso.tema}"</p>
                     </div>
                  </div>
                </label>
              {/each}
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
            <span class="dato-lbl">Notas</span>
            <div class="recordatorio-inputs">
              <textarea placeholder="Agregue una nota para este orador." bind:value={orador.recordatorio_texto}></textarea>
              
              <div class="controles-rec">
                <button 
                  class="btn-guardar-rec" 
                  disabled={!orador.recordatorio_texto || orador.recordatorio_texto.trim() === ''}
                  on:click={() => guardarRecordatorio(orador)}
                >
                  Guardar nota
                </button>
              </div>
            </div>
          </div>

        </div>
      {/each}
    </div>
  </div>
</div>

<style>
 /* =======================================
   ESTRUCTURA PRINCIPAL
   ======================================= */
.vista-programa-container {
  background-color: var(--bg-body);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 30px 40px 0 40px;
  overflow: hidden;
}

.top-fijo { flex-shrink: 0; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
.header-vista h1 { font-size: 26px; font-weight: 800; color: var(--text-main); margin: 0 0 5px 0; }
.subtitle { font-size: 14px; color: var(--text-sec); margin: 0; }
.controles-vista { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
.conteo-oradores { font-size: 14px; color: var(--text-sec); font-weight: 500; }

.btn-pdf { 
  background-color: var(--primary); color: #ffffff; border: none; 
  padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; 
  cursor: pointer; transition: background 0.2s; 
}
.btn-pdf:hover { background-color: var(--primary-hover); }

.contenido-programa { flex: 1; overflow-y: auto; padding-right: 15px; padding-bottom: 40px; }
.contenido-programa::-webkit-scrollbar { width: 8px; }
.contenido-programa::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }

.lista-tarjetas { display: flex; flex-direction: column; gap: 20px; margin-top: 10px; }

/* =======================================
   TARJETA DE ORADOR (DISEÑO RENOVADO)
   ======================================= */
.tarjeta-orador {
  border-radius: 14px; /* Bordes un poco más curvos y modernos */
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--border);
  position: relative;
  overflow: hidden;
  
  /* Sombra elegante para dar volumen */
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.03);
}

/* 🟠 ESTADO PENDIENTE: Tono ambar/arena cálido y llamativo */
.tarjeta-orador.estado-pendiente {
  border-left: 6px solid #f59e0b; /* Línea izquierda naranja vibrante */
  background: linear-gradient(145deg, #fffbeb 0%, #fff7ed 100%); /* Fondo cálido suave */
  border-color: #fde68a; /* Borde sutil amarillento */
}

/* 🟢 ESTADO RECIBIDO: Tono menta/esmeralda fresco y limpio */
.tarjeta-orador.estado-recibido {
  border-left: 6px solid #10b981; /* Línea izquierda verde éxito */
  background: linear-gradient(145deg, #f0fdf4 0%, #ecfdf5 100%); /* Fondo verde pastel */
  border-color: #bbf7d0; /* Borde sutil verdoso */
}

/*Efecto al pasar el mouse (Efecto de flotado Premium) */
.tarjeta-orador:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 25px rgba(0, 0, 0, 0.08);
}

/* 👇 MEJORA EXTRA: Ajuste para la sección interna de discursos 
   para que resalte bien sobre los nuevos fondos de las tarjetas */
.seccion-discursos-orador {
  background: rgba(255, 255, 255, 0.6); /* Fondo semi-transparente blanco */
  backdrop-filter: blur(4px);
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 16px;
  margin-top: 15px;
  margin-bottom: 20px;
}

/* Compatibilidad con Tema Oscuro (Opcional) */
:global(.dark-theme) .tarjeta-orador.estado-pendiente {
  background: linear-gradient(145deg, #2d2006, #1e1503);
  border-color: #78350f;
}
:global(.dark-theme) .tarjeta-orador.estado-recibido {
  background: linear-gradient(145deg, #062f21, #022c1e);
  border-color: #065f46;
}
:global(.dark-theme) .seccion-discursos-orador {
  background: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.1);
}

.tarjeta-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
.header-izq { display: flex; align-items: center; gap: 12px; }
.header-izq h2 { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main); }

.badge-alerta { 
  background-color: var(--accent-danger); color: white; 
  padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; 
}

/* REPARACIÓN DEL CHECKBOX CO-11 */
.check-co11 { 
  display: flex; align-items: center; gap: 8px; cursor: pointer; 
  font-size: 13px; color: var(--text-main); font-weight: 500; 
}
.check-co11 input { 
  width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary);
  display: inline-block !important; appearance: auto !important;
}

.btn-icon-simple { background: transparent; border: none; color: var(--text-sec); cursor: pointer; padding: 4px; }
.btn-icon-simple:hover { color: var(--text-main); }

/* BOTONES CIRCULARES */
.acciones-circulares { display: flex; gap: 10px; margin-bottom: 25px; }
.btn-circle {
  width: 36px; height: 36px; border-radius: 50%;
  background-color: var(--bg-body); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-sec); cursor: pointer; transition: all 0.2s;
}
.btn-circle:hover { color: var(--primary); border-color: var(--primary); transform: translateY(-2px); }

/* DATOS */
.grid-datos { display: grid; grid-template-columns: 1fr 1fr; row-gap: 15px; column-gap: 20px; margin-bottom: 25px; }
.dato-lbl { font-size: 12px; font-weight: 700; color: var(--text-main); display: block; }
.dato-val { font-size: 13px; color: var(--text-sec); }
.dato-val.highlight { color: var(--primary); font-weight: 500; }

/* RECORDATORIOS */
.recordatorio-zona { display: flex; flex-direction: column; gap: 8px; }
.recordatorio-inputs { 
  display: flex; 
  flex-direction: column; /* Cambiamos a columna para que el botón quede abajo ordenadamente */
  gap: 10px; 
  align-items: stretch; 
}

.controles-rec {
  display: flex;
  justify-content: flex-end; /* Empuja el botón a la derecha de la tarjeta */
}
.recordatorio-inputs textarea {
  flex: 1; padding: 12px; border: 1px solid var(--border); border-radius: 8px;
  font-size: 13px; font-family: inherit; resize: vertical; background: var(--input-bg); color: var(--text-main);
}
.input-fecha-rec { 
  width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; 
  background: var(--input-bg); color: var(--text-main); height: 38px;
}
.btn-guardar-rec { 
  background-color: var(--border); 
  color: var(--text-sec); 
  border: none; 
  border-radius: 6px; 
  font-weight: 600; 
  font-size: 12.5px; 
  height: 38px; 
  padding: 0 16px; /* Le damos aire a los lados del botón */
  cursor: not-allowed;
  transition: background-color 0.2s, color 0.2s;
}

.btn-guardar-rec:not(:disabled) { 
  background-color: var(--primary); 
  color: white; 
  cursor: pointer; 
}
/* RESPONSIVO */
@media (max-width: 768px) {
  .vista-programa-container { padding: 15px; }
  .grid-datos { grid-template-columns: 1fr; }
  .recordatorio-inputs { flex-direction: column; }
}

/* =======================================
   NUEVA SECCIÓN DE DISCURSOS INDIVIDUALES
   ======================================= */
.seccion-discursos-orador {
  background: var(--bg-body);
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
}

.lista-discursos-check {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}

.check-co11-individual {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  background: var(--bg-card);
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  transition: border-color 0.2s;
}

.check-co11-individual:hover {
  border-color: var(--primary);
}

.check-co11-individual input {
  margin-top: 4px; 
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--primary);
  /* 🔥 ESTAS DOS LÍNEAS FUERZAN A QUE LA CAJITA APAREZCA SÍ O SÍ 🔥 */
  appearance: auto !important; 
  display: inline-block !important;
}

.detalles-discurso-check {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tema-check {
  margin: 0;
  font-size: 13px;
  color: var(--text-main);
  font-weight: 500;
  line-height: 1.3;
}

.numero-discurso-simple {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-main); /* Usa el mismo color del texto principal */
}
</style>