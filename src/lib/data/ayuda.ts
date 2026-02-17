// Definimos la estructura para que TypeScript nos ayude
export interface AyudaItem {
    title: string;
    content: string;
    // isOpen es opcional aquí porque lo gestionará la vista
    isOpen?: boolean; 
}

export const guiaUsuario: AyudaItem[] = [
    {
        title: "Configuración Inicial y Perfil",
        content: `Su información personal se gestiona en la pestaña 'General'. 
        Desplácese hasta la parte inferior de esa pantalla para ubicar la tarjeta 
        'Información del usuario'. Allí podrá editar su nombre, contacto e identificación. 
        Estos datos son fundamentales, ya que se usan para firmar automáticamente 
        las plantillas de correo y reportes.`
    },

    {
        title: "Gestión de Datos y Copias de Seguridad",
        content: `En la sección 'Datos' encontrará las herramientas para proteger su información. 
        Use **'Respaldar datos'** para guardar una copia de seguridad completa 
        (.sqlite) en su computadora. Si necesita recuperar información previa, utilice 
        **'Restaurar datos'** (esta acción reemplazará los datos actuales por los 
        del archivo de respaldo). Por último, **'Limpiar todo'** elimina toda la información 
        registrada en la aplicación para comenzar desde cero (restablecimiento de fábrica).`
    },

    {
        title: "Gestión de Locales y Salones",
        content: `Desde la pantalla de inicio, utilice el botón 'Locales' para registrar 
        los Salones de Asambleas disponibles. Esta base de datos centralizada le permitirá 
        vincular una asamblea a su ubicación física al momento de crearla. Además, 
        estos locales estarán disponibles en la sección 'Información del Evento' para 
        programar ensayos y reuniones previas de forma rápida.`
    },

    {
        title: "Gestión del Programa y Oradores",
        content: `El proceso comienza en la pantalla principal creando una nueva asamblea. 
        Al entrar en la tarjeta del evento, accederá a un panel lateral con todas las herramientas: 
        desde el 'Resumen' con estadísticas y monitor, hasta la importación de 'Congregaciones' 
        y 'Personas' mediante archivos CSV de JW. En la sección 'Programa y Oradores', podrá 
        gestionar la Oficina (presidentes, oraciones, etc.), importar el programa, 
        y utilizar las herramientas de comunicación (Email/WhatsApp) y seguimiento 
        (Confirmación, Ensayo, Presencia) en cada tarjeta de discurso.`
    },

    {
        title: "Uso de Plantillas de Correo Electrónico",
        content: `Diríjase a la pestaña 'Plantillas de correo' dentro de esta configuración. 
        Seleccione una plantilla (por ejemplo, 'Oradores') y pulse 'Editar'. Se abrirá un 
        editor de texto completo. Puede redactar el mensaje y utilizar el panel derecho 
        para insertar 'Marcadores de posición' (ej. [[Nombre]], [[Tema]]). Al enviar el correo 
        desde la sección correspondiente, el sistema reemplazará estos marcadores con 
        los datos reales del hermano.`
    },
    {
        title: "Plantillas de Mensajes Rápidos (WhatsApp)",
        content: `En la pestaña 'General', puede predefinir los mensajes para WhatsApp. 
        Estos textos se utilizarán cuando pulse el icono de WhatsApp junto al nombre 
        de un orador en el programa principal. Al igual que los correos, puede incluir 
        marcadores básicos para personalizar el mensaje automáticamente.`
    },
    {
        title: "Generación de Correspondencia y Cartas",
        content: `La sección 'Correspondencia' del menú principal permite generar cartas 
        formales en formato PDF. El sistema utiliza plantillas predefinidas y 'mezcla' 
        los datos del programa (oradores, presidentes, fechas) con el documento. 
        Asegúrese de revisar la configuración de márgenes en el editor de correspondencia 
        antes de imprimir.`
    },
    {
        title: "Marcadores de Posición y Mezcla de Datos",
        content: `Los marcadores son textos entre corchetes dobles, por ejemplo [[Nombre]]. 
        Cuando el sistema genera un correo o una carta, busca estos marcadores y los 
        sustituye por la información correspondiente de la base de datos. Si coloca un 
        marcador en el campo 'Asunto' de una plantilla, también será reemplazado correctamente.`
    },
    {
        title: "Envío de Correos y Cuentas JWPub",
        content: `Para el envío de asignaciones, el sistema intentará abrir su cliente 
        de correo predeterminado. Si utiliza una cuenta institucional (jwpub.org), 
        se recomienda tener la sesión iniciada en Outlook Web. Puede forzar el uso de 
        su aplicación de escritorio activando la opción 'Utilice el cliente de correo 
        electrónico en lugar de Outlook Online' en la pestaña General.`
    },
    
    {
        title: "Oficina del Presidente",
        content: `Herramienta administrativa para gestionar al personal de apoyo directo 
        del programa (Presidentes de sesión, Oraciones, Consejeros y Ayudantes de plataforma). 
        Permite organizar estas asignaciones por bloques (Mañana/Tarde), generar y enviar 
        su correspondencia oficial, y llevar un control de cumplimiento mediante los 
        indicadores de estado: 'Asignación recibida', 'Ensayo realizado' y 'Presente en el evento'.`
    },

    {
        title: "Barra de Estado y Actualizaciones",
        content: `La barra inferior muestra la salud del sistema en tiempo real. 
        El indicador verde (Rust + Tauri) confirma que la base de datos está conectada. 
        A su lado verá su perfil de usuario activo y el total de asambleas creadas. 
        A la derecha encontrará la versión actual del software y el botón de 'Actualizar' 
        (esta función se activará en futuras versiones para descargar mejoras automáticamente).`
    },
];