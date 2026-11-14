import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnosLibres, unirPorHorario, type ParametrosDisponibilidad } from '../lib/disponibilidad.ts';
import { localAUtc, partesLocales, desfaseMinutos } from '../lib/tiempo.ts';

const ZONA = 'America/Asuncion';
// Martes 17/11/2026
const base: ParametrosDisponibilidad = {
  fecha: '2026-11-17',
  zona: ZONA,
  profesionales: ['ramon'],
  franjas: [
    { profesionalId: 'ramon', diaSemana: 2, desde: '09:00', hasta: '11:00' },
    { profesionalId: 'lucas', diaSemana: 2, desde: '09:00', hasta: '10:00' },
  ],
  ocupados: [],
  duracionMin: 30,
  intervaloMin: 15,
  ahora: new Date('2026-11-16T12:00:00Z'),
  anticipacionMin: 60,
  ventanaDias: 30,
};

const horas = (ts: { inicio: Date }[]) => ts.map(t => partesLocales(t.inicio, ZONA).hora);

test('Asunción está en UTC-3 todo el año', () => {
  assert.equal(desfaseMinutos(new Date('2026-01-15T12:00:00Z'), ZONA), -180);
  assert.equal(desfaseMinutos(new Date('2026-07-15T12:00:00Z'), ZONA), -180);
  assert.equal(localAUtc('2026-11-17', '09:00', ZONA).toISOString(), '2026-11-17T12:00:00.000Z');
});

test('una franja de 2 h con turnos de 30 min cada 15 da 7 opciones', () => {
  assert.deepEqual(horas(turnosLibres(base)), ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30']);
});

test('el último turno termina justo al cierre, nunca después', () => {
  const t = turnosLibres({ ...base, duracionMin: 45 });
  assert.equal(horas(t).at(-1), '10:15');
});

test('un turno ocupado saca todos los horarios que lo pisan', () => {
  const ocupados = [{ profesionalId: 'ramon', inicio: localAUtc('2026-11-17', '09:30', ZONA), fin: localAUtc('2026-11-17', '10:00', ZONA) }];
  assert.deepEqual(horas(turnosLibres({ ...base, ocupados })), ['09:00', '10:00', '10:15', '10:30']);
});

test('lo ocupado de otro profesional no afecta', () => {
  const ocupados = [{ profesionalId: 'lucas', inicio: localAUtc('2026-11-17', '09:00', ZONA), fin: localAUtc('2026-11-17', '11:00', ZONA) }];
  assert.equal(turnosLibres({ ...base, ocupados }).length, 7);
});

test('respeta la anticipación mínima', () => {
  const ahora = localAUtc('2026-11-17', '08:20', ZONA);
  assert.deepEqual(horas(turnosLibres({ ...base, ahora, anticipacionMin: 60 })).slice(0, 2), ['09:30', '09:45']);
});

test('no ofrece nada fuera de la ventana de reservas', () => {
  assert.equal(turnosLibres({ ...base, ventanaDias: 0 }).length, 0);
});

test('un día sin franjas no tiene turnos', () => {
  assert.equal(turnosLibres({ ...base, fecha: '2026-11-16' }).length, 0); // lunes
});

test('una franja que no arranca en múltiplo del intervalo se alinea hacia arriba', () => {
  const franjas = [{ profesionalId: 'ramon', diaSemana: 2, desde: '09:10', hasta: '10:00' }];
  assert.deepEqual(horas(turnosLibres({ ...base, franjas })), ['09:15', '09:30']);
});

test('"cualquier profesional" une horarios y dice quién puede', () => {
  const unidos = unirPorHorario(turnosLibres({ ...base, profesionales: ['ramon', 'lucas'] }));
  assert.equal(unidos.length, 7);
  assert.deepEqual(unidos[0].profesionales.sort(), ['lucas', 'ramon']);
  assert.deepEqual(unidos.at(-1)!.profesionales, ['ramon']);
});
