<script lang="ts">
    import { ChevronLeft, ChevronRight, Info } from 'lucide-svelte';
    import { createEventDispatcher } from 'svelte';

    // Propiedades que exportamos para conectarlas con el formulario principal
    export let fechaInicio: Date | null = null;
    export let fechaFin: Date | null = null;

    const dispatch = createEventDispatcher();

    // Estado del calendario (meses a mostrar)
    let fechaReferencia = new Date();
    fechaReferencia.setDate(1);
    fechaReferencia.setHours(0, 0, 0, 0);

    // Reactividad para los dos meses
    $: mesIzq = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
    $: mesDer = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() + 1, 1);

    const diasSemana = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

    // Motor para generar los días del mes exactos
    function obtenerDiasMes(fecha: Date) {
        const year = fecha.getFullYear();
        const month = fecha.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let dias: (Date | null)[] = [];
        for (let i = 0; i < firstDay; i++) dias.push(null); // Espacios vacíos
        for (let i = 1; i <= daysInMonth; i++) dias.push(new Date(year, month, i)); // Días reales
        return dias;
    }

    $: diasIzq = obtenerDiasMes(mesIzq);
    $: diasDer = obtenerDiasMes(mesDer);

    // Funciones de navegación
    function avanzarMes() {
        fechaReferencia = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() + 1, 1);
    }
    function retrocederMes() {
        fechaReferencia = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth() - 1, 1);
    }

    // Efecto hover para la franja azul
    let hoverDate: Date | null = null;

    // Lógica de selección profesional
    function seleccionarFecha(dia: Date | null) {
        if (!dia) return;

        if (!fechaInicio || (fechaInicio && fechaFin)) {
            // Empezar nueva selección
            fechaInicio = dia;
            fechaFin = null;
        } else if (dia < fechaInicio) {
            // Si elige una fecha anterior al inicio, se convierte en el nuevo inicio
            fechaInicio = dia;
        } else {
            // Cierra el rango
            fechaFin = dia;
        }
    }

    // Asignación de estilos dinámicos (Azul fuerte o franja)
    function obtenerClaseDia(dia: Date | null) {
        if (!dia) return 'dia-vacio';

        const t = dia.getTime();
        const i = fechaInicio?.getTime();
        const f = fechaFin?.getTime();
        const h = hoverDate?.getTime();

        let clases = 'dia-btn ';

        if (i === t || f === t) {
            clases += 'seleccionado '; // Azul fuerte
        } else if (i && f && t > i && t < f) {
            clases += 'en-rango '; // Azul claro intermedio
        } else if (i && !f && h && t > i && t <= h) {
            clases += 'en-rango '; // Azul claro al pasar el ratón
        }

        return clases;
    }

    function formatearFechaLarga(fecha: Date | null) {
        if (!fecha) return 'Seleccione fecha...';
        return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(fecha);
    }

    // --- ACCIONES DE LOS NUEVOS BOTONES ---
    function limpiarFechas() {
        fechaInicio = null;
        fechaFin = null;
        dispatch('cancelar');
    }

    function confirmarSeleccion() {
        if (fechaInicio && fechaFin) {
            // Avisa al componente padre (modal) que la selección está lista
            dispatch('seleccionar', { inicio: fechaInicio, fin: fechaFin });
        }
    }
</script>

