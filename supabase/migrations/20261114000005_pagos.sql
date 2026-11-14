-- Talón: cobro de señas y limpieza de reservas vencidas.
-- Estas funciones las llama solo el servidor con la clave secreta (rol service_role):
-- el webhook de la pasarela y el proceso programado. El público no puede ejecutarlas.

alter table public.pagos drop constraint pagos_estado_check;
alter table public.pagos add constraint pagos_estado_check
  check (estado in ('pendiente', 'aprobado', 'rechazado', 'vencido', 'reintegrar'));

-- ── Abrir un cobro para la seña de una reserva ──────────────────────────────

create or replace function public.abrir_cobro(p_codigo text, p_proveedor text)
returns table (referencia text, monto_gs bigint, negocio text, slug text, servicio text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.reservas;
  v_ref text;
begin
  select * into v from public.reservas where codigo = upper(p_codigo) for update;
  if not found then raise exception 'Reserva inexistente' using errcode = 'TAL01'; end if;
  if v.estado <> 'pendiente_pago' or v.expira_en <= now() then
    raise exception 'La reserva no espera un pago' using errcode = 'TAL06';
  end if;

  -- Un cobro abierto por reserva: si ya existe, se reutiliza.
  select p.referencia into v_ref from public.pagos p where p.reserva_id = v.id and p.estado = 'pendiente';
  if v_ref is null then
    v_ref := 'TAL-' || v.codigo || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.pagos (negocio_id, reserva_id, proveedor, referencia, monto_gs)
    values (v.negocio_id, v.id, p_proveedor, v_ref, v.sena_gs);
  end if;

  return query
  select v_ref, v.sena_gs, n.nombre, n.slug, s.nombre
    from public.negocios n, public.servicios s
   where n.id = v.negocio_id and s.id = v.servicio_id;
end;
$$;

-- ── Aviso de la pasarela (idempotente) ──────────────────────────────────────
-- Devuelve: 'confirmada', 'rechazado', 'reintegrar' (pagó tarde y el turno ya no existe) o 'repetido'.

create or replace function public.registrar_aviso_pago(p_evento text, p_proveedor text, p_referencia text, p_tipo text, p_monto bigint)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_pago public.pagos;
  v_res public.reservas;
begin
  insert into public.eventos_pago (id, proveedor, referencia, tipo) values (p_evento, p_proveedor, p_referencia, p_tipo)
  on conflict (id) do nothing;
  if not found then return 'repetido'; end if;

  select * into v_pago from public.pagos where referencia = p_referencia for update;
  if not found then raise exception 'Pago inexistente' using errcode = 'TAL01'; end if;
  -- 'vencido' también se procesa: el cliente pudo pagar en la pasarela justo cuando el plazo
  -- se cumplía. Ese dinero existe y hay que registrarlo (para confirmar o para devolver).
  if v_pago.estado not in ('pendiente', 'vencido') then return 'repetido'; end if;

  if p_tipo = 'pago.rechazado' then
    update public.pagos set estado = 'rechazado', actualizado_en = now() where id = v_pago.id;
    return 'rechazado';
  end if;
  if p_tipo <> 'pago.aprobado' or p_monto <> v_pago.monto_gs then
    raise exception 'Aviso inconsistente' using errcode = 'TAL07';
  end if;

  select * into v_res from public.reservas where id = v_pago.reserva_id for update;
  if v_res.estado = 'pendiente_pago' then
    -- Aunque haya pasado el plazo, si nadie ocupó el horario el turno sigue siendo suyo.
    update public.reservas set estado = 'confirmada', expira_en = null where id = v_res.id;
    update public.pagos set estado = 'aprobado', actualizado_en = now() where id = v_pago.id;
    perform public.encolar_avisos(v_res.id);
    return 'confirmada';
  end if;

  update public.pagos set estado = 'reintegrar', actualizado_en = now() where id = v_pago.id;
  return 'reintegrar';
end;
$$;

-- ── Liberar horarios con seña vencida ───────────────────────────────────────

create or replace function public.liberar_vencidas()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_total integer;
begin
  with vencidas as (
    update public.reservas
       set estado = 'cancelada', expira_en = null, cancelada_en = now()
     where estado = 'pendiente_pago' and expira_en <= now()
    returning id
  ), pagos_vencidos as (
    update public.pagos set estado = 'vencido', actualizado_en = now()
     where estado = 'pendiente' and reserva_id in (select id from vencidas)
  )
  select count(*) into v_total from vencidas;
  return v_total;
end;
$$;

-- ── Turno por código (para el cliente): datos mínimos, sin teléfono ni apellido ──

create or replace function public.turno_por_codigo(p_codigo text)
returns table (codigo text, numero integer, estado text, inicio timestamptz, fin timestamptz, sena_gs bigint,
               expira_en timestamptz, cliente text, servicio text, profesional text,
               negocio text, slug text, zona_horaria text, foto text, tema text, pago text)
language sql stable security definer set search_path = '' as $$
  select r.codigo, r.numero, r.estado, lower(r.periodo), upper(r.periodo), r.sena_gs, r.expira_en,
         split_part(c.nombre, ' ', 1), s.nombre, p.nombre, n.nombre, n.slug, n.zona_horaria, n.foto, n.tema,
         (select pg.estado from public.pagos pg where pg.reserva_id = r.id order by pg.creado_en desc limit 1)
    from public.reservas r
    join public.clientes c on c.id = r.cliente_id
    join public.servicios s on s.id = r.servicio_id
    join public.profesionales p on p.id = r.profesional_id
    join public.negocios n on n.id = r.negocio_id
   where r.codigo = upper(p_codigo);
$$;

revoke all on function public.abrir_cobro(text, text) from public, anon, authenticated;
revoke all on function public.registrar_aviso_pago(text, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.liberar_vencidas() from public, anon, authenticated;
grant execute on function public.abrir_cobro(text, text) to service_role;
grant execute on function public.registrar_aviso_pago(text, text, text, text, bigint) to service_role;
grant execute on function public.liberar_vencidas() to service_role;

revoke all on function public.turno_por_codigo(text) from public;
grant execute on function public.turno_por_codigo(text) to anon, authenticated;

-- ── Tarea programada: liberar señas vencidas cada 5 minutos (pg_cron) ────────

create extension if not exists pg_cron;
select cron.schedule('talon-liberar-vencidas', '*/5 * * * *', $$ select public.liberar_vencidas(); $$);

-- ── Cola de mensajes ────────────────────────────────────────────────────────
-- Tomar → enviar → marcar. "enviando" evita que dos procesos manden el mismo aviso;
-- si uno se cae a mitad de camino, a los 10 minutos el mensaje vuelve a la cola.

alter table public.mensajes drop constraint mensajes_estado_check;
alter table public.mensajes add constraint mensajes_estado_check
  check (estado in ('en_cola', 'enviando', 'enviado', 'fallido'));
alter table public.mensajes add column intentos smallint not null default 0;
alter table public.mensajes add column tomado_en timestamptz;

create or replace function public.tomar_mensajes(p_limite integer, p_negocio uuid default null)
returns setof public.mensajes language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.mensajes set estado = 'en_cola', tomado_en = null
   where estado = 'enviando' and tomado_en < now() - interval '10 minutes';

  return query
  update public.mensajes m set estado = 'enviando', tomado_en = now(), intentos = m.intentos + 1
   where m.id in (
     select x.id from public.mensajes x
      where x.estado = 'en_cola' and x.programado_para <= now()
        and (p_negocio is null or x.negocio_id = p_negocio)
      order by x.programado_para
      limit least(greatest(p_limite, 1), 500)
      for update skip locked)
  returning m.*;
end;
$$;

revoke all on function public.tomar_mensajes(integer, uuid) from public, anon, authenticated;
grant execute on function public.tomar_mensajes(integer, uuid) to service_role;
