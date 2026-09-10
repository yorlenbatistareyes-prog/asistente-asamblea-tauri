// ==========================================================================
// 📖 MANUAL DE ACTUALIZACIONES (Copia y pega para no olvidar)
// ==========================================================================
// Para lanzar una nueva versión, sigue estos pasos:
// 1. Copia el ÚLTIMO bloque completo (desde la llave { hasta la coma }, ).
// 2. Pégalo ARRIBA del todo, para que sea el primero de la lista.
// 3. Cambia la "version" (DEBE ser igual a la de tauri.conf.json).
// 4. Escribe la fecha de hoy y un mensaje general.
// 5. Usa estos iconos para clasificar tus cambios en la lista:
//
// BANCO DE ICONOS DISPONIBLES:
// 🚀 (Novedad)     -> Funciones completamente nuevas e importantes.
// ➕ (Añadido)     -> Opciones, botones o detalles menores agregados.
// 🛠️ (Reparado)    -> Errores o "bugs" que solucionaste.
// ⚡ (Optimizado)  -> Cosas que ahora cargan más rápido o gastan menos recursos.
// 🎨 (Diseño)      -> Cambios visuales, colores, nuevos estilos.
// 🔒 (Seguridad)   -> Mejoras en la protección de datos y la base de datos.
// 🗑️ (Eliminado)   -> Funciones viejas que quitaste para limpiar la app.
// ==========================================================================

export const historialCambios = [
// 👇 AQUÍ PONES LA NUEVA QUE ACABAS DE TERMINAR 👇

{
    version: "1.0.6",
    fecha: "10 de Septiembre, 2026",
    mensaje: "¡Hemos mejorado la sincronización y la estabilidad general!",
    cambios: [
      { tipo: "🔒", texto: "Sincronización silenciosa y automática en la nube mediante carpeta compartida usando Google Drive o OneDrive." },
      { tipo: "🛠️", texto: "Solucionado error al guardar datos locales." },
    ]
  }, 

  {
    version: "1.0.5",
    fecha: "8 de Septiembre, 2026",
    mensaje: "¡Hemos mejorado la sincronización y la estabilidad general!",
    cambios: [
      { tipo: "🚀", texto: "Sincronización silenciosa y automática en la nube." },
      { tipo: "🛠️", texto: "Solucionado el conflicto visual al guardar datos locales." },
      { tipo: "🔒", texto: "Base de datos reestructurada con máxima protección SQLite." },
      { tipo: "🎨", texto: "Nuevo diseñador visual de membretes en Configuración." }
    ]
  }, // <--- NUNCA OLVIDES ESTA COMA PARA SEPARAR LOS BLOQUES

  {
    version: "1.0.4",
    fecha: "1 de Septiembre, 2026",
    mensaje: "Mejoras en el manejo de plantillas y correos.",
    cambios: [
      { tipo: "➕", texto: "Integración inicial de herramientas para diseño." }
    ]
  }
];