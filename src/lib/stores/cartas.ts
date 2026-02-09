import { writable } from 'svelte/store';

export interface CartaData {
    id: string; 
    html: string;
}

// Estos IDs coinciden con lo que pide programa.svelte
const cartasDefault: CartaData[] = [
    { 
        id: 'carta_oradores', 
        html: `<p>Estimado hermano <strong>[[Nombre]] [[Apellidos]]</strong>:</p>
               <p>Nos complace informarle que ha sido asignado para presentar el discurso titulado: <strong>[[Tema]]</strong>.</p>
               <p><strong>Detalles de la asignación:</strong></p>
               <ul>
                   <li>Fecha: <strong>[[Fecha]]</strong></li>
                   <li>Hora: <strong>[[Hora]]</strong></li>
                   <li>Congregación: [[Congregación]]</li>
               </ul>
               <p>Atentamente,<br>El Comité del Programa</p>` 
    },
    { 
        id: 'carta_presidentes', 
        html: `<p>Estimado hermano <strong>[[Nombre]]</strong>:</p>
               <p>Gracias por su disposición para presidir la sesión del <strong>[[Fecha]]</strong>.</p>
               <p>Agradecemos su valiosa ayuda.</p>` 
    },
    { 
        id: 'carta_oraciones', 
        html: `<p>Estimado hermano <strong>[[Nombre]]</strong>:</p>
               <p>Le invitamos a realizar la oración de <strong>[[Tema]]</strong> en la próxima asamblea el día <strong>[[Fecha]]</strong>.</p>` 
    },
    {
        id: 'carta_oficina', 
        html: `<p>Estimado hermano <strong>[[Nombre]]</strong>:</p>
               <p>Se le ha asignado una función especial en la oficina para el día [[Fecha]].</p>`
    }
];

export const cartasStore = writable<CartaData[]>(cartasDefault);