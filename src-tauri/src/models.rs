use serde::{Deserialize, Serialize};

// ==========================================
// 1. ESTRUCTURAS BÁSICAS (TABLAS)
// ==========================================

#[derive(Debug, Serialize, Deserialize)]
pub struct Local { 
    pub id: i32, 
    pub nombre: String, 
    pub direccion: Option<String>, 
    pub capacidad: Option<i32> 
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Congregacion { 
    pub id: i32, 
    pub nombre: String, 
    pub circuito: Option<String>, 
    pub numero_congregacion: Option<String> 
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
    
    // Este campo es opcional. Lo usamos cuando traemos la lista con el nombre de la congregación.
    // En las inserciones simples, puede ser None.
    pub nombre_congregacion: Option<String>, 
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Asamblea {
    pub id: i32,
    pub tema: String,
    pub fecha: String,
    pub local_id: Option<i32>,
    pub presidente_id: Option<i32>,
    // Campos opcionales para la UI
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
    
    // Datos del Orador
    pub orador_id: Option<i32>,
    pub nombre_orador: Option<String>,
    pub congregacion_orador: Option<String>,
    pub email_orador: Option<String>,
    pub telefono_orador: Option<String>,
    
    // Estados
    pub es_video: bool,
    pub estado: Option<String>,
    pub esta_presente: bool, 
}

// ==========================================
// 3. ESTRUCTURAS DE OFICINA
// ==========================================

// Usada para devolver datos al frontend (DTO)
#[derive(Debug, Serialize, Deserialize)]
pub struct AsignacionEspecialDTO {
    pub id: i32,
    pub tipo_asignacion: String,
    pub persona_id: i32,
    pub nombre_completo: String,
    pub nombre_congregacion: Option<String>,
}

// Usada para compatibilidad con código antiguo si existe
#[derive(Debug, Serialize, Deserialize)]
pub struct AsignacionEspecial { 
    pub id: i32, 
    pub dia: String, 
    pub tipo_asignacion: String, 
    pub persona_id: Option<i32>, 
    pub nombre_persona: Option<String> 
}