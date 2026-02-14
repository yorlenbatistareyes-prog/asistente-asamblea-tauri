// Definimos la estructura para que TypeScript nos ayude
export interface AyudaItem {
    title: string;
    content: string;
    // isOpen es opcional aquí porque lo gestionará la vista, 
    // pero lo definimos en la interfaz para saber que existirá.
    isOpen?: boolean; 
}

export const guiaUsuario: AyudaItem[] = [
    {
        title: "Configuración Inicial y Perfil",
        content: "Comience configurando su perfil en la sección 'Cuenta y Seguridad'. Ingrese su nombre, teléfono y correo electrónico (incluyendo jwpub si aplica). Estos datos son fundamentales ya que se utilizarán para firmar automáticamente los correos electrónicos y las cartas generadas por el sistema."
    },
    {
        title: "Gestión del Programa y Oradores",
        content: "En la sección principal 'Programa', puede cargar o crear la estructura de la asamblea. Utilice la lista de oradores para asignar discursos arrastrando los nombres o seleccionándolos de la lista desplegable. Los indicadores de estado (Confirmado, Pendiente) le ayudarán a visualizar el progreso de las asignaciones."
    },
    {
        title: "Uso de Plantillas de Correo Electrónico",
        content: "Diríjase a la pestaña 'Plantillas de correo' dentro de esta configuración. Seleccione una plantilla (por ejemplo, 'Oradores') y pulse 'Editar'. Se abrirá un editor de texto completo. Puede redactar el mensaje y utilizar el panel derecho para insertar 'Marcadores de posición' (ej. [[Nombre]], [[Tema]]). Al enviar el correo, el sistema reemplazará estos marcadores con los datos reales del hermano."
    },
    {
        title: "Plantillas de Mensajes Rápidos (WhatsApp)",
        content: "En la pestaña 'General', puede predefinir los mensajes para WhatsApp. Estos textos se utilizarán cuando pulse el icono de WhatsApp junto al nombre de un orador en el programa principal. Al igual que los correos, puede incluir marcadores básicos para personalizar el mensaje automáticamente."
    },
    {
        title: "Generación de Correspondencia y Cartas",
        content: "La sección 'Correspondencia' del menú principal permite generar cartas formales en formato PDF. El sistema utiliza plantillas predefinidas y 'mezcla' los datos del programa (oradores, presidentes, fechas) con el documento. Asegúrese de revisar la configuración de márgenes en el editor de correspondencia antes de imprimir."
    },
    {
        title: "Marcadores de Posición y Mezcla de Datos",
        content: "Los marcadores son textos entre corchetes dobles, por ejemplo [[Nombre]]. Cuando el sistema genera un correo o una carta, busca estos marcadores y los sustituye por la información correspondiente de la base de datos. Si coloca un marcador en el campo 'Asunto' de una plantilla, también será reemplazado correctamente."
    },
    {
        title: "Envío de Correos y Cuentas JWPub",
        content: "Para el envío de asignaciones, el sistema intentará abrir su cliente de correo predeterminado. Si utiliza una cuenta institucional (jwpub.org), se recomienda tener la sesión iniciada en Outlook Web. Puede forzar el uso de su aplicación de escritorio activando la opción 'Utilice el cliente de correo electrónico en lugar de Outlook Online' en la pestaña General."
    },
    {
        title: "Oficina del Presidente",
        content: "Esta herramienta está diseñada para el presidente de la asamblea. Permite visualizar un resumen de las sesiones, gestionar incidencias en tiempo real y añadir notas para los oradores o el personal auxiliar durante el evento."
    }
];
