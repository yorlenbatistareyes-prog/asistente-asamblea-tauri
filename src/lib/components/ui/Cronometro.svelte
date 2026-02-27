<script lang="ts">
    import { onDestroy } from 'svelte';
    import { slide } from 'svelte/transition';
    import { Play, Pause, TimerReset, Timer, Minus, Plus, Minimize2 } from 'lucide-svelte';

    import { cronometro } from '$lib/stores/cronometro'; // Asegúrate de que la ruta sea correcta
    
    // --- ESTADO ---
    let abierto = false;
    let corriendo = false;
    let minutosAsignados = 15; 
    let segundosTranscurridos = 0;
    let intervalo: any;

    // --- TAMAÑO DE LA BARRA ---
    let nivelTamano = 1; // 0: Pequeño (S), 1: Mediano (M), 2: Grande (L)
    const clasesTamano = ['tamano-s', 'tamano-m', 'tamano-l'];
    
    function cambiarTamano() {
        nivelTamano = (nivelTamano + 1) % 3;
    }

    // --- LÓGICA Y CONTROLES (CORREGIDOS Y BLINDADOS) ---
    function togglePlay() { 
        corriendo = !corriendo; 
        if (corriendo) {
            // Arranca el reloj
            intervalo = setInterval(() => segundosTranscurridos += 1, 1000);
        } else {
            // Pausa el reloj
            clearInterval(intervalo);
            intervalo = null;
        }
    }

    function reiniciar() { 
        // 1. Apagamos el motor instantáneamente
        if (intervalo) {
            clearInterval(intervalo);
            intervalo = null;
        }
        // 2. Reiniciamos los valores
        corriendo = false; 
        segundosTranscurridos = 0; 
    }

    function togglePanel() { abierto = !abierto; }
    
    // Matemática corregida
    function setTiempo(min: number) { minutosAsignados = Number(min); }
    function sumarMinuto() { minutosAsignados = Number(minutosAsignados) + 1; }
    function restarMinuto() { if (Number(minutosAsignados) > 1) minutosAsignados = Number(minutosAsignados) - 1; }

    onDestroy(() => {
        if (intervalo) clearInterval(intervalo);
    });

    // --- FORMATO ---
    $: min = Math.floor(segundosTranscurridos / 60);
    $: seg = segundosTranscurridos % 60;
    $: tiempoFormateado = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
    $: tiempoLimite = minutosAsignados * 60;
    $: sePaso = segundosTranscurridos > tiempoLimite;

    // --- LÓGICA DE ARRASTRE (DRAG & DROP) ---
    let posicionX = 0;
    let posicionY = 0;
    let moviendo = false;
    let inicioX = 0;
    let inicioY = 0;

    function iniciarArrastre(e: MouseEvent) {
        moviendo = true;
        // Calculamos la diferencia entre donde hacemos clic y dónde está la barra
        inicioX = e.clientX - posicionX;
        inicioY = e.clientY - posicionY;
        
        window.addEventListener('mousemove', arrastrar);
        window.addEventListener('mouseup', detenerArrastre);
    }

    function arrastrar(e: MouseEvent) {
        if (moviendo) {
            posicionX = e.clientX - inicioX;
            posicionY = e.clientY - inicioY;
        }
    }

    function detenerArrastre() {
        moviendo = false;
        window.removeEventListener('mousemove', arrastrar);
        window.removeEventListener('mouseup', detenerArrastre);
    }

</script>

