import { writable } from 'svelte/store';

export interface ConfiguracionPDF {
    // 1. Configuración General
    tamanoPapel: 'A4' | 'LETTER' | 'LEGAL';
    mostrarAMPM: boolean;
    
    // 2. Ajustes del Tablero del Presidente
    ajustesTablero: {
        anchoPulgadas: number;
        altoPulgadas: number;
        desplazamientoX: number;
        desplazamientoY: number;
        colorCancionOracion: string;
        imagenEncabezado: string | null;
    };

    // 3. Colores del "Tablero del Presidente"
    coloresPorDia: {
        viernes: string;
        sabado: string;
        domingo: string;
    };

    // 4. Configuración del Membrete (Oficina / Cartas)
    membrete: {
        usarEncabezado: boolean;
        usarPiePagina: boolean;
        titulo: string;
        contacto: string;
        piePagina: string;
        colorLinea: string;
        colorTexto: string;
        colorLineaPie: string;
        colorTextoPie: string;
        tamanoTitulo: number;
        tamanoContacto: number;
        tamanoPiePagina: number;
    };
}

// VALORES POR DEFECTO ELEGANTES
export const valoresPorDefecto: ConfiguracionPDF = {
    tamanoPapel: 'A4',
    mostrarAMPM: true,
    ajustesTablero: {
        anchoPulgadas: 24.0,
        altoPulgadas: 36.0,
        desplazamientoX: 0,
        desplazamientoY: 0,
        colorCancionOracion: '#9b2226',
        imagenEncabezado: null
    },
    coloresPorDia: {
        viernes: '#2a9d8f', // Teal
        sabado: '#22577a',  // Azul Oscuro
        domingo: '#9b2226'  // Rojo Vino
    },
    membrete: {
        usarEncabezado: false,
        usarPiePagina: false,
        titulo: 'OFICINA DE LA ASAMBLEA',
        contacto: '',
        piePagina: '',
        colorLinea: '#000000',
        colorTexto: '#0f172a',
        colorLineaPie: '#cccccc',
        colorTextoPie: '#64748b',
        tamanoTitulo: 22,
        tamanoContacto: 10,
        tamanoPiePagina: 8
    }
};

// Exportamos el store inicializado con los valores por defecto.
// NOTA: Eliminamos la lógica de localStorage. Ahora la persistencia real se hace en 
// la base de datos (SQLite) a través de db.ts y Oficina.svelte.
export const configPDF = writable<ConfiguracionPDF>(valoresPorDefecto);