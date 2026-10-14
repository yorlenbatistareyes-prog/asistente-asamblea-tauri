<script lang="ts">
  import { onMount } from 'svelte';
  import { CloudUpload, CloudDownload, AlertCircle, CheckCircle2, Loader2, Mail, KeyRound, Lock, ShieldCheck } from 'lucide-svelte';
  
  import { DbSyncHelper } from '$lib/services/dbSyncHelper';
  import { SyncService } from '$lib/services/syncService';

  // Importamos la STORE REACTIVA y sus funciones
  import { sesionApp, inicializarSesion, guardarSesion, cerrarSesion } from '$lib/stores/authStore';
  // Importamos el cerebro de auto-sincronización y el nombre del dispositivo
  import { syncStatus, lastDeviceName, iniciarRadarNube } from '$lib/stores/autoSyncStore';
  // Importamos las funciones de Cifrado Extremo a Extremo (Zero-Knowledge)
  import { guardarPasswordCifrado, tienePasswordCifrado, borrarPasswordCifrado } from '$lib/utils/seguridad';

  let inputEmail = ''; 
  let codigoOtp = '';
  
  // --- ESTADO DE CLAVE E2EE (ZERO-KNOWLEDGE) ---
  let inputPin = '';
  let tienePinConfigurado = false;
  let editandoPin = false;

 // Forzar la comprobación E2EE apenas el usuario inicie sesión
  $: if ($sesionApp.isLoggedIn) {
    tienePasswordCifrado()
      .then((res) => { tienePinConfigurado = res; })
      .catch(() => { tienePinConfigurado = false; });
      
    iniciarRadarNube(); // <--- ESTO ENCIENDE LA VIGILANCIA AUTOMÁTICA
  }

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
  
  let pasoLogin = 1; 
  $: paso = $sesionApp.isLoggedIn ? 3 : pasoLogin;

  function getErrorMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    // Traducimos errores criptográficos de Rust a un mensaje claro para el usuario
    if (raw.toLowerCase().includes('llave') || raw.toLowerCase().includes('decrypt') || raw.toLowerCase().includes('key') || raw.toLowerCase().includes('aead')) {
      return 'Clave de cifrado incorrecta. Asegúrate de usar la misma clave con la que subiste el respaldo.';
    }
    return raw;
  }

  function mostrarError(texto: string) {
    estado = 'error';
    mensaje = texto;
    setTimeout(() => { if (estado === 'error') estado = 'inactivo'; }, 5500);
  }

  // --- ARRANQUE DE LA APP ---
  onMount(async () => {
    await inicializarSesion();
    tienePinConfigurado = await tienePasswordCifrado();
  });

  // --- GUARDAR CLAVE SECRETA E2EE ---
  async function handleGuardarPin() {
    if (!inputPin || inputPin.trim().length < 4) {
      mostrarError('La clave de cifrado debe tener al menos 4 caracteres.');
      return;
    }
    try {
      await guardarPasswordCifrado(inputPin.trim());
      tienePinConfigurado = true;
      editandoPin = false;
      inputPin = '';
      estado = 'exito';
      mensaje = 'Clave de cifrado guardada en este dispositivo.';
      setTimeout(() => { if (estado === 'exito') estado = 'inactivo'; }, 2500);
    } catch (error) {
      mostrarError(getErrorMessage(error));
    }
  }

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
      tienePinConfigurado = await tienePasswordCifrado();

      estado = 'exito';
      mensaje = '¡Autenticado con éxito!';
      setTimeout(() => estado = 'inactivo', 1500);
    } catch (error) {
      mostrarError(getErrorMessage(error) || 'Código incorrecto o expirado.');
    }
  }

  // --- PASO 3A: Subida Manual ---
  async function handleSubir() {
    if (!tienePinConfigurado) {
      mostrarError('Primero configura tu clave de cifrado secreto.');
      return;
    }

    estado = 'cargando';
    mensaje = 'Cifrando datos localmente...';
    try {
      const backupJson = await DbSyncHelper.prepararRespaldoLocal();
      mensaje = 'Subiendo a la nube...';
      const fechaLocalISO = new Date().toISOString();
      await SyncService.subirRespaldo(backupJson, fechaLocalISO, $lastDeviceName);
      await DbSyncHelper.actualizarFechaSincronizacion(fechaLocalISO);
      
      estado = 'exito';
      mensaje = '¡Respaldo cifrado y subido correctamente!';
      
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

  // --- PASO 3B: Descarga Directa desde la Nube ---
  async function handleDescargar() {
    if (!tienePinConfigurado) {
      mostrarError('Primero ingresa tu clave de cifrado para poder desencriptar el respaldo.');
      return;
    }

    estado = 'cargando';
    mensaje = 'Descargando y desencriptando datos...';

    try {
      const res = await SyncService.descargarRespaldo() as RespaldoNube;
      if (!res || typeof res.backup_data !== 'string' || !res.backup_data) {
        throw new Error('El respaldo descargado no contiene datos válidos.');
      }
      
      // Aplicamos el respaldo directamente a la base de datos
      await DbSyncHelper.aplicarRespaldoNube(res.backup_data);
      if (res.last_synced_at) {
        await DbSyncHelper.actualizarFechaSincronizacion(res.last_synced_at);
      }

      estado = 'exito';
      mensaje = '¡Datos desencriptados y restaurados con éxito!';
      syncStatus.update(s => ({ ...s, estado: 'al_dia', mensaje: '¡Descarga exitosa!' }));
      
      setTimeout(() => {
        window.location.reload(); 
      }, 1500);

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
      await borrarPasswordCifrado();
    } catch (error) {
      console.error("Error al borrar la sesión:", error);
    } finally {
      inputEmail = '';
      codigoOtp = '';
      inputPin = '';
      tienePinConfigurado = false;
      editandoPin = false;
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

      <!-- BLOQUE DE CIFRADO EXTREMO A EXTREMO (ZERO-KNOWLEDGE) -->
      {#if !tienePinConfigurado || editandoPin}
        <form on:submit|preventDefault={handleGuardarPin} class="e2ee-setup-box">
          <div class="e2ee-header">
            <Lock size={16} />
            <span>Clave de Cifrado Extremo a Extremo</span>
          </div>
          <p class="e2ee-desc">
            Crea o ingresa tu clave secreta (PIN o contraseña). <strong>Nunca se envía al servidor</strong>; sin ella nadie podrá leer tus respaldos. Usa exactamente la misma en todos tus dispositivos.
          </p>
          <div class="e2ee-input-row">
            <div class="input-with-icon" style="flex: 1;">
              <KeyRound size={16} class="icon-input" />
              <input 
                type="password" 
                bind:value={inputPin} 
                placeholder="Mínimo 4 caracteres..." 
                disabled={estado === 'cargando'}
              />
            </div>
            <button type="submit" class="btn-sync btn-upload" disabled={estado === 'cargando' || inputPin.trim().length < 4}>
              Guardar Clave
            </button>
            {#if tienePinConfigurado}
              <button type="button" class="btn-sync btn-download" on:click={() => { editandoPin = false; inputPin = ''; }}>
                Cancelar
              </button>
            {/if}
          </div>
        </form>
      {:else}
        <div class="e2ee-active-bar">
          <div class="e2ee-status">
            <ShieldCheck size={16} class="shield-ok" />
            <span>Cifrado extremo a extremo activo</span>
          </div>
          <button class="btn-cerrar-sesion" on:click={() => editandoPin = true}>Cambiar clave</button>
        </div>
      {/if}

      {#if $syncStatus.estado === 'esperando' || $syncStatus.estado === 'sincronizando'}
         <div class="status-box cargando" style="font-size: 0.8rem; padding: 8px;">
            <Loader2 size={14} class="spin" /> Sincronización automática en curso...
         </div>
      {/if}

      <div class="sync-actions">
        <button class="btn-sync btn-upload" on:click={handleSubir} 
          disabled={!tienePinConfigurado || editandoPin || estado === 'cargando' || $syncStatus.estado === 'sincronizando'}>
          <CloudUpload size={18} /> Subir a la Nube
        </button>
        
        <button class="btn-sync btn-download" on:click={handleDescargar} 
          disabled={!tienePinConfigurado || editandoPin || estado === 'cargando' || $syncStatus.estado === 'sincronizando'}>
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
  .sesion-activa { display: flex; justify-content: space-between; align-items: center; background: var(--bg-app); padding: 12px 15px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); }
  .usuario-conectado { font-size: 0.85rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
  .bola-verde { width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; }
  .btn-cerrar-sesion { background: transparent; border: none; font-size: 0.8rem; color: var(--primary); font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0; }
  
  /* Estilos E2EE */
  .e2ee-setup-box { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: var(--radius-sm); background: rgba(37, 99, 235, 0.06); border: 1px solid rgba(37, 99, 235, 0.25); }
  .e2ee-header { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 700; color: var(--primary); }
  .e2ee-desc { margin: 0; font-size: 0.78rem; color: var(--text-muted); line-height: 1.45; }
  .e2ee-input-row { display: flex; gap: 8px; align-items: center; }
  .e2ee-active-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: var(--radius-sm); background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); font-size: 0.82rem; }
  .e2ee-status { display: flex; align-items: center; gap: 8px; color: #059669; font-weight: 600; }

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
  @media (max-width: 480px) { 
    .sync-actions { flex-direction: column; } 
    .botones-paso2 { flex-direction: column-reverse; } 
    .e2ee-input-row { flex-direction: column; align-items: stretch; }
  }
  
  .otp-container { 
    display: flex; 
    justify-content: center; 
    gap: 10px; 
    margin: 20px 0; 
    width: 100%; 
  }

  .otp-input { 
    width: 45px !important;
    height: 55px !important;
    text-align: center; 
    font-size: 1.5rem; 
    font-weight: bold; 
    border: 2px solid var(--border-color, #ccc); 
    border-radius: 8px; 
    background: var(--bg-app, white); 
    color: var(--text-main, black); 
    transition: all 0.2s ease;
    padding: 0;
    display: block !important;
  }

  .otp-input:focus { 
    outline: none; 
    border-color: var(--primary, #3b82f6); 
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); 
  }

  .otp-input:disabled { opacity: 0.6; cursor: not-allowed; background: var(--bg-panel); }

  @media (max-width: 480px) { 
    .otp-container { gap: 5px; } 
    .otp-input { 
      width: 35px !important; 
      height: 45px !important; 
      font-size: 1.2rem; 
    }
  }
</style>
