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
        content: `La información personal se gestiona en la sección **General** de Configuración. Las plantillas se editan aparte en **Configuración > Comunicaciones**, donde se organizan por correo, WhatsApp y cartas imprimibles. El sistema no agrega una firma personal automáticamente: si desea una firma en un mensaje o documento, inclúyala en el contenido de esa plantilla.`
    },

    {
        title: "Gestión del Programa y Oradores",
        content: `El proceso comienza en la pantalla principal creando una nueva asamblea. 
        Al entrar en la tarjeta del evento, accederá a un panel lateral con todas las herramientas: 
        desde el 'Panel de control' con estadísticas y monitor, hasta la importación de 'Congregaciones' 
        y 'Personas' mediante archivos CSV de JW Hub. En la sección 'Programa y Oradores', podrá
        importar el programa y abrir **Programa**. En las tarjetas puede imprimir una carta PDF, preparar un correo de asignación o recordatorio y abrir un recordatorio por WhatsApp. Las opciones de correo masivo están en el menú de correo de Programa. También puede actualizar el seguimiento de confirmación, ensayo y presencia.`
    },

    {
        title: "Plantillas de correo: para qué sirve cada una",
        content: `Edite las plantillas en **Configuración > Comunicaciones > Plantillas de correo**. Pulse **Editar** en la tarjeta correspondiente. Los correos se preparan como borradores en JWPub; la aplicación completa destinatario, asunto y mensaje, pero usted revisa y pulsa Enviar en el servicio de correo.

**Plantillas principales**
• **Asignación individual al orador** (programa_individual): botón **Enviar Carta** de una tarjeta en **Programa**. Aunque el botón se llame “Carta”, abre un correo con los datos de la asignación.
• **Recordatorio individual de asignación** (programa_recordatorio): botón de recordatorio por correo en **Programa**.
• **Aviso general a varios oradores** (masivo_general): menú de correos de **Programa > JWPUB a todos**. Se dirige a los oradores con correo de las partes visibles del programa.
• **Recordatorio general a varios oradores** (masivo_recordatorio): **Programa > JWPUB Recordatorio**, para los mismos destinatarios visibles.
• **Contacto desde la lista de oradores** (contacto_orador): acción de correo JWPub en **Lista de oradores**.
• **Contacto desde el registro de oradores** (registro_orador): acción de correo individual y envío masivo de **Registro de oradores**.

**Opciones avanzadas**
• **Auxiliares de Oficina** (oficina): acción de correo del auxiliar en **Oficina**; también se usa en **Programa** cuando la asignación corresponde a Oficina.
• **Integrantes del Comité** (comite): acciones de correo del Comité y de contacto individual en **Comité**; también se usa desde **Programa** para asignaciones del Comité.
• **Equipos de departamentos** (departamentos): opción de correo de audio/video en **Comité** y asignaciones de departamentos en **Programa**.

La plantilla que se escoge depende de la acción y, en Programa, del rol asignado. Los envíos masivos usan un contexto general, no datos individuales de cada destinatario.`
    },
    {
        title: "Plantillas de WhatsApp: para qué sirve cada una",
        content: `Edite los mensajes en **Configuración > Comunicaciones > Plantillas de WhatsApp**. Al pulsar el botón de WhatsApp, la aplicación prepara el mensaje con los datos disponibles y abre WhatsApp (o su versión web); usted revisa y lo envía.

**Plantillas principales**
• **Asignación y recordatorio del programa** (programa_recordatorio): es la única plantilla de WhatsApp para oradores del programa. La usa el botón **Recordatorio por WhatsApp** de la tarjeta en **Programa**. Los marcadores que escriba en la plantilla se sustituyen con los datos de la asignación. Si la parte requiere ensayo, la fecha, hora, lugar y notas se añaden automáticamente al mensaje; si prefiere decidir dónde aparece esa información, inserte en su lugar **[[Información completa de los ensayos]]** o los marcadores individuales del grupo **Ensayos**.
• **Contacto desde la lista de oradores** (contacto_orador): acción de WhatsApp en **Lista de oradores**.
• **Contacto desde el registro de oradores** (registro_orador): botón de WhatsApp de una fila en **Registro de oradores**.

**Opciones avanzadas**
• **Auxiliares de Oficina** (oficina): botón de WhatsApp de un auxiliar en **Oficina**; también para roles de Oficina desde **Programa**.
• **Integrantes del Comité** (comite): botón de WhatsApp de una persona en **Comité**; también para roles de Comité desde **Programa**.
• **Equipos de departamentos** (departamentos): asignaciones de departamentos desde **Programa**.
`
    },
    {
        title: "Cartas imprimibles: plantillas y botón que las usa",
        content: `Edite los documentos en **Configuración > Comunicaciones > Cartas imprimibles**. En una tarjeta del **Programa**, el botón **Imprimir carta** genera el PDF con la plantilla que corresponde al tipo de parte o rol:

• **Oradores** (ID oradores): se usa para las partes del programa y como plantilla general para otros roles sin una variante específica, incluidos los de plataforma.
• **Presidentes** (ID presidentes): se usa cuando el rol de la tarjeta corresponde a un presidente.
• **Oraciones** (ID oraciones): se usa para los roles de oración.

El botón **Enviar Carta** de Programa no imprime ni usa estas plantillas PDF: abre un borrador de correo con la plantilla de correo de asignación o la plantilla del equipo según el rol.

Actualmente, las cartas se generan desde las tarjetas de **Programa**. No hay un botón de impresión conectado a la plantilla de oficina.`
    },
    {
        title: "Marcadores de Posición y Mezcla de Datos",
        content: `Inserte los marcadores desde el selector del editor; se escriben entre corchetes dobles, por ejemplo **[[Nombre]]**, **[[Tema]]**, **[[Congregación]]** o **[[Fecha]]**. Correo, WhatsApp y PDF usan el mismo reemplazador, por lo que también se sustituyen en el asunto del correo.

El valor sale de la persona, la asignación, los datos de la asamblea o la información de ensayo disponible. Si un dato opcional no existe, algunos marcadores quedan vacíos o muestran un texto como “No aplica” o “Por definir”. **[[Segundo nombre]]** y **[[Enlace(s) del Bosquejo]]** dependen de que esos datos estén registrados; no se inventan.

Si edita o pega un marcador manualmente, respete exactamente su escritura y acentos. El marcador **[[Congregación]]** está disponible y se reemplaza por la congregación registrada.`
    },
    {
        title: "Envío de Correos y Cuentas JWPub",
        content: `Para el envío de asignaciones, el sistema intentará abrir su cliente 
        de correo predeterminado. Si utiliza una cuenta institucional (jwpub.org), 
        se recomienda tener la sesión iniciada en Outlook Web.`
    },
    
    {
        title: "Oficina del Presidente",
        content: `Herramienta administrativa para gestionar al personal de apoyo directo 
        del programa (Presidentes de sesión, Oraciones, Consejeros y Ayudantes de plataforma). 
        Permite organizar estas asignaciones por bloques (Mañana/Tarde), generar y enviar 
        su correspondencia oficial, y llevar un control de cumplimiento mediante los 
        indicadores de estado: 'Asignación recibida', 'Ensayo realizado' y 'Presente en el evento'.`
    },
    
];
