// src/utils/exportar.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
// --- HELPER: Convierte booleanos a texto legible ---
const check = (valor: boolean) => valor ? 'SÍ' : '-';
const estado = (txt: string) => txt === 'Confirmado' ? 'SÍ' : '-';

// ==========================================
// 1. EXPORTAR PROGRAMA (Discursos)
// ==========================================
export async function exportarProgramaPDF(partes: any[], dia: string) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(`Programa - ${dia}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 14, 26);

  const columnas = ["Hora", "Tema", "Orador", "Bosquejo", "Recibido", "Presente", "Ensayó"];
  const filas = partes.map(p => [
    p.hora_inicio,
    p.es_video ? `(VIDEO) ${p.tema}` : p.tema,
    p.nombre_orador || "---",
    p.numero_bosquejo || "",
    estado(p.estado),
    check(p.esta_presente),
    check(p.ensayo_terminado)
  ]);

  autoTable(doc, {
    startY: 35,
    head: [columnas],
    body: filas,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 60 },
      3: { cellWidth: 20 },
    }
  });

  // Convertir el PDF a bytes
  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBytes = new Uint8Array(pdfArrayBuffer);

  // Pedir al usuario dónde guardar
  const defaultPath = `Programa_${dia}.pdf`;
  const selectedPath = await save({
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  // Si el usuario cancela, no hacer nada
  if (!selectedPath) return;

  // Guardar el archivo en la ruta elegida
  await writeFile(selectedPath, pdfBytes);

  // Avisar al usuario
  alert(`PDF guardado en: ${selectedPath}`);
}

// ==========================================
// 2. EXPORTAR OFICINA (Presidente, Oración, etc)
// ==========================================
export async function exportarOficinaPDF(oficina: any, personal: any[], dia: string) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(`Asignaciones de Oficina - ${dia}`, 14, 20);

  let cursorY = 30;

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
        estado(data.estado),
        check(data.esta_presente),
        check(data.ensayo_terminado)
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
    headStyles: { fillColor: [71, 85, 105] }
  });

  // @ts-ignore
  cursorY = doc.lastAutoTable.finalY + 15;

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
      headStyles: { fillColor: [16, 185, 129] }
    });
  }

  // Convertir PDF a bytes
  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBytes = new Uint8Array(pdfArrayBuffer);

  // Diálogo para guardar
  const defaultPath = `Oficina_${dia}.pdf`;
  const selectedPath = await save({
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (!selectedPath) return;

  await writeFile(selectedPath, pdfBytes);
  alert(`PDF guardado en: ${selectedPath}`);
}