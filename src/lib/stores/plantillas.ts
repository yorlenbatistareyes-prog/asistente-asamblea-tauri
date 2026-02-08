import { writable } from 'svelte/store';

// --- INTERFACES ---
export interface PlantillaEmail {
    id: string;
    title: string;
    subject: string;
    body: string;
    isOpen: boolean;
}

export interface PlantillaWhatsApp {
    id: string;
    label: string;
    content: string;
    isOpen: boolean;
}

export interface MarcadorItem {
    label: string;
    desc?: string;
    code: string;
    value: string;
}

export interface MarcadorGrupo {
    category: string;
    isOpen: boolean;
    items: MarcadorItem[];
}

// --- DATOS INICIALES (CORREOS) ---
const plantillasEmailDefault: PlantillaEmail[] = [
    { id: 'comite', title: "Plantilla de correo electrónico a todos los miembros de Comité de asamblea", subject: "", body: "", isOpen: false },
    { id: 'programa', title: "Plantilla de correo electrónico a Sup. de Programa", subject: "", body: "", isOpen: false },
    { id: 'av', title: "Plantilla de correo electrónico a Audio y video", subject: "", body: "", isOpen: false },
    { id: 'oradores', title: "Plantilla de correo electrónico a Oradores del programa", subject: "", body: "", isOpen: false },
    { id: 'oficina', title: "Plantilla de correo electrónico a Miembros de la Oficina del presidente", subject: "", body: "", isOpen: false },
    { id: 'presidentes', title: "Plantilla de correo electrónico a Presidentes de Sesión", subject: "", body: "", isOpen: false },
    { id: 'oraciones', title: "Plantilla de correo electrónico a hermanos que harán oraciones", subject: "", body: "", isOpen: false }
];

// --- DATOS INICIALES (WHATSAPP) ---
const plantillasWhatsAppDefault: PlantillaWhatsApp[] = [
    { id: 'comite', label: 'Mensaje a Comité', content: "", isOpen: false },
    { id: 'programa', label: 'Mensaje a Sup. Programa', content: "", isOpen: false },
    { id: 'audiovideo', label: 'Mensaje a Audio y Video', content: "", isOpen: false },
    { id: 'oradores', label: 'Mensaje a Oradores', content: "", isOpen: false },
    { id: 'oficina', label: 'Mensaje a Oficina', content: "", isOpen: false },
    { id: 'presidentes', label: 'Mensaje a Presidentes', content: "", isOpen: false },
    { id: 'oraciones', label: 'Mensaje a Oraciones', content: "", isOpen: false }
];

