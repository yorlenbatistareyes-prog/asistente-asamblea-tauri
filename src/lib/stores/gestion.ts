import { writable } from 'svelte/store';

export const totalAsistencia = writable<number>(0);
export const totalBautismos = writable<number>(0);
export const congregacionesReportadas = writable<number>(0);
export const totalCongregaciones = writable<number>(0);
export const oradoresPendientes = writable<Array<{ nombre: string; tema: string; estado?: string }>>([]);
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

export function setResumen(values: {
  totalAsistencia?: number;
  totalBautismos?: number;
  congregacionesReportadas?: number;
  totalCongregaciones?: number;
  oradoresPendientes?: Array<{ nombre: string; tema: string; estado?: string }>;
  notasRapidas?: Array<{ id: string; texto: string; creado: number }>;
}) {
  if (values.totalAsistencia !== undefined) totalAsistencia.set(values.totalAsistencia);
  if (values.totalBautismos !== undefined) totalBautismos.set(values.totalBautismos);
  if (values.congregacionesReportadas !== undefined) congregacionesReportadas.set(values.congregacionesReportadas);
  if (values.totalCongregaciones !== undefined) totalCongregaciones.set(values.totalCongregaciones);
  if (values.oradoresPendientes !== undefined) oradoresPendientes.set(values.oradoresPendientes);
  if (values.notasRapidas !== undefined) setNotas(values.notasRapidas);
}

export function resetResumen() {
  totalAsistencia.set(0);
  totalBautismos.set(0);
  congregacionesReportadas.set(0);
  totalCongregaciones.set(0);
  oradoresPendientes.set([]);
}
