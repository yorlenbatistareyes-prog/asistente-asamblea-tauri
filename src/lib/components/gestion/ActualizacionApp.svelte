<script lang="ts">
    import { onMount } from 'svelte';
    import { getVersion } from '@tauri-apps/api/app';
    import { DownloadCloud, Activity } from 'lucide-svelte';
    import Panel from '$lib/components/ui/Panel.svelte';
    import { verificarActualizacion, irA_Descarga, type UpdateResult } from '$lib/services/updater';
    
    // 👇 Importamos el creador de carteles nativos de Tauri
    import { ask } from '@tauri-apps/plugin-dialog';

    let versionReal = "";
    let buscandoUpdate = false;
    let updateInfo: UpdateResult | null = null;

    onMount(async () => {
        try {
            versionReal = await getVersion();
        } catch (e) {
            console.error("Error al leer la versión:", e);
            versionReal = "Desconocida";
        }
        
        buscarActualizaciones(true);
    });

    async function buscarActualizaciones(silencioso = false) {
        buscandoUpdate = true;
        const resultado = await verificarActualizacion();
        updateInfo = resultado;
        buscandoUpdate = false;
        
        // Si hay una nueva versión, SIEMPRE mostramos el cartel, sea búsqueda automática o manual
        if (resultado.hayNueva) {
           const quiereDescargar = await ask(
               `Se ha detectado una actualización para RAssembly.\n\n• Versión instalada: v${versionReal}\n• Nueva versión: v${resultado.version}\n\n¿Deseas descargarla ahora?`, 
               { 
                    title: `Actualización disponible: v${resultado.version}`, 
                    kind: 'info',
                    okLabel: 'Sí, descargar',
                    cancelLabel: 'Más tarde'
               }
       );

            // Si el usuario pulsó "Sí, descargar", ejecutamos tu función de descarga
            if (quiereDescargar) {
                await irA_Descarga();
            }
            
        } else if (!silencioso) {
            // Solo mostramos estos errores si el usuario pulsó el botón manualmente
            if (resultado.error) {
                alert(`❌ No se pudo buscar actualizaciones.\nMotivo: ${resultado.mensajeError}`);
                return;
            }
            if (!resultado.hayNueva) {
                alert("✅ ¡Estás al día! Tienes la última versión instalada.");
            }
        }
    }
</script>

<div style="display: flex; flex-direction: column; gap: 30px; padding-bottom: 20px; max-width: 800px;">
    <Panel padding="40px">
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 20px;">
            
            <div>
                <h2 style="margin: 0; font-size: 28px; color: var(--text-main); font-weight: 800; letter-spacing: -0.5px;">
                    RAssembly
                </h2>
                <p style="margin: 8px 0 0 0; color: var(--text-secondary); font-size: 15px; font-weight: 500;">
                    Asistente para Presidentes de Asamblea
                </p>
            </div>

            <div style="display: flex; gap: 12px; justify-content: center;">
                <span style="background: var(--hover-bg); color: var(--text-main); padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid var(--border);">
                    Versión {versionReal}
                </span>
                <span style="background: rgba(37, 99, 235, 0.1); color: var(--primary); padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid var(--primary);">
                    Rust + Tauri
                </span>
            </div>
            
            <div class="info-descargo">
                <p class="texto-intro">
                    Este software ha sido diseñado para simplificar la gestión de asambleas regionales, 
                    automatizando la correspondencia y la organización del programa de manera eficiente.
                </p>

                <div class="caja-legal">
                    <p><strong>Aviso importante:</strong></p>
                    <p>
                        Esta aplicación fue creada de forma independiente, con el único propósito de ser una herramienta útil para facilitar la organización de asambleas.
                    </p>
                    <p>
                        Esta <strong>NO</strong> es una aplicación oficial de los Testigos de Jehová y no está afiliada, respaldada, autorizada ni patrocinada por Watch Tower Bible and Tract Society of Pennsylvania ni por JW.ORG. Para acceder a la información, publicaciones y aplicaciones oficiales, visite siempre el sitio web oficial: <strong>jw.org</strong>.
                    </p>
                </div>
            </div>

            <div style="height: 1px; background: var(--border); width: 100%; max-width: 400px; margin: 10px 0;"></div>

            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                <button class="btn-buscar-update" on:click={() => buscarActualizaciones(false)} disabled={buscandoUpdate}>
                    {#if buscandoUpdate}
                        <Activity size={18} class="spin" /> Buscando actualizaciones...
                    {:else}
                        <DownloadCloud size={18}/> Buscar actualizaciones ahora
                    {/if}
                </button>
                
                <div style="display: flex; align-items: center; gap: 6px; color: var(--text-secondary);">
                    <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">
                        Última comprobación: Hoy
                    </span>
                </div>
            </div>
        </div>

        {#if updateInfo?.hayNueva}
            <div class="alerta-nueva-version">
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <h4 style="margin: 0; color: #10b981; font-size: 18px;">¡Nueva versión v{updateInfo.version} disponible!</h4>
                    <p style="margin: 0; font-size: 14px; color: var(--text-main);">La actualización está lista para ser descargada.</p>
                </div>
                <button class="btn-descargar-update" on:click={irA_Descarga}>
                    <DownloadCloud size={18}/> Descargar Ahora
                </button>
            </div>
        {/if}
    </Panel>
</div>

<style>
    .btn-buscar-update {
        display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 14px;
        background: var(--primary); color: white; border: none; padding: 10px 24px; 
        border-radius: 6px; font-weight: 600; cursor: pointer; transition: transform 0.2s;
    }
    .btn-buscar-update:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    .btn-buscar-update:disabled { opacity: 0.6; cursor: not-allowed; }

    .alerta-nueva-version {
        margin-top: 30px; padding: 20px; background: rgba(16, 185, 129, 0.1); 
        border: 1px solid #10b981; border-radius: 12px; display: flex; 
        justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;
    }

    .btn-descargar-update {
        background: #10b981; color: white; border: none; padding: 10px 24px; 
        border-radius: 6px; display: flex; align-items: center; gap: 8px; 
        font-size: 14px; font-weight: 600; cursor: pointer; transition: transform 0.2s;
    }
    .btn-descargar-update:hover { background: #059669; transform: translateY(-1px); }

    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* === ESTILOS DEL DESCARGO DE RESPONSABILIDAD === */
    .info-descargo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        width: 100%;
        max-width: 600px;
        margin: 10px 0;
    }

    .texto-intro {
        color: var(--text-secondary); 
        font-size: 14px; 
        line-height: 1.6; 
        margin: 0;
        text-align: center;
    }

    .caja-legal {
        background: rgba(0, 0, 0, 0.03); /* Fondo gris súper suave */
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        font-size: 13px;
        text-align: left;
        color: var(--text-secondary);
        line-height: 1.6;
    }

    /* Soporte para modo oscuro */
    :global(.dark-theme) .caja-legal {
        background: rgba(255, 255, 255, 0.03);
    }

    .caja-legal p {
        margin: 0 0 12px 0;
    }
    
    .caja-legal p:last-child {
        margin-bottom: 0;
    }
    
    .caja-legal strong {
        color: var(--text-main); /* Hace que las palabras clave destaquen un poco más */
    }
</style>