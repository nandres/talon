-- Talón: seguridad por negocio y las funciones que usa la página pública.
--
-- Reglas:
--  · El público (anon) ve solo el catálogo: negocio, profesionales, servicios y horarios.
--    Nunca ve reservas ni clientes; para saber qué está ocupado llama a agenda_ocupada(),
--    que devuelve rangos de tiempo sin datos personales.
--  · Reservar es solo a través de reservar_turno(), que valida todo del lado de la base.
--  · Los miembros ven y gestionan lo de su negocio; el catálogo lo edita solo el dueño.

-- ── Ayudantes ───────────────────────────────────────────────────────────────

create or replace function public.es_miembro(p_negocio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros m
    where m.negocio_id = p_negocio and m.usuario_id = (select auth.uid())
  );
$$;

create or replace function public.es_dueno(p_negocio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros m
    where m.negocio_id = p_negocio and m.usuario_id = (select auth.uid()) and m.rol = 'dueno'
  );
$$;

revoke all on function public.es_miembro(uuid), public.es_dueno(uuid) from public;
grant execute on function public.es_miembro(uuid), public.es_dueno(uuid) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.negocios              enable row level security;
alter table public.miembros              enable row level security;
alter table public.profesionales         enable row level security;
alter table public.servicios             enable row level security;
alter table public.profesional_servicios enable row level security;
alter table public.horarios              enable row level security;
alter table public.bloqueos              enable row level security;
alter table public.clientes              enable row level security;
alter table public.reservas              enable row level security;
alter table public.pagos                 enable row level security;
alter table public.eventos_pago          enable row level security;
alter table public.mensajes              enable row level security;

-- Catálogo público
create policy negocios_lectura_publica on public.negocios for select using (true);
create policy negocios_edita_dueno on public.negocios for update to authenticated
  using (public.es_dueno(id)) with check (public.es_dueno(id));

create policy profesionales_lectura on public.profesionales for select
  using (activo or public.es_miembro(negocio_id));
create policy profesionales_dueno on public.profesionales for all to authenticated
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));

create policy servicios_lectura on public.servicios for select
  using (activo or public.es_miembro(negocio_id));
create policy servicios_dueno on public.servicios for all to authenticated
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));

create policy prof_serv_lectura on public.profesional_servicios for select using (true);
create policy prof_serv_dueno on public.profesional_servicios for all to authenticated
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));

create policy horarios_lectura on public.horarios for select using (true);
create policy horarios_dueno on public.horarios for all to authenticated
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));

-- Solo para el equipo
create policy miembros_lectura on public.miembros for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_miembro(negocio_id));

create policy bloqueos_lectura on public.bloqueos for select to authenticated
  using (public.es_miembro(negocio_id));
create policy bloqueos_dueno on public.bloqueos for all to authenticated
  using (public.es_dueno(negocio_id)) with check (public.es_dueno(negocio_id));

create policy clientes_equipo on public.clientes for select to authenticated
  using (public.es_miembro(negocio_id));

create policy reservas_equipo on public.reservas for select to authenticated
  using (public.es_miembro(negocio_id));

create policy pagos_equipo on public.pagos for select to authenticated
  using (public.es_miembro(negocio_id));

create policy mensajes_equipo on public.mensajes for select to authenticated
  using (public.es_miembro(negocio_id));

-- eventos_pago no tiene políticas: solo la clave de servicio (el webhook) lo toca.
-- Los cambios de estado de reservas pasan por funciones, no por UPDATE directo.

-- ── Agenda ocupada (sin datos personales) ───────────────────────────────────

create or replace function public.agenda_ocupada(p_slug text, p_desde timestamptz, p_hasta timestamptz)
returns table (profesional_id uuid, inicio timestamptz, fin timestamptz)
language sql stable security definer set search_path = '' as $$
  with n as (select id from public.negocios where slug = p_slug)
  select r.profesional_id, lower(r.periodo), upper(r.periodo)
  from public.reservas r join n on n.id = r.negocio_id
  where r.periodo && tstzrange(p_desde, p_hasta)
    and (r.estado in ('confirmada', 'completada', 'ausente')
         or (r.estado = 'pendiente_pago' and r.expira_en > now()))
  union all
  select p.id, greatest(lower(b.periodo), p_desde), least(upper(b.periodo), p_hasta)
  from public.bloqueos b
  join n on n.id = b.negocio_id
  join public.profesionales p on p.negocio_id = b.negocio_id
       and (b.profesional_id is null or b.profesional_id = p.id)
  where b.periodo && tstzrange(p_desde, p_hasta);
