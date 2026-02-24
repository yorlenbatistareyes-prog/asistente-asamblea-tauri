import { writable } from 'svelte/store';

export const cronometro = writable({
    abierto: false,          // ¿El panel está expandido?
    orador: '',              // Nombre del hermano
    tema: '',                // Tema del discurso
    minutosAsignados: 0,     // Tiempo que debería durar
    segundosTranscurridos: 0,// Tiempo real que lleva hablando
    corriendo: false         // ¿Está en play o en pausa?
});

// Funciones rápidas para controlarlo desde cualquier parte
export const abrirCronometro = (orador: string, tema: string, minutos: number) => {
    cronometro.update(c => ({
        ...c,
        abierto: true,
        orador,
        tema,
        minutosAsignados: minutos,
        segundosTranscurridos: 0,
        corriendo: false
    }));
};