// --- DATOS CONSTANTES (MARCADORES) ---
// Estos no necesitan ser un store escribible si no cambian, pero los exportamos para usarlos.
export const marcadoresGlobales: MarcadorGrupo[] = [
    {
        category: "Lista rápida",
        isOpen: true,
        items: [
            { label: "Saludo según sexo", desc: "Ejemplo: Hermano, o Hermana", code: "[[Saludo según sexo]]", value: "Saludo según sexo" },
            { label: "Designación del Circuito", desc: "Ejemplo: HG-06", code: "[[Designación del Circuito]]", value: "Designación del Circuito" }
        ]
    },
    {
        category: "Fechas",
        isOpen: false,
        items: [
            { label: "Fecha Actual Mediana", desc: "Ejemplo: 7 feb 2026", code: "[[Fecha Actual Mediana]]", value: "Fecha Actual Mediana" },
            { label: "Fecha Actual Completa", desc: "Ejemplo: 7 de febrero de 2026", code: "[[Fecha Actual Completa]]", value: "Fecha Actual Completa" }
        ]
    },
    {
        category: "Asignación",
        isOpen: false,
        items: [
            { label: "Hora", desc: "Ejemplo: 10:10 AM", code: "[[Hora]]", value: "Hora" },
            { label: "Duración", desc: "Total de minutos", code: "[[Duración]]", value: "Duración" },
            { label: "Tema", desc: "Título del discurso", code: "[[Tema]]", value: "Tema" },
            { label: "Número de Bosquejo", desc: "Ejemplo: 1", code: "[[Número de Bosquejo]]", value: "Número de Bosquejo" },
            { label: "Tipo de asignación", desc: "Ejemplo: Discurso...", code: "[[Tipo de asignación]]", value: "Tipo de asignación" },
            { label: "Enlace(s) del Bosquejo", desc: "Cualquier enlace", code: "[[Enlace(s) del Bosquejo]]", value: "Enlace(s) del Bosquejo" },
            { label: "Notas", desc: "", code: "[[Notas]]", value: "Notas" }
        ]
    },
    {
        category: "Orador",
        isOpen: false,
        items: [
            { label: "Nombre", desc: "Ejemplo: Roberto", code: "[[Nombre]]", value: "Nombre" },
            { label: "Segundo nombre", desc: "Ejemplo: Adolfo", code: "[[Segundo nombre]]", value: "Segundo nombre" },
            { label: "Apellidos", desc: "Ejemplo: Batista Peña", code: "[[Apellidos]]", value: "Apellidos" }
        ]
    },
    {
        category: "Lugar",
        isOpen: false,
        items: [
            { label: "Nombre del lugar", desc: "Ejemplo: Salón", code: "[[Nombre del lugar]]", value: "Nombre del lugar" },
            { label: "Dirección del lugar", desc: "Ejemplo: Av. Central", code: "[[Dirección]]", value: "Dirección" },
            { label: "Ciudad", desc: "Ejemplo: Holguín", code: "[[Ciudad]]", value: "Ciudad" },
            { label: "Provincia o Estado", desc: "Ejemplo: HG", code: "[[Estado o Provincia]]", value: "Estado o Provincia" }
        ]
    },
    {
        category: "Evento",
        isOpen: false,
        items: [
            { label: "Fecha", desc: "Ejemplo: Fecha de la Asamblea", code: "[[Fecha]]", value: "Fecha" },
            { label: "Tipo de evento", desc: "Ejemplo: CA-br", code: "[[Tipo de Evento]]", value: "Tipo de Evento" },
            { label: "Tema del evento", desc: "Título del evento", code: "[[Tema del Evento]]", value: "Tema del Evento" }
        ]
    },
    {
        category: "Ensayo",
        isOpen: false,
        items: [
            { label: "Información completa de los ensayos", desc: "Info completa", code: "[[Información completa de los ensayos]]", value: "Información completa de los ensayos" },
            { label: "Nota para los ensayos", desc: "", code: "[[Notas para los ensayos]]", value: "Notas para los ensayos" },
            { label: "Lugar de los ensayos", desc: "", code: "[[Lugar de los ensayos]]", value: "Lugar de los ensayos" },
            { label: "Fecha y hora del ensayo", desc: "", code: "[[Fecha y hora del ensayo]]", value: "Fecha y hora del ensayo" },
            { label: "Fecha de ensayos", desc: "", code: "[[Fecha de ensayos]]", value: "Fecha de ensayos" },
            { label: "Hora de ensayos", desc: "", code: "[[Hora de ensayos]]", value: "Hora de ensayos" }
        ]
    },
    {
        category: "Presidente",
        isOpen: false,
        items: [
            { label: "Correo electrónico del Presidente", desc: "Ejemplo: mail@jwpub.org", code: "[[correo electrónico jwpub del Presidente de la asamblea]]", value: "correo electrónico jwpub del Presidente de la asamblea" },
            { label: "Teléfono del Presidente", desc: "", code: "[[Teléfono del Presidente de la asamblea]]", value: "Teléfono del Presidente de la asamblea" }
        ]
    },
    {
        category: "Instrucciones",
        isOpen: false,
        items: [
            { label: "Información de orientaciones", desc: "Plataforma...", code: "[[Información de orientaciones]]", value: "Información de orientaciones" },
            { label: "Instrucciones especiales", desc: "Sucursal", code: "[[Instrucciones Especiales]]", value: "Instrucciones Especiales" }
        ]
    }
];

// --- STORES ---
export const emailTemplates = writable<PlantillaEmail[]>(plantillasEmailDefault);
export const whatsappTemplates = writable<PlantillaWhatsApp[]>(plantillasWhatsAppDefault);
