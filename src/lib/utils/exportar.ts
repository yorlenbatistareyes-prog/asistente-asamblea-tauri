// src/utils/exportar.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- HELPER: Convierte booleanos a texto legible ---
const check = (valor: boolean) => valor ? 'SÍ' : '-';
const estado = (txt: string) => txt === 'Confirmado' ? 'SÍ' : '-';

// ==========================================
// 1. EXPORTAR PROGRAMA (Discursos)
// ==========================================
export function exportarProgramaPDF(partes: any[], dia: string) {
  const doc = new jsPDF();

  // Título
  doc.setFontSize(18);
  doc.text(`Programa - ${dia}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 14, 26);

  // Columnas
  const columnas = ["Hora", "Tema", "Orador", "Bosquejo", "Recibido", "Presente", "Ensayó"];

  // Filas
  const filas = partes.map(p => [
    p.hora_inicio,
    p.es_video ? `(VIDEO) ${p.tema}` : p.tema,
    p.nombre_orador || "---",
    p.numero_bosquejo || "",
    estado(p.estado),       // Recibido
    check(p.esta_presente), // Presente
    check(p.ensayo_terminado) // Ensayó
  ]);

  autoTable(doc, {
    startY: 35,
    head: [columnas],
    body: filas,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }, // Azul primario
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 15 }, // Hora
      1: { cellWidth: 60 }, // Tema
      3: { cellWidth: 20 }, // Bosquejo
    }
  });

  doc.save(`Programa_${dia}.pdf`);
}

// ==========================================
// 2. EXPORTAR OFICINA (Presidente, Oración, etc)
// ==========================================
export function exportarOficinaPDF(oficina: any, personal: any[], dia: string) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(`Asignaciones de Oficina - ${dia}`, 14, 20);

  let cursorY = 30;

  // --- SECCIÓN 1: PUESTOS CLAVE (Presidente, Oración, etc) ---
  const mapeoLabels: any = {
    'presidente_manana': 'Presidente (Mañana)',
    'oracion_apertura': 'Oración Apertura',
    'bosquejos_manana': 'Bosquejos (Mañana)',
    'plataforma_manana': 'Plataforma (Mañana)',
    'presidente_tarde': 'Presidente (Tarde)',
    'oracion_conclusion': 'Oración Conclusión',
    'bosquejos_tarde': 'Bosquejos (Tarde)',
    'plataforma_tarde': 'Plataforma (Tarde)'
  };

  const filasPuestos = [];
  
  // Recorremos las claves fijas para mantener el orden
  const claves = [
    'presidente_manana', 'oracion_apertura', 'bosquejos_manana', 'plataforma_manana',
    'presidente_tarde', 'oracion_conclusion', 'bosquejos_tarde', 'plataforma_tarde'
  ];

  for (const key of claves) {
    const data = oficina[key];
    if (data) {
      filasPuestos.push([
        mapeoLabels[key] || key,
        data.nombre_completo || data.nombre_orador,
        estado(data.estado),       // Recibido
        check(data.esta_presente), // Presente
        check(data.ensayo_terminado) // Ensayó
      ]);
    } else {
      filasPuestos.push([mapeoLabels[key], "(Sin asignar)", "-", "-", "-"]);
    }
  }

  doc.setFontSize(14);
  doc.text("Puestos Principales", 14, cursorY);
  
  autoTable(doc, {
    startY: cursorY + 5,
    head: [["Puesto", "Hermano Asignado", "Recibido", "Presente", "Ensayo"]],
    body: filasPuestos,
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105] } // Gris oscuro
  });

  // @ts-ignore
  cursorY = doc.lastAutoTable.finalY + 15;

  // --- SECCIÓN 2: PERSONAL ADICIONAL ---
  if (personal && personal.length > 0) {
    doc.text("Personal Adicional", 14, cursorY);

    const filasPersonal = personal.map(p => [
      p.nombre_completo,
      estado(p.estado),
      check(p.esta_presente),
      check(p.ensayo_terminado)
    ]);

    autoTable(doc, {
      startY: cursorY + 5,
      head: [["Nombre", "Recibido", "Presente", "Ensayo"]],
      body: filasPersonal,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] } // Verde
    });
  }

  doc.save(`Oficina_${dia}.pdf`);
}