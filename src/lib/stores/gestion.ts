import { writable } from 'svelte/store';

export const totalAsistencia = writable<number>(0);
export const totalBautismos = writable<number>(0);
export const congregacionesReportadas = writable<number>(0);
export const totalCongregaciones = writable<number>(0);
export const oradoresPendientes = writable<Array<{ id: number; nombre: string; tema: string; estado?: string }>>([]);
export const notasRapidas = writable<Array<{ id: string; texto: string; creado: number }>>([]);

function persistNotas(list: Array<{ id: string; texto: string; creado: number }>) {
  try { localStorage.setItem('notasRapidas', JSON.stringify(list)); } catch (e) { /* ignore */ }
}

export function addNota(texto: string) {
  const nueva = { id: Date.now().toString(), texto, creado: Date.now() };
  notasRapidas.update(current => {
    const next = [nueva, ...current];
    persistNotas(next);
    return next;
  });
}

export function removeNota(id: string) {
  notasRapidas.update(current => {
    const next = current.filter(n => n.id !== id);
    persistNotas(next);
    return next;
  });
}

export function setNotas(list: Array<{ id: string; texto: string; creado: number }>) {
  notasRapidas.set(list || []);
  persistNotas(list || []);
}

// Solicita a la UI que confirme/unconfirm un orador (manejado por Programa)
export function solicitarConfirmacionParte(parteId: number) {
  try {
    window.dispatchEvent(new CustomEvent('confirmar-parte', { detail: { id: parteId } }));
  } catch (e) { console.warn('No se pudo despachar evento confirmar-parte', e); }
}

export function setResumen(values: {
  totalAsistencia?: number;
  totalBautismos?: number;
  congregacionesReportadas?: number;
  totalCongregaciones?: number;
  oradoresPendientes?: Array<{ id: number; nombre: string; tema: string; estado?: string }>;
  notasRapidas?: Array<{ id: string; texto: string; creado: number }>;
}) {
  if (values.totalAsistencia !== undefined) totalAsistencia.set(values.totalAsistencia);
  if (values.totalBautismos !== undefined) totalBautismos.set(values.totalBautismos);
  if (values.congregacionesReportadas !== undefined) congregacionesReportadas.set(values.congregacionesReportadas);
  if (values.totalCongregaciones !== undefined) totalCongregaciones.set(values.totalCongregaciones);
  if (values.oradoresPendientes !== undefined) oradoresPendientes.set(values.oradoresPendientes);
  if (values.notasRapidas !== undefined) setNotas(values.notasRapidas);
}

// Helpers to increment/decrement numeric resumen values and persist
export function incrementarAsistencia(n: number = 1) {
  totalAsistencia.update(v => {
    const next = (v || 0) + n;
    persistResumenPartial({ totalAsistencia: next });
    return next;
  });
}

export function setResumenValue(obj: { totalAsistencia?: number; totalBautismos?: number; congregacionesReportadas?: number; totalCongregaciones?: number }) {
  setResumen(obj);
  persistResumenPartial(obj);
}

function persistResumenPartial(obj: any) {
  try {
    const cur = JSON.parse(localStorage.getItem('resumen') || '{}');
    const next = { ...cur, ...obj };
    localStorage.setItem('resumen', JSON.stringify(next));
  } catch (e) { /* ignore */ }
}

export function resetResumen() {
  totalAsistencia.set(0);
  totalBautismos.set(0);
  congregacionesReportadas.set(0);
  totalCongregaciones.set(0);
  oradoresPendientes.set([]);
}
