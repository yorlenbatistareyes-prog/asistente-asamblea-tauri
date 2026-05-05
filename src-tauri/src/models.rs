use serde::{Deserialize, Serialize};

// ==========================================
// 1. ESTRUCTURAS BÁSICAS (TABLAS)
// ==========================================

#[derive(Debug, Serialize, Deserialize)]
pub struct Local {
    pub id: i32,
    pub nombre: String,
    pub direccion: Option<String>,
    pub ciudad: Option<String>,
    pub estado: Option<String>,
    pub capacidad: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Congregacion {
    pub id: i32,
    pub nombre: String,
    pub circuito: Option<String>,
    pub numero_congregacion: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Persona {
    pub id: i32,
    pub nombre_completo: String,
    pub genero: String,
    pub privilegios: Option<String>,
    pub id_congregacion: Option<i32>,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub nombre_congregacion: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Asamblea {
    pub id: i32,
    pub tema: String,
    pub fecha: String,
    pub local_id: Option<i32>,
    pub identificador: Option<String>,
    // --- Campos del comité ---
    pub coordinador_id: Option<i32>,
    pub coordinador_aux_id: Option<i32>,
    pub prog_super_id: Option<i32>,
    pub prog_aux_id: Option<i32>,
    pub aloj_super_id: Option<i32>,
    pub aloj_aux_id: Option<i32>,
    pub audio_video_super_id: Option<i32>,
    pub video_super_id: Option<i32>,
    pub audio_super_id: Option<i32>,
    pub plataforma_super_id: Option<i32>,
    pub bautismo_super_id: Option<i32>,
    pub bautismo_aux_id: Option<i32>,
    // --- Otros campos existentes ---
    pub ensayo_lugar: String,
    pub ensayo_fecha: String,
    pub ensayo_hora: String,
    pub ensayo_notas: String,
    pub recorridos_info: String,
    pub instrucciones_esp: String,
    pub jw_stream_studio: bool,
    pub nombre_local: Option<String>,
}

// ==========================================
// 2. ESTRUCTURAS DEL PROGRAMA
// ==========================================

#[derive(Debug, Serialize, Deserialize)]
pub struct PartePrograma {
    pub id: i32,
    pub dia: String,
    pub sesion: String,
    pub hora_inicio: Option<String>,
    pub tema: String,
    pub tipo: Option<String>,
    pub duracion: Option<i32>,
    pub orador_id: Option<i32>,
    pub nombre_orador: Option<String>,
    pub congregacion_orador: Option<String>,
    pub circuito_orador: Option<String>,
    pub email_orador: Option<String>,
    pub telefono_orador: Option<String>,
    pub es_video: bool,
    pub estado: Option<String>,
    pub esta_presente: bool,
    pub numero_bosquejo: Option<String>,
    pub ensayo_terminado: bool, 
    // ✅ NUEVOS CAMPOS PARA LOS FILTROS
    pub fuente: Option<String>,
    pub es_betelita: bool,
    pub es_interprete: bool,
    pub es_visitante: bool,
    pub requiere_ensayo: bool,
    pub fecha_ensayo: Option<String>,
    pub hora_ensayo: Option<String>,
    pub lugar_ensayo: Option<String>,
    pub notas_ensayo: Option<String>,

    pub check_viernes: bool,
    pub check_dia: bool,
    pub check_30m: bool,
}

// ==========================================
// 3. ESTRUCTURAS DE OFICINA
// ==========================================

#[derive(Debug, Serialize, Deserialize)]
pub struct AsignacionEspecialDTO {
    pub id: i32,
    pub tipo_asignacion: String,
    pub persona_id: i32,
    pub nombre_completo: String,
    pub nombre_congregacion: Option<String>,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub estado: Option<String>,
    pub esta_presente: bool,
    pub ensayo_terminado: bool,
    pub responsabilidades: Option<String>,
    pub disponibilidad: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AsignacionEspecial {
    pub id: i32,
    pub dia: String,
    pub tipo_asignacion: String,
    pub persona_id: Option<i32>,
    pub nombre_persona: Option<String>,
}

// ==========================================
// 4. ESTRUCTURAS DE CONFIGURACIÓN GLOBAL
// ==========================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConfiguracionGeneral {
    pub nombre: Option<String>,
    pub segundo_nombre: Option<String>,
    pub apellido: Option<String>,
    pub sufijo: Option<String>,
    pub email: Option<String>,
    pub email_jwpub: Option<String>,
    pub movil: Option<String>,
    pub identificador: Option<String>,
    pub fecha_creacion: Option<String>,
    pub tema: Option<String>,
    pub idioma: Option<String>,
}
