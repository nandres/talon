import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { firmar, verificar } from '../lib/pagos/firma.ts';
import { turnosLibres, type Franja } from '../lib/disponibilidad.ts';
import { partesLocales, sumarDias } from '../lib/tiempo.ts';

// ── Firma de los avisos (sin base) ──────────────────────────────────────────

const SECRETO = 'secreto-de-prueba';

test('un aviso bien firmado pasa', () => {
  const cuerpo = '{"id":"evt_1"}';
  assert.deepEqual(verificar(cuerpo, firmar(cuerpo, SECRETO), SECRETO), { ok: true });
});

test('si alguien toca el cuerpo, la firma no cierra', () => {
  const firma = firmar('{"monto_gs":36000}', SECRETO);
  assert.deepEqual(verificar('{"monto_gs":1}', firma, SECRETO), { ok: false, motivo: 'firma' });
});

test('un aviso viejo se rechaza aunque esté bien firmado', () => {
  const marca = Math.floor(Date.now() / 1000) - 3600;
  assert.deepEqual(verificar('{}', firmar('{}', SECRETO, marca), SECRETO), { ok: false, motivo: 'vencida' });
});

test('sin cabecera o con otro secreto, no pasa', () => {
  assert.equal(verificar('{}', null, SECRETO).ok, false);
  assert.deepEqual(verificar('{}', firmar('{}', 'otro'), SECRETO), { ok: false, motivo: 'firma' });
});

// ── Circuito de pago contra Supabase local ──────────────────────────────────

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54421';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const SECRETA = process.env.SUPABASE_SECRET_KEY ?? '';
const disponible = ANON !== '' && SECRETA !== '' && await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON } }).then(r => r.ok, () => false);
if (process.env.CI && !disponible) throw new Error('En CI la base tiene que estar levantada: no se saltean estas pruebas.');
const opciones = { skip: disponible ? false : 'Supabase local no está corriendo' };

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const admin = createClient(URL, SECRETA, { auth: { persistSession: false } });
const ZONA = 'America/Asuncion';
const PAULA = '22222222-0000-4000-8000-0000000000b1';
const SESION = '22222222-0000-4000-8000-0000000000d2'; // 120.000 → seña 36.000

async function reservarConSena(telefono: string) {
  const { data: franjas } = await anon.from('horarios').select('profesional_id, dia_semana, desde, hasta').eq('profesional_id', PAULA);
  const { data: ocupados } = await anon.rpc('agenda_ocupada', { p_slug: 'kine-mburucuya', p_desde: new Date().toISOString(), p_hasta: new Date(Date.now() + 30 * 864e5).toISOString() });
  const hoy = partesLocales(new Date(), ZONA).fecha;
  for (let i = 1; i < 28; i++) {
    const libres = turnosLibres({
      fecha: sumarDias(hoy, i), zona: ZONA, profesionales: [PAULA],
      franjas: (franjas ?? []).map((f): Franja => ({ profesionalId: f.profesional_id, diaSemana: f.dia_semana, desde: f.desde.slice(0, 5), hasta: f.hasta.slice(0, 5) })),
      ocupados: (ocupados ?? []).map((o: { profesional_id: string; inicio: string; fin: string }) => ({ profesionalId: o.profesional_id, inicio: new Date(o.inicio), fin: new Date(o.fin) })),
      duracionMin: 40, intervaloMin: 15, ahora: new Date(), anticipacionMin: 180, ventanaDias: 30,
    });
    if (libres.length) {
      const { data, error } = await anon.rpc('reservar_turno', { p_slug: 'kine-mburucuya', p_servicio: SESION, p_profesional: PAULA, p_inicio: libres[0].inicio.toISOString(), p_nombre: 'Pago de Prueba', p_telefono: telefono });
      if (error) throw error;
      return data[0] as { codigo: string; estado: string; sena_gs: number };
    }
  }
  throw new Error('sin lugar');
}

test('el público no puede abrir cobros ni registrar avisos', opciones, async () => {
  const a = await anon.rpc('abrir_cobro', { p_codigo: 'AAAAAAAA', p_proveedor: 'x' });
  const b = await anon.rpc('registrar_aviso_pago', { p_evento: 'e', p_proveedor: 'x', p_referencia: 'r', p_tipo: 'pago.aprobado', p_monto: 1 });
  assert.notEqual(a.error, null);
  assert.notEqual(b.error, null);
});

