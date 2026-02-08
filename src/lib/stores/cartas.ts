import { writable } from 'svelte/store';

export interface CartaData {
    id: string; // 'oradores', 'presidentes', 'oraciones'
    html: string;
}

// Contenido por defecto (Fallback si no hay nada en la base de datos)
const cartasDefault: CartaData[] = [
    { 
        id: 'oradores', 
        html: `<p>Estimado hermano <strong>[[Nombre]] [[Apellidos]]</strong>:</p>
               <p>Nos complace informarle que ha sido asignado para presentar el discurso <strong>[[Tema]]</strong>.</p>
               <p>Fecha: [[Fecha]] | Hora: [[Hora]]</p>
               <p>Atentamente,<br>El Comité del Programa</p>` 
    },
    { 
        id: 'presidentes', 
        html: `<p>Estimado hermano <strong>[[Nombre]]</strong>:</p>
               <p>Gracias por su disposición para presidir la sesión del <strong>[[Fecha]]</strong>.</p>
               <p>Por favor, revise las instrucciones adjuntas.</p>` 
    },
    { 
        id: 'oraciones', 
        html: `<p>Estimado hermano <strong>[[Nombre]]</strong>:</p>
               <p>Le invitamos a realizar la oración de <strong>[[Momento]]</strong> en la próxima asamblea.</p>` 
    }
];

export const cartasStore = writable<CartaData[]>(cartasDefault);