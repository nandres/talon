import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accionesPara, leerRango } from '../lib/agenda.ts';

test('lee el tstzrange que devuelve PostgREST', () => {
  assert.deepEqual(leerRango('["2026-11-14 12:00:00+00","2026-11-14 12:30:00+00")'), {
    inicio: '2026-11-14T12:00:00.000Z', fin: '2026-11-14T12:30:00.000Z',
  });
  assert.equal(leerRango('["2026-11-14 09:00:00-03","2026-11-14 10:00:00-03")').inicio, '2026-11-14T12:00:00.000Z');
});

test('las acciones de la ficha siguen las transiciones de la base', () => {
  assert.deepEqual(accionesPara('confirmada', false).map(a => a.estado), ['cancelada']);
  assert.deepEqual(accionesPara('confirmada', true).map(a => a.estado), ['completada', 'ausente', 'cancelada']);
  assert.deepEqual(accionesPara('pendiente_pago', false).map(a => a.estado), ['confirmada', 'cancelada']);
  assert.deepEqual(accionesPara('ausente', true).map(a => a.estado), ['confirmada']);
  assert.deepEqual(accionesPara('cancelada', true), []);
});