<div class="cronometro-wrapper {abierto ? 'modo-barra-top' : 'modo-boton-esquina'} {moviendo ? 'arrastrando' : ''}"
     style={abierto ? `transform: translate(calc(-50% + ${posicionX}px), ${posicionY}px);` : ''}>
    
    {#if abierto}
        <div class="top-bar-panel {clasesTamano[nivelTamano]} {sePaso ? 'peligro-glow' : ''}" transition:slide|local={{ duration: 300, axis: 'y' }}>
            
            <div class="left-section">
                <div class="drag-handle" on:mousedown={iniciarArrastre} title="Arrastrar barra">
                    <Timer size={18} />
                </div>
                <span class="bar-title">Cronómetro</span>
                
                <button class="btn-size" on:click={cambiarTamano} title="Cambiar tamaño de la barra">
                    {nivelTamano === 0 ? 'S' : nivelTamano === 1 ? 'M' : 'L'}
                </button>
            </div>

           <div class="center-section">
                
                <span class="main-display {sePaso ? 'texto-rojo-neon' : ''}">
                    {tiempoFormateado}
                </span>

                <div class="minute-adjuster">
                    <button class="btn-mini-adjust" on:click={restarMinuto}><Minus size={14}/></button>
                    
                    <select class="select-compacto" bind:value={minutosAsignados} title="Elegir tiempo">
                        {#if ![5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].includes(Number(minutosAsignados))}
                            <option value={Number(minutosAsignados)} hidden>{minutosAsignados} min</option>
                        {/if}

                        {#each [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60] as t}
                            <option value={t}>{t} min</option>
                        {/each}
                    </select>

                    <button class="btn-mini-adjust" on:click={sumarMinuto}><Plus size={14}/></button>
                </div>

            </div>

            <div class="right-section controls">
                <button class="btn-ctrl reset" on:click={reiniciar} title="Reiniciar">
                    <TimerReset size={20}/>
                </button>
                
                <button class="btn-ctrl play-pause {corriendo ? 'pausa' : 'play'}" on:click={togglePlay}>
                    {#if corriendo} <Pause size={24} fill="white"/> {:else} <Play size={24} fill="white" style="margin-left:2px;"/> {/if}
                </button>

                <button class="btn-ctrl close" on:click={togglePanel} title="Minimizar">
                    <Minimize2 size={20}/>
                </button>
            </div>
        </div>
    {:else}
        <button class="btn-flotante {corriendo ? 'animando' : ''} {sePaso ? 'peligro' : ''}" on:click={togglePanel}>
            <Timer size={26}/> {#if corriendo}
                <span class="mini-tiempo">{tiempoFormateado}</span>
            {/if}
        </button>
    {/if}
</div>

<style>
 /* --- POSICIONAMIENTO DEL CONTENEDOR --- */
    .cronometro-wrapper {
        position: fixed;
        z-index: 9999;
        transition: all 0.3s ease;
    }

    /* Posición cuando está cerrado: Esquina Inferior Izquierda */
    .modo-boton-esquina {
        bottom: 25px;
        left: 25px;
    }

    /* Posición cuando está abierto: Arriba al Centro */
    .modo-barra-top {
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: auto;
    }


    /* === ESTILOS DE LA BARRA SUPERIOR OSCURA === */
    .top-bar-panel {
        background: linear-gradient(145deg, #1e3a8a, #2563eb); 
        color: white;
        padding: 8px 20px;
        border-radius: 50px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        gap: 25px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        white-space: nowrap;
        transform-origin: top center; 
    }

    /* Escalas de tamaño exactas (S ahora es diminuta) */
    .tamano-s { transform: scale(0.60); }
    .tamano-m { transform: scale(0.85); }
    .tamano-l { transform: scale(1.10); }

    /* Estilo del botón de tamaño */
    .btn-size {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 6px;
        width: 24px;
        height: 24px;
        font-size: 11px;
        font-weight: 800;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 8px;
        transition: all 0.2s;
    }
    .btn-size:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
    }

    /* Brillo rojo si se pasa el tiempo */
    .top-bar-panel.peligro-glow {
        box-shadow: 0 10px 25px rgba(239, 68, 68, 0.4), inset 0 0 15px rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.5);
    }

    /* Secciones internas */
    .left-section, .center-section, .right-section { display: flex; align-items: center; }
    .left-section { gap: 10px; opacity: 0.8; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 15px; }
    .center-section { gap: 20px; flex: 1; justify-content: center; }
    .right-section { gap: 10px; padding-left: 15px; border-left: 1px solid rgba(255,255,255,0.1); }
    
    .bar-title { font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Display Central Rediseñado (Más compacto) */
    .main-display {
        font-size: 32px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .main-display.texto-rojo-neon {
        color: #ff6b6b;
        text-shadow: 0 0 10px rgba(255, 107, 107, 0.6);
    }

    /* === Ajuste de Minutos Compacto con Dropdown === */
    .minute-adjuster { 
        display: flex; align-items: center; gap: 4px; 
        background: rgba(0,0,0,0.25); padding: 4px 6px; 
        border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);
    }
    .btn-mini-adjust { 
        background: transparent; border: none; color: white; border-radius: 50%; 
        width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; 
        cursor: pointer; transition: background 0.2s;
    }
    .btn-mini-adjust:hover { background: rgba(255,255,255,0.2); }

    /* Estilo del Dropdown Integrado */
    .select-compacto {
        background: transparent;
        color: white;
        border: none;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
        outline: none;
        padding: 0 2px;
        appearance: none;
    }
    .select-compacto option {
        background: #1e3a8a;
        color: white;
    }

    /* Controles de Reproducción */
    .btn-ctrl { border: none; cursor: pointer; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: white; }
    .btn-ctrl.reset, .btn-ctrl.close { width: 36px; height: 36px; background: rgba(255,255,255,0.1); }
    .btn-ctrl.reset:hover, .btn-ctrl.close:hover { background: rgba(255,255,255,0.25); transform: scale(1.05); }
    
    .btn-ctrl.play-pause { width: 48px; height: 48px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
    .btn-ctrl.play { background: linear-gradient(135deg, #10b981, #059669); }
    .btn-ctrl.pausa { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .btn-ctrl.play-pause:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }

    /* === ESTILOS DEL BOTÓN FLOTANTE (ESQUINA) === */
    .btn-flotante {
        width: 60px; height: 60px; border-radius: 50%;
        background: linear-gradient(145deg, #1e3a8a, #3b82f6); 
        color: white; border: none; cursor: pointer; 
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        box-shadow: 0 6px 20px rgba(30, 58, 138, 0.4); 
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .btn-flotante:hover { transform: scale(1.1) translateY(-5px); }
    .btn-flotante.peligro { background: linear-gradient(145deg, #991b1b, #ef4444); box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5); }
    .btn-flotante.animando { animation: pulse-blue 2s infinite; }
    .btn-flotante.animando.peligro { animation: pulse-red 2s infinite; }
    .mini-tiempo { font-size: 11px; font-weight: 700; margin-top: 2px; }

    @keyframes pulse-blue { 0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.7); } 70% { box-shadow: 0 0 0 20px rgba(59,130,246,0); } 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); } }
    @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); } 70% { box-shadow: 0 0 0 20px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }

    /* --- ESTILOS PARA EL ARRASTRE (DRAG & DROP) --- */
    
    /* Esta clase desactiva la animación suave SOLO mientras arrastras para evitar retrasos ("lag") */
    .arrastrando {
        transition: none !important;
    }

    /* Estilo para la "manija" de arrastre (el icono del cronómetro) */
    .drag-handle {
        cursor: grab; /* Cursor de mano abierta */
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 5px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
        transition: background 0.2s;
    }
    
    .drag-handle:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    .drag-handle:active {
        cursor: grabbing; /* Cursor de mano cerrada apretando */
        background: rgba(255, 255, 255, 0.3);
    }

/* =========================================================
   DISEÑO RESPONSIVO (CRONÓMETRO: WINDOWS + ANDROID)
   ========================================================= */

@media (max-width: 768px) {
    /* 1. POSICIONAMIENTO: Evitamos que flote en el medio */
    .modo-barra-top {
        top: 10px;
        left: 50%;
        width: 95vw;
        transform: translateX(-50%) !important; /* Desactivamos el arrastre manual en móvil para evitar bugs */
    }

    /* 2. TRANSFORMACIÓN DE BARRA A PANEL VERTICAL COMPACTO */
    .top-bar-panel {
        flex-direction: column; /* De horizontal a vertical */
        padding: 15px;
        border-radius: 20px; /* Menos redondeado, más forma de tarjeta */
        gap: 15px;
        height: auto;
        white-space: normal;
        transform: scale(1) !important; /* En móvil ignoramos los tamaños S/M/L para que sea legible */
    }

    /* 3. SECCIONES REORGANIZADAS */
    .left-section {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        padding-right: 0;
        padding-bottom: 10px;
        justify-content: space-between;
    }

    .drag-handle {
        display: none; /* El arrastre manual con mouse no sirve en táctil, lo ocultamos */
    }

    .center-section {
        flex-direction: column;
        gap: 10px;
        width: 100%;
    }

    .main-display {
        font-size: 48px; /* Tiempo mucho más grande para ver desde lejos */
    }

    .minute-adjuster {
        width: 100%;
        justify-content: center;
        height: 44px;
    }

    .select-compacto {
        font-size: 16px; /* Evita zoom en Android */
        padding: 0 10px;
    }

    .right-section {
        width: 100%;
        border-left: none;
        border-top: 1px solid rgba(255,255,255,0.1);
        padding-left: 0;
        padding-top: 15px;
        justify-content: space-around;
    }

    /* 4. BOTONES MÁS GRANDES PARA EL PULGAR */
    .btn-ctrl.reset, .btn-ctrl.close {
        width: 50px;
        height: 50px;
    }

    .btn-ctrl.play-pause {
        width: 65px;
        height: 65px;
    }

    /* 5. EL BOTÓN MINIMIZADO (Burbuja flotante) */
    .modo-boton-esquina {
        bottom: 80px; /* Subimos un poco para que no choque con la barra de navegación de Android */
        left: 20px;
    }
}
</style>