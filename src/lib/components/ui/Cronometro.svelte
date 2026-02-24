<script lang="ts">
    import { onDestroy } from 'svelte';
    // Usamos 'Timer' para el icono del botón flotante y otros iconos para el panel
    import { Play, Pause, TimerReset, Timer, X, Plus, Minus, Minimize2 } from 'lucide-svelte';

    // --- ESTADO ---
    let abierto = false;
    let corriendo = false;
    let minutosAsignados = 15; 
    let segundosTranscurridos = 0;
    let intervalo: any;

    // --- LÓGICA ---
    $: if (corriendo) {
        if (!intervalo) {
            intervalo = setInterval(() => segundosTranscurridos += 1, 1000);
        }
    } else {
        clearInterval(intervalo);
        intervalo = null;
    }

    onDestroy(() => clearInterval(intervalo));

    // --- CONTROLES ---
    function togglePlay() { corriendo = !corriendo; }
    function detener() { corriendo = false; segundosTranscurridos = 0; }
    function togglePanel() { abierto = !abierto; }
    function setTiempo(min: number) { minutosAsignados = min; }
    function sumarMinuto() { minutosAsignados += 1; }
    function restarMinuto() { if (minutosAsignados > 1) minutosAsignados -= 1; }

    // --- FORMATO ---
    $: min = Math.floor(segundosTranscurridos / 60);
    $: seg = segundosTranscurridos % 60;
    $: tiempoFormateado = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
    $: tiempoLimite = minutosAsignados * 60;
    $: sePaso = segundosTranscurridos > tiempoLimite;
</script>

<div class="cronometro-wrapper {abierto ? 'modo-barra-top' : 'modo-boton-esquina'}">
    
    {#if abierto}
        <div class="top-bar-panel {sePaso ? 'peligro-glow' : ''}" transition:slide|local={{ duration: 300, axis: 'y' }}>
            
            <div class="left-section">
                <div class="drag-handle"><Timer size={18} /></div>
                <span class="bar-title">Cronómetro</span>
            </div>

            <div class="center-section">
                <div class="minute-adjuster">
                    <button class="btn-mini-adjust" on:click={restarMinuto}><Minus size={12}/></button>
                    <span class="target-min">{minutosAsignados} min</span>
                    <button class="btn-mini-adjust" on:click={sumarMinuto}><Plus size={12}/></button>
                </div>

                <span class="main-display {sePaso ? 'texto-rojo-neon' : ''}">
                    {tiempoFormateado}
                </span>

                <div class="quick-presets">
                    <button on:click={() => setTiempo(5)}>5</button>
                    <button on:click={() => setTiempo(10)}>10</button>
                    <button on:click={() => setTiempo(15)}>15</button>
                </div>
            </div>

            <div class="right-section controls">
                <button class="btn-ctrl reset" on:click={detener} title="Reiniciar">
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

<script context="module">
    import { slide } from 'svelte/transition';
</script>

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
        left: 25px; /* CAMBIO: Ahora a la izquierda */
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
        /* Fondo degradado azul oscuro estilo profesional */
        background: linear-gradient(145deg, #1e3a8a, #2563eb); 
        color: white;
        padding: 8px 20px;
        border-radius: 50px; /* Bordes muy redondeados */
        box-shadow: 0 10px 25px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        gap: 25px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        white-space: nowrap;
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

    /* Display Central */
    .main-display {
        font-size: 36px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .main-display.texto-rojo-neon {
        color: #ff6b6b;
        text-shadow: 0 0 10px rgba(255, 107, 107, 0.6);
    }

    /* Ajuste de Minutos */
    .minute-adjuster { display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 20px; }
    .target-min { font-size: 12px; font-weight: 700; min-width: 45px; text-align: center; }
    .btn-mini-adjust { background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .btn-mini-adjust:hover { background: rgba(255,255,255,0.3); }

    /* Botones preset rápidos */
    .quick-presets { display: flex; gap: 4px; }
    .quick-presets button { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); padding: 2px 8px; border-radius: 10px; font-size: 10px; cursor: pointer; font-weight: 600;}
    .quick-presets button:hover { background: rgba(255,255,255,0.1); color: white; border-color: white;}

    /* Controles de Reproducción */
    .btn-ctrl { border: none; cursor: pointer; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; color: white; }
    .btn-ctrl.reset, .btn-ctrl.close { width: 36px; height: 36px; background: rgba(255,255,255,0.1); }
    .btn-ctrl.reset:hover, .btn-ctrl.close:hover { background: rgba(255,255,255,0.25); transform: scale(1.05); }
    
    .btn-ctrl.play-pause { width: 48px; height: 48px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
    .btn-ctrl.play { background: linear-gradient(135deg, #10b981, #059669); /* Verde brillante */ }
    .btn-ctrl.pausa { background: linear-gradient(135deg, #f59e0b, #d97706); /* Naranja */ }
    .btn-ctrl.play-pause:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }

    /* === ESTILOS DEL BOTÓN FLOTANTE (ESQUINA) === */
    .btn-flotante {
        width: 60px; height: 60px; border-radius: 50%;
        /* Usamos el mismo degradado azul */
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
</style>