$$;

revoke all on function public.agenda_ocupada(text, timestamptz, timestamptz) from public;
grant execute on function public.agenda_ocupada(text, timestamptz, timestamptz) to anon, authenticated;

-- ── Reservar ────────────────────────────────────────────────────────────────
-- Errores con código propio para que la página los traduzca:
--   TAL01 negocio, servicio o profesional inválido      TAL04 fuera del horario de atención
--   TAL02 horario no alineado o fuera de la ventana      TAL05 el horario ya está tomado
--   TAL03 datos del cliente inválidos

create or replace function public.reservar_turno(
  p_slug         text,
  p_servicio     uuid,
  p_profesional  uuid,
  p_inicio       timestamptz,
  p_nombre       text,
  p_telefono     text,
  p_correo       text default null
)
returns table (codigo text, numero integer, estado text, sena_gs bigint, inicio timestamptz, fin timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_neg      public.negocios;
  v_serv     public.servicios;
  v_fin      timestamptz;
  v_local    timestamp;
  v_cliente  uuid;
  v_numero   integer;
  v_sena     bigint;
  v_estado   text;
  v_reserva  public.reservas;
  v_tel      text := regexp_replace(coalesce(p_telefono, ''), '[\s().-]', '', 'g');
  v_nombre   text := btrim(coalesce(p_nombre, ''));
  v_correo   text := nullif(lower(btrim(coalesce(p_correo, ''))), '');
begin
  select * into v_neg from public.negocios where slug = p_slug;
  if not found then raise exception 'Negocio inexistente' using errcode = 'TAL01'; end if;

  select * into v_serv from public.servicios
   where id = p_servicio and negocio_id = v_neg.id and activo;
  if not found then raise exception 'Servicio inexistente' using errcode = 'TAL01'; end if;

  perform 1 from public.profesionales p
    join public.profesional_servicios ps on ps.profesional_id = p.id and ps.servicio_id = v_serv.id
   where p.id = p_profesional and p.negocio_id = v_neg.id and p.activo;
  if not found then raise exception 'El profesional no ofrece ese servicio' using errcode = 'TAL01'; end if;

  if length(v_nombre) < 2 or length(v_nombre) > 80 or v_tel !~ '^\+?[0-9]{7,15}$'
     or (v_correo is not null and v_correo !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Datos del cliente inválidos' using errcode = 'TAL03';
  end if;

  v_fin   := p_inicio + make_interval(mins => v_serv.duracion_min);
  v_local := p_inicio at time zone v_neg.zona_horaria;

  if extract(second from v_local) <> 0
     or (extract(hour from v_local) * 60 + extract(minute from v_local))::int % v_neg.intervalo_min <> 0
     or p_inicio < now() + make_interval(mins => v_neg.anticipacion_min)
     or p_inicio > now() + make_interval(days => v_neg.ventana_dias) then
    raise exception 'Horario fuera de la ventana de reservas' using errcode = 'TAL02';
  end if;

  perform 1 from public.horarios h
   where h.profesional_id = p_profesional
     and h.dia_semana = extract(dow from v_local)
     and h.desde <= v_local::time
     and (v_fin at time zone v_neg.zona_horaria) <= v_local::date + h.hasta;
  if not found then raise exception 'Fuera del horario de atención' using errcode = 'TAL04'; end if;

  perform 1 from public.bloqueos b
   where b.negocio_id = v_neg.id
     and (b.profesional_id is null or b.profesional_id = p_profesional)
     and b.periodo && tstzrange(p_inicio, v_fin);
  if found then raise exception 'Fuera del horario de atención' using errcode = 'TAL04'; end if;

  -- Libera reservas sin pagar que ya vencieron y estorban este horario.
  update public.reservas r
     set estado = 'cancelada', expira_en = null, cancelada_en = now()
   where r.profesional_id = p_profesional
     and r.estado = 'pendiente_pago' and r.expira_en <= now()
     and r.periodo && tstzrange(p_inicio, v_fin);

  insert into public.clientes as c (negocio_id, nombre, telefono, correo)
  values (v_neg.id, v_nombre, v_tel, v_correo)
  on conflict (negocio_id, telefono)
    do update set nombre = excluded.nombre, correo = coalesce(excluded.correo, c.correo)
  returning c.id into v_cliente;

  update public.negocios n set ultimo_numero = n.ultimo_numero % 999 + 1
   where n.id = v_neg.id returning n.ultimo_numero into v_numero;

  -- La seña se redondea a miles de guaraníes.
  v_sena   := (round(v_serv.precio_gs * v_neg.sena_porcentaje / 100.0 / 1000) * 1000)::bigint;
  v_estado := case when v_sena > 0 then 'pendiente_pago' else 'confirmada' end;

  begin
    insert into public.reservas (negocio_id, profesional_id, servicio_id, cliente_id, numero,
                                 periodo, estado, precio_gs, sena_gs, expira_en)
    values (v_neg.id, p_profesional, v_serv.id, v_cliente, v_numero,
            tstzrange(p_inicio, v_fin), v_estado, v_serv.precio_gs, v_sena,
            case when v_sena > 0 then now() + interval '15 minutes' end)
    returning * into v_reserva;
  exception when exclusion_violation then
    raise exception 'El horario ya está tomado' using errcode = 'TAL05';
  end;

  if v_estado = 'confirmada' then
    perform public.encolar_avisos(v_reserva.id);
  end if;

  return query select v_reserva.codigo, v_reserva.numero, v_reserva.estado, v_reserva.sena_gs, p_inicio, v_fin;
end;
$$;

-- ── Avisos: confirmación inmediata y recordatorio 24 h antes ────────────────

create or replace function public.encolar_avisos(p_reserva uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  r record;
  v_cuando text;
begin
  select res.id, res.negocio_id, res.codigo, res.numero, lower(res.periodo) as inicio,
         n.nombre as negocio, n.zona_horaria, s.nombre as servicio, p.nombre as profesional,
         c.nombre as cliente, c.telefono
    into r
    from public.reservas res
    join public.negocios n on n.id = res.negocio_id
    join public.servicios s on s.id = res.servicio_id
    join public.profesionales p on p.id = res.profesional_id
    join public.clientes c on c.id = res.cliente_id
   where res.id = p_reserva;

  v_cuando := to_char(r.inicio at time zone r.zona_horaria, 'DD/MM "a las" HH24:MI');

  insert into public.mensajes (negocio_id, reserva_id, tipo, canal, destino, cuerpo, programado_para)
  values
    (r.negocio_id, r.id, 'confirmacion', 'whatsapp', r.telefono,
     format('Hola %s, tu turno N.º %s en %s quedó confirmado: %s con %s, el %s. Código: %s.',
            split_part(r.cliente, ' ', 1), lpad(r.numero::text, 3, '0'), r.negocio,
            r.servicio, r.profesional, v_cuando, r.codigo),
     now()),
    (r.negocio_id, r.id, 'recordatorio', 'whatsapp', r.telefono,
     format('Hola %s, te recordamos tu turno de mañana en %s: %s con %s, el %s. Si no podés venir, avisanos.',
            split_part(r.cliente, ' ', 1), r.negocio, r.servicio, r.profesional, v_cuando),
     greatest(now(), r.inicio - interval '24 hours'))
  on conflict (reserva_id, tipo) do nothing;
end;
$$;

revoke all on function public.reservar_turno(text, uuid, uuid, timestamptz, text, text, text) from public;
revoke all on function public.encolar_avisos(uuid) from public;
grant execute on function public.reservar_turno(text, uuid, uuid, timestamptz, text, text, text) to anon, authenticated;
