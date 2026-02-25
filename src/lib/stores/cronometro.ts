import { writable } from 'svelte/store';

export const cronometro = writable({
    abierto: false,          // ¿El panel está expandido?
    corriendo: false,        // ¿Está en play o en pausa?
    minutosAsignados: 15,    // Tiempo que debería durar
    segundosTranscurridos: 0,// Tiempo real transcurrido
    nivelTamano: 1,          // 0: S, 1: M, 2: L (Para la barra)
    posicionX: 0,            // Para recordar dónde lo arrastraste
    posicionY: 0             // Para recordar dónde lo arrastraste
});

// Función rápida para abrirlo y setearle un tiempo desde cualquier parte (Ej: Panel de Control)
export const abrirCronometro = (minutos: number) => {
    cronometro.update(c => ({
        ...c,
        abierto: true,
        minutosAsignados: minutos,
        segundosTranscurridos: 0,
        corriendo: false
    }));
};