test('un pago aprobado confirma el turno una sola vez, aunque el aviso llegue repetido', opciones, async () => {
  const r = await reservarConSena('0981777001');
  assert.equal(r.estado, 'pendiente_pago');
  assert.equal(Number(r.sena_gs), 36000);

  const { data: cobro } = await admin.rpc('abrir_cobro', { p_codigo: r.codigo, p_proveedor: 'simulada' });
  const ref = cobro[0].referencia;
  const otra = await admin.rpc('abrir_cobro', { p_codigo: r.codigo, p_proveedor: 'simulada' });
  assert.equal(otra.data[0].referencia, ref, 'reabrir el cobro reutiliza el mismo');

  const aviso = { p_evento: `evt_${r.codigo}`, p_proveedor: 'simulada', p_referencia: ref, p_tipo: 'pago.aprobado', p_monto: 36000 };
  assert.equal((await admin.rpc('registrar_aviso_pago', aviso)).data, 'confirmada');
  assert.equal((await admin.rpc('registrar_aviso_pago', aviso)).data, 'repetido');
  assert.equal((await admin.rpc('registrar_aviso_pago', { ...aviso, p_evento: `evt_${r.codigo}_b` })).data, 'repetido');

  const { data: t } = await anon.rpc('turno_por_codigo', { p_codigo: r.codigo });
  assert.equal(t[0].estado, 'confirmada');
  assert.equal(t[0].pago, 'aprobado');
  const { count } = await admin.from('mensajes').select('id', { count: 'exact', head: true }).eq('tipo', 'confirmacion').eq('reserva_id', (await admin.from('reservas').select('id').eq('codigo', r.codigo).single()).data!.id);
  assert.equal(count, 1);
});

test('un aviso con otro monto se rechaza', opciones, async () => {
  const r = await reservarConSena('0981777002');
  const { data: cobro } = await admin.rpc('abrir_cobro', { p_codigo: r.codigo, p_proveedor: 'simulada' });
  const { error } = await admin.rpc('registrar_aviso_pago', { p_evento: `evt_m_${r.codigo}`, p_proveedor: 'simulada', p_referencia: cobro[0].referencia, p_tipo: 'pago.aprobado', p_monto: 1000 });
  assert.equal(error?.code, 'TAL07');
});

test('si la seña vence, el horario se libera y un pago tardío queda para reintegrar', opciones, async () => {
  const r = await reservarConSena('0981777003');
  const { data: cobro } = await admin.rpc('abrir_cobro', { p_codigo: r.codigo, p_proveedor: 'simulada' });
  await admin.from('reservas').update({ expira_en: new Date(Date.now() - 60_000).toISOString() }).eq('codigo', r.codigo);

  const { data: liberadas } = await admin.rpc('liberar_vencidas');
  assert.ok(liberadas >= 1);
  const tarde = await admin.rpc('registrar_aviso_pago', { p_evento: `evt_t_${r.codigo}`, p_proveedor: 'simulada', p_referencia: cobro[0].referencia, p_tipo: 'pago.aprobado', p_monto: 36000 });
  // El cliente pagó cuando el horario ya se había liberado: el dinero no se pierde de vista.
  assert.equal(tarde.data, 'reintegrar');
  const { data: t } = await anon.rpc('turno_por_codigo', { p_codigo: r.codigo });
  assert.equal(t[0].estado, 'cancelada');
  assert.equal(t[0].pago, 'reintegrar');
});

test('la cola entrega cada mensaje a un solo proceso', opciones, async () => {
  const [a, b] = await Promise.all([admin.rpc('tomar_mensajes', { p_limite: 5 }), admin.rpc('tomar_mensajes', { p_limite: 5 })]);
  const ids = [...(a.data ?? []), ...(b.data ?? [])].map((m: { id: string }) => m.id);
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length, 'ningún mensaje tomado dos veces');
  assert.ok([...(a.data ?? []), ...(b.data ?? [])].every((m: { estado: string }) => m.estado === 'enviando'));
  await admin.from('mensajes').update({ estado: 'en_cola', tomado_en: null }).in('id', ids);
});