<div class="calendario-contenedor">
    <div class="header-nav">
        <button type="button" class="btn-nav" on:click={retrocederMes}><ChevronLeft size={20}/></button>
        
        <div class="meses-wrapper">
            <div class="mes">
                <div class="titulo-mes">
                    {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(mesIzq)}
                </div>
                <div class="grid-calendario">
                    {#each diasSemana as ds}<div class="header-dia">{ds}</div>{/each}
                    {#each diasIzq as dia}
                        {#if dia}
                            <button type="button" class={obtenerClaseDia(dia)}
                                on:click={() => seleccionarFecha(dia)}
                                on:mouseenter={() => hoverDate = dia}
                                on:mouseleave={() => hoverDate = null}
                            >
                                {dia.getDate()}
                            </button>
                        {:else}
                            <div class="dia-vacio"></div>
                        {/if}
                    {/each}
                </div>
            </div>

            <div class="separador"></div>

            <div class="mes">
                <div class="titulo-mes">
                    {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(mesDer)}
                </div>
                <div class="grid-calendario">
                    {#each diasSemana as ds}<div class="header-dia">{ds}</div>{/each}
                    {#each diasDer as dia}
                        {#if dia}
                            <button type="button" class={obtenerClaseDia(dia)}
                                on:click={() => seleccionarFecha(dia)}
                                on:mouseenter={() => hoverDate = dia}
                                on:mouseleave={() => hoverDate = null}
                            >
                                {dia.getDate()}
                            </button>
                        {:else}
                            <div class="dia-vacio"></div>
                        {/if}
                    {/each}
                </div>
            </div>
        </div>

        <button type="button" class="btn-nav" on:click={avanzarMes}><ChevronRight size={20}/></button>
    </div>

    <div class="footer-fechas">
        <div class="caja-fecha">
            <span class="etiqueta">Inicio:</span>
            <span class="valor">{formatearFechaLarga(fechaInicio)}</span>
        </div>
        <div class="linea-conexion"></div>
        <div class="caja-fecha">
            <span class="etiqueta">Fin:</span>
            <span class="valor">{formatearFechaLarga(fechaFin)}</span>
        </div>
    </div>

    <div class="footer-acciones">
        <div class="botones-accion">
            <button type="button" class="btn-cancelar" on:click={limpiarFechas}>Cancelar</button>
            <button 
                type="button" 
                class="btn-seleccionar" 
                on:click={confirmarSeleccion} 
                disabled={!fechaInicio || !fechaFin}
            >
                Seleccionar
            </button>
        </div>
    </div>
</div>

<style>
    .calendario-contenedor {
        background: white; border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 20px;
    }
    
    .header-nav { display: flex; justify-content: space-between; align-items: flex-start; }
    
    .btn-nav {
        background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center; cursor: pointer; color: #4b5563; transition: 0.2s;
    }
    .btn-nav:hover { background: #e5e7eb; color: #111827; }

    .meses-wrapper { display: flex; gap: 25px; flex: 1; justify-content: center; }
    .mes { display: flex; flex-direction: column; gap: 15px; width: 260px; }
    .separador { width: 1px; background: #e5e7eb; }

    .titulo-mes { text-align: center; font-weight: 700; font-size: 15px; color: #1f2937; text-transform: capitalize; }
    
    .grid-calendario { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px 0; }
    
    .header-dia { font-size: 12px; font-weight: 700; color: #6b7280; text-align: center; margin-bottom: 8px; }
    
    .dia-btn {
        background: transparent; border: none; width: 100%; height: 34px; font-size: 14px; color: #374151;
        cursor: pointer; transition: 0.1s; display: flex; align-items: center; justify-content: center; border-radius: 50%;
    }
    .dia-btn:hover { background: #f3f4f6; }
    .dia-vacio { width: 100%; height: 34px; }

    /* ESTILOS DE SELECCIÓN VITALES */
    .dia-btn.seleccionado { background: #2563eb !important; color: white !important; font-weight: bold; }
    .dia-btn.en-rango { background: #eff6ff; border-radius: 0; color: #1d4ed8; }

    .footer-fechas { display: flex; align-items: center; justify-content: center; gap: 15px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    
    .caja-fecha {
        border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 15px; width: 240px;
        background: #f9fafb; display: flex; flex-direction: column; gap: 2px;
    }
    .etiqueta { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
    .valor { font-size: 13px; font-weight: 500; color: #111827; text-transform: capitalize; }
    .linea-conexion { width: 15px; height: 2px; background: #d1d5db; }

    /* === ESTILOS DEL NUEVO FOOTER DE ACCIONES === */
    .footer-acciones {
        display: flex;
        flex-direction: column;
        gap: 15px;
        margin-top: 5px;
    }
    
    .info-texto {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #4b5563;
    }
    
    :global(.icono-info) {
        color: #2563eb; /* Color azul para el ícono */
    }
    
    .botones-accion {
        display: flex;
        gap: 10px;
    }
    
    .btn-cancelar {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        padding: 10px 16px;
        border-radius: 4px;
        color: #374151;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
    }
    .btn-cancelar:hover { background: #e5e7eb; }
    
    .btn-seleccionar {
        background: #32588e; /* Ajustado al tono azul oscuro de tu imagen */
        border: none;
        padding: 10px 24px;
        border-radius: 4px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
    }
    .btn-seleccionar:hover:not(:disabled) { background: #23416b; }
    .btn-seleccionar:disabled { background: #9ca3af; cursor: not-allowed; opacity: 0.7; }

    /* =========================================================
   DISEÑO RESPONSIVO (CALENDARIO RANGO: WINDOWS + ANDROID)
   ========================================================= */

@media (max-width: 768px) {
    /* 1. EL CONTENEDOR SE VUELVE FLEXIBLE */
    .calendario-contenedor {
        width: 95vw !important;
        max-width: 360px;
        padding: 15px;
        margin: 0 auto;
        max-height: 90vh;
        overflow-y: auto; /* Permitimos scroll si la pantalla es muy pequeña */
    }

    /* 2. HEADER DE NAVEGACIÓN */
    .header-nav {
        margin-bottom: 10px;
    }

    /* 3. APILADO DE MESES (De horizontal a vertical) */
    .meses-wrapper {
        flex-direction: column; /* Un mes arriba del otro */
        gap: 20px;
        align-items: center;
    }

    .mes {
        width: 100%; /* El mes ocupa todo el ancho disponible */
    }

    .separador {
        width: 100%;
        height: 1px; /* El separador ahora es una línea horizontal */
        margin: 5px 0;
    }

    /* 4. AJUSTE DE DÍAS (Más grandes para el dedo) */
    .grid-calendario {
        gap: 6px 2px;
    }

    .dia-btn {
        height: 40px; /* Área de toque más cómoda */
        font-size: 15px;
    }

    /* 5. FOOTER DE FECHAS SELECCIONADAS */
    .footer-fechas {
        flex-direction: column; /* Inicio arriba, Fin abajo */
        gap: 10px;
        padding-top: 15px;
    }

    .caja-fecha {
        width: 100%; /* Ocupan todo el ancho */
        padding: 8px 12px;
    }

    .linea-conexion {
        display: none; /* Quitamos la línea pequeña en móvil */
    }

    /* 6. BOTONES DE ACCIÓN GIGANTES */
    .footer-acciones {
        margin-top: 15px;
    }

    .botones-accion {
        flex-direction: column-reverse; /* "Seleccionar" arriba, "Cancelar" abajo */
        width: 100%;
        gap: 10px;
    }

    .btn-cancelar, .btn-seleccionar {
        width: 100%;
        height: 48px; /* Altura estándar para dedos en Android */
        font-size: 16px;
        justify-content: center;
    }
}

</style>