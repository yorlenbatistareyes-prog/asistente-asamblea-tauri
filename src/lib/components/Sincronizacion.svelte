<script lang="ts">
  import { onMount } from 'svelte';
  import { CloudUpload, CloudDownload, Server, AlertCircle, CheckCircle2, Loader2, Mail, KeyRound, ArrowRight } from 'lucide-svelte';
  
  import { DbSyncHelper } from '$lib/services/dbSyncHelper';
  import { SyncService } from '$lib/services/syncService';

  // Importamos la STORE REACTIVA y sus funciones
  import { sesionApp, inicializarSesion, guardarSesion, cerrarSesion } from '$lib/stores/authStore';
  // Importamos el cerebro de auto-sincronización y el nombre del dispositivo
  // Cambia la importación por esta:
import { syncStatus, lastDeviceName } from '$lib/stores/autoSyncStore';

  let inputEmail = ''; 
  let codigoOtp = '';
  
  // --- LÓGICA DEL OTP (6 DÍGITOS) ---
  let otpArray = ['', '', '', '', '', ''];
  let inputRefs: HTMLInputElement[] = [];

  $: codigoOtp = otpArray.join('');

  function handleOtpInput(index: number, event: Event) {
    const target = event.target as HTMLInputElement;
    target.value = target.value.replace(/[^0-9]/g, '');
    otpArray[index] = target.value;
    if (target.value && index < 5) inputRefs[index + 1].focus();
  }

  function handleOtpKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !otpArray[index] && index > 0) inputRefs[index - 1].focus();
    if (event.key === 'Enter' && codigoOtp.length === 6) handleVerificarCodigo();
  }

  function handleOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    const paste = event.clipboardData?.getData('text') || '';
    const numeros = paste.replace(/[^0-9]/g, '').slice(0, 6).split('');
    if (numeros.length > 0) {
      for (let i = 0; i < numeros.length; i++) otpArray[i] = numeros[i];
      const focusIndex = numeros.length < 6 ? numeros.length : 5;
      inputRefs[focusIndex].focus();
    }
  }

  // --- CONTROL DE ESTADO MANUAL ---
  let estado: 'inactivo' | 'cargando' | 'exito' | 'error' = 'inactivo'; 
  let mensaje = '';
  type RespaldoNube = {
    backup_data: string;
    last_device?: string | null;
    last_synced_at?: string | null;
  };
  let respaldoPendiente: RespaldoNube | null = null;
  let restauracionCompleta = false;
  
  let pasoLogin = 1; 
  $: paso = $sesionApp.isLoggedIn ? 3 : pasoLogin;

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  function mostrarError(texto: string) {
    estado = 'error';
    mensaje = texto;
    setTimeout(() => { if (estado === 'error') estado = 'inactivo'; }, 4500);
  }

  function formatearAntiguedad(fechaISO?: string | null): string {
    if (!fechaISO) return 'Fecha no disponible';

    const timestamp = Date.parse(fechaISO);
    if (Number.isNaN(timestamp)) return 'Fecha no disponible';

    const diferenciaSegundos = (timestamp - Date.now()) / 1000;
    const antiguedad = Math.abs(diferenciaSegundos);
    const formato = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

    if (antiguedad < 60) return formato.format(Math.round(diferenciaSegundos), 'second');
    if (antiguedad < 3600) return formato.format(Math.round(diferenciaSegundos / 60), 'minute');
    if (antiguedad < 86400) return formato.format(Math.round(diferenciaSegundos / 3600), 'hour');
    if (antiguedad < 2592000) return formato.format(Math.round(diferenciaSegundos / 86400), 'day');
    if (antiguedad < 31536000) return formato.format(Math.round(diferenciaSegundos / 2592000), 'month');
    return formato.format(Math.round(diferenciaSegundos / 31536000), 'year');
  }

  function cancelarRestauracion() {
    if (estado !== 'cargando') respaldoPendiente = null;
  }

  function cerrarAvisoRestauracion() {
    restauracionCompleta = false;
    window.location.reload();
  }

  // --- ARRANQUE DE LA APP ---
  onMount(async () => {
    await inicializarSesion();
  });

  // --- PASO 1: Pedir Código ---
  async function handleSolicitarCodigo() {
    if (!inputEmail || !inputEmail.includes('@')) {
      mostrarError('Por favor, ingresa un correo válido.');
      return;
    }
    
    estado = 'cargando';
    mensaje = 'Enviando código...';
    
    try {
      await SyncService.solicitarOTP(inputEmail);
      estado = 'exito';
      mensaje = 'Código enviado. Revisa tu bandeja.';
      setTimeout(() => { 
        estado = 'inactivo'; 
        pasoLogin = 2; 
      }, 2500);
    } catch (error) {
      mostrarError(getErrorMessage(error));
    }
  }

  // --- PASO 2: Verificar Código ---
  async function handleVerificarCodigo() {
    if (!codigoOtp || codigoOtp.trim().length < 6) return;

    estado = 'cargando';
    mensaje = 'Verificando...';

    try {
      const res = await SyncService.verificarOTP(inputEmail, codigoOtp.trim());
      
      // GUARDAMOS EN LA BÓVEDA (Tauri Store)
      await guardarSesion(inputEmail, res.token);

      estado = 'exito';
      mensaje = '¡Autenticado con éxito!';
      setTimeout(() => estado = 'inactivo', 1500);
    } catch (error) {
      mostrarError(getErrorMessage(error) || 'Código incorrecto o expirado.');
    }
  }

// --- PASO 3A: Subida Manual ---
  async function handleSubir() {
    estado = 'cargando';
    mensaje = 'Preparando datos...';
    try {
      const backupJson = await DbSyncHelper.prepararRespaldoLocal();
      mensaje = 'Subiendo a la nube...';
      const fechaLocalISO = new Date().toISOString();
      await SyncService.subirRespaldo(backupJson, fechaLocalISO, $lastDeviceName);
      await DbSyncHelper.actualizarFechaSincronizacion(fechaLocalISO);
      
      estado = 'exito';
      mensaje = '¡Respaldo subido correctamente!';
      
      // CAMBIO AQUÍ: Actualizamos a al_dia y luego a inactivo para la TopBar
      syncStatus.update(s => ({ ...s, estado: 'al_dia', mensaje: '¡Subida manual exitosa!' }));
      
      setTimeout(() => {
          estado = 'inactivo';
          syncStatus.update(s => ({ ...s, estado: 'inactivo', mensaje: '' }));
      }, 5000);

    } catch (error) {
      mostrarError(getErrorMessage(error));
      syncStatus.update(s => ({ ...s, estado: 'error', mensaje: 'Error al subir' }));
      setTimeout(() => syncStatus.update(s => ({ ...s, estado: 'inactivo', mensaje: '' })), 4000);
    }
  }

  // --- PASO 3B: Descarga Manual ---
  async function handleDescargar() {
    estado = 'cargando';
    mensaje = 'Buscando datos en la nube...';

    try {
      const res = await SyncService.descargarRespaldo() as RespaldoNube;
      if (!res || typeof res.backup_data !== 'string' || !res.backup_data) {
        throw new Error('El respaldo descargado no contiene datos válidos.');
      }
      respaldoPendiente = res;
      estado = 'inactivo';
      mensaje = '';

    } catch (error) {
      mostrarError(getErrorMessage(error));
      syncStatus.update(s => ({ ...s, estado: 'error', mensaje: 'Error al descargar' }));
      setTimeout(() => syncStatus.update(s => ({ ...s, estado: 'inactivo', mensaje: '' })), 4000);
    }
  }

  async function confirmarRestauracion() {
    if (!respaldoPendiente || estado === 'cargando') return;

    estado = 'cargando';
    mensaje = 'Restaurando base de datos local...';

    try {
      await DbSyncHelper.aplicarRespaldoNube(respaldoPendiente.backup_data);
      if (respaldoPendiente.last_synced_at) {
        await DbSyncHelper.actualizarFechaSincronizacion(respaldoPendiente.last_synced_at);
      }

      respaldoPendiente = null;
      estado = 'inactivo';
      mensaje = '';
      restauracionCompleta = true;
      syncStatus.update(s => ({ ...s, estado: 'al_dia', mensaje: '¡Descarga exitosa!' }));
    } catch (error) {
      mostrarError(getErrorMessage(error));
      syncStatus.update(s => ({ ...s, estado: 'error', mensaje: 'Error al restaurar' }));
      setTimeout(() => syncStatus.update(s => ({ ...s, estado: 'inactivo', mensaje: '' })), 4000);
    }
  }

  // --- CERRAR SESIÓN ---
  async function handleCerrarSesion() {
    try {
      estado = 'cargando';
      mensaje = 'Cerrando sesión...';
      await cerrarSesion(); 
    } catch (error) {
      console.error("Error al borrar la sesión:", error);
    } finally {
      inputEmail = '';
      codigoOtp = '';
      otpArray = ['', '', '', '', '', ''];
      pasoLogin = 1;
      estado = 'inactivo';
      mensaje = '';
    }
  }
</script>

<div class="sync-container">

  <div class="sync-form">
    {#if $sesionApp.verificando}
      <div class="status-box cargando" style="justify-content: center; margin-bottom: 0;">
        <Loader2 size={18} class="spin" />
        <span>Verificando sesión...</span>
      </div>

    {:else if paso === 1}
      <form on:submit|preventDefault={handleSolicitarCodigo} class="input-group">
        <label for="email">Ingresa tu correo para comenzar</label>
        <div class="input-with-icon">
          <Mail size={16} class="icon-input" />
          <input 
            type="email" 
            id="email" 
            bind:value={inputEmail} 
            placeholder="tu@correo.com" 
            autocomplete="email" 
            disabled={estado === 'cargando'}
          />
        </div>
        <button type="submit" class="btn-sync btn-upload" disabled={estado === 'cargando'}>
          Solicitar Código de Acceso
        </button>
      </form>

    {:else if paso === 2}
      <form on:submit|preventDefault={handleVerificarCodigo} class="input-group">
        <label for="codigo" style="text-align: center;">Ingresa el código de 6 dígitos</label>
        
        <div class="otp-container">
          {#each otpArray as _, i}
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="1"
              class="otp-input"
              bind:value={otpArray[i]}
              bind:this={inputRefs[i]}
              on:input={(e) => handleOtpInput(i, e)}
              on:keydown={(e) => handleOtpKeydown(i, e)}
              on:paste={i === 0 ? handleOtpPaste : undefined}
              disabled={estado === 'cargando'}
            />
          {/each}
        </div>

        <span class="ayuda-texto" style="text-align: center; margin-bottom: 10px;">
          Enviado a: <strong>{inputEmail}</strong>
        </span>
        
        <div class="botones-paso2 mt-2">
          <button type="button" class="btn-sync btn-download" on:click={() => pasoLogin = 1} disabled={estado === 'cargando'}>
            Corregir correo
          </button>
          <button type="submit" class="btn-sync btn-upload" disabled={estado === 'cargando' || codigoOtp.length < 6}>
            Verificar Código
          </button>
        </div>
      </form>

    {:else if paso === 3}
      <div class="sesion-activa">
        <div class="usuario-conectado">
          <span class="bola-verde"></span> 
          <span>Conectado como: <strong>{$sesionApp.correo}</strong></span>
        </div>
        <button class="btn-cerrar-sesion" on:click={handleCerrarSesion}>Cambiar cuenta</button>
      </div>

      {#if $syncStatus.estado === 'esperando' || $syncStatus.estado === 'sincronizando'}
         <div class="status-box cargando" style="font-size: 0.8rem; padding: 8px;">
            <Loader2 size={14} class="spin" /> Sincronización automática en curso...
         </div>
      {/if}

      <div class="sync-actions">
        <button class="btn-sync btn-upload" on:click={handleSubir} 
          disabled={estado === 'cargando' || $syncStatus.estado === 'sincronizando'}>
          <CloudUpload size={18} /> Subir a la Nube
        </button>
        
        <button class="btn-sync btn-download" on:click={handleDescargar} 
          disabled={estado === 'cargando' || $syncStatus.estado === 'sincronizando'}>
          <CloudDownload size={18} /> Restaurar Datos
        </button>
      </div>
    {/if}
  </div>

  {#if estado !== 'inactivo'}
    <div class="status-box {estado}">
      {#if estado === 'cargando'}
        <Loader2 size={18} class="spin" />
      {:else if estado === 'exito'}
        <CheckCircle2 size={18} />
      {:else if estado === 'error'}
        <AlertCircle size={18} />
      {/if}
      <span>{mensaje}</span>
    </div>
  {/if}
</div>

{#if respaldoPendiente}
  <div class="modal-backdrop" role="presentation" on:click|self={cancelarRestauracion}>
    <div class="restore-modal" role="dialog" aria-modal="true" aria-labelledby="restore-title" tabindex="-1">
      <h2 id="restore-title">Restaurar copia de seguridad</h2>
      <p class="restore-warning">
        Esta acción reemplazará los datos de este dispositivo por los incluidos en la copia de seguridad.
      </p>

      <div class="restore-devices">
        <div class="restore-device">
          <strong>{respaldoPendiente.last_device || 'Dispositivo desconocido'}</strong>
          <span>{formatearAntiguedad(respaldoPendiente.last_synced_at)}</span>
        </div>
        <ArrowRight size={25} aria-hidden="true" />
        <div class="restore-device">
          <strong>{$lastDeviceName}</strong>
          <span>Este dispositivo</span>
        </div>
      </div>

      <div class="restore-buttons">
        <button class="restore-button confirm" on:click={confirmarRestauracion} disabled={estado === 'cargando'}>
          {#if estado === 'cargando'}<Loader2 size={16} class="spin" />{:else}Restaurar{/if}
        </button>
        <button class="restore-button" on:click={cancelarRestauracion} disabled={estado === 'cargando'}>
          Cancelar
        </button>
      </div>
    </div>
  </div>
{/if}

{#if restauracionCompleta}
  <div class="modal-backdrop" role="presentation">
    <div class="restore-modal success-modal" role="dialog" aria-modal="true" aria-labelledby="restore-success-title" tabindex="-1">
      <h2 id="restore-success-title">Se ha restaurado correctamente</h2>
      <CheckCircle2 size={76} class="success-icon" aria-hidden="true" />
      <button class="restore-button success-close" on:click={cerrarAvisoRestauracion}>Cerrar</button>
    </div>
  </div>
{/if}

<style>
  .mt-2 { margin-top: 10px; }
  .sync-container { width: 100%; }
  .sync-form { display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px; }
  .input-group { display: flex; flex-direction: column; gap: 10px; }
  .input-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-main); }
  .input-with-icon { position: relative; display: flex; align-items: center; }
  .icon-input { position: absolute; left: 12px; color: var(--text-muted); }
  .input-with-icon input { width: 100%; padding: 10px 12px 10px 35px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-app); color: var(--text-main); font-family: inherit; }
  .input-with-icon input:focus { outline: none; border-color: var(--primary); }
  .input-with-icon input:disabled { opacity: 0.6; cursor: not-allowed; }
  .ayuda-texto { font-size: 0.75rem; color: var(--text-muted); margin-top: -5px; }
  .botones-paso2 { display: flex; gap: 10px; }
  .sesion-activa { display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); padding: 12px 15px; border-radius: var(--radius-sm); margin-bottom: 15px; border: 1px solid var(--border-color); }
  .usuario-conectado { font-size: 0.85rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
  .bola-verde { width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; }
  .btn-cerrar-sesion { background: transparent; border: none; font-size: 0.8rem; color: var(--primary); font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0; }
  .status-box { display: flex; align-items: center; gap: 10px; padding: 12px 15px; border-radius: var(--radius-sm); margin-bottom: 20px; font-size: 0.9rem; font-weight: 600; animation: fadeIn 0.3s ease; }
  .status-box.cargando { background: rgba(37, 99, 235, 0.1); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.2); }
  .status-box.exito { background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2); }
  .status-box.error { background: rgba(225, 29, 72, 0.1); color: #e11d48; border: 1px solid rgba(225, 29, 72, 0.2); }
  .sync-actions { display: flex; gap: 15px; }
  .btn-sync { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border: none; border-radius: var(--radius-sm); font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-sync:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-upload { background: var(--primary); color: white; }
  .btn-upload:hover:not(:disabled) { filter: brightness(1.1); }
  .btn-download { background: transparent; border: 1px solid var(--primary); color: var(--primary); }
  .btn-download:hover:not(:disabled) { background: rgba(var(--primary-rgb), 0.1); }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 480px) { .sync-actions { flex-direction: column; } .botones-paso2 { flex-direction: column-reverse; } }
  .otp-container { 
    display: flex; 
    justify-content: center; 
    gap: 10px; 
    margin: 20px 0; 
    width: 100%; 
  }

  .otp-input { 
    width: 45px !important; /* Forzamos el ancho */
    height: 55px !important; /* Forzamos el alto */
    text-align: center; 
    font-size: 1.5rem; 
    font-weight: bold; 
    border: 2px solid var(--border-color, #ccc); 
    border-radius: 8px; 
    background: var(--bg-app, white); 
    color: var(--text-main, black); 
    transition: all 0.2s ease;
    padding: 0;
    display: block !important; /* Aseguramos que no se oculte */
  }

  .otp-input:focus { 
    outline: none; 
    border-color: var(--primary, #3b82f6); 
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); 
  }

  .otp-input:disabled { opacity: 0.6; cursor: not-allowed; background: var(--bg-panel); }
  .modal-backdrop { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(2px); }
  .restore-modal { width: min(540px, 100%); padding: 24px; border-radius: 10px; background: var(--bg-panel, #fff); color: var(--text-main, #222); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3); animation: fadeIn 0.2s ease; }
  .restore-modal h2 { margin: 0 0 14px; font-size: 1.25rem; font-weight: 600; }
  .restore-warning { margin: 0 0 20px; color: var(--text-muted); line-height: 1.5; }
  .restore-devices { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px; margin: 20px 0 24px; }
  .restore-devices > :global(svg) { color: var(--primary); }
  .restore-device { display: flex; min-width: 0; flex-direction: column; align-items: center; gap: 5px; text-align: center; overflow-wrap: anywhere; }
  .restore-device span { color: var(--text-muted); font-size: 0.9rem; }
  .restore-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .restore-button { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 9px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-app); color: var(--text-main); font: inherit; cursor: pointer; }
  .restore-button.confirm { background: var(--primary); border-color: var(--primary); color: white; }
  .restore-button:disabled { opacity: 0.6; cursor: not-allowed; }
  .success-modal { display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 28px 24px; }
  .success-modal h2 { margin: 0; text-align: center; font-weight: 500; }
  .success-icon { color: #65439a; stroke-width: 1.8; }
  .success-close { width: min(180px, 100%); }
  @media (max-width: 480px) {
    .restore-modal { padding: 20px 16px; }
    .restore-devices { gap: 7px; }
    .restore-device { font-size: 0.9rem; }
  }
 /* Para móviles, que sean un poco más pequeñas */
  @media (max-width: 480px) { 
    .otp-container { gap: 5px; } 
    .otp-input { 
      width: 35px !important; 
      height: 45px !important; 
      font-size: 1.2rem; 
    }
}
</style>