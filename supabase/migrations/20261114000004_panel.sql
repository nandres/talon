-- Talón: lo que necesita el panel del negocio.
-- Los cambios de estado y la reprogramación pasan por funciones que verifican que quien llama
-- sea miembro del negocio; así la regla vive en la base y no depende de la interfaz.

-- ── Mensajes: se permite más de un aviso de reprogramación por reserva ───────

alter table public.mensajes drop constraint mensajes_reserva_id_tipo_key;
alter table public.mensajes drop constraint mensajes_tipo_check;
alter table public.mensajes add constraint mensajes_tipo_check
  check (tipo in ('confirmacion', 'recordatorio', 'cancelacion', 'reprogramacion'));
create unique index mensajes_unico_por_tipo on public.mensajes (reserva_id, tipo)
  where tipo in ('confirmacion', 'recordatorio', 'cancelacion');

-- encolar_avisos usaba la restricción anterior en su ON CONFLICT: se reescribe con el índice parcial.
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
     -- Si se reservó con menos de un día, el recordatorio sale el mismo día del turno: "de hoy".
     format('Hola %s, te recordamos tu turno de %s en %s: %s con %s, el %s. Si no podés venir, avisanos.',
            split_part(r.cliente, ' ', 1),
            case when (greatest(now(), r.inicio - interval '24 hours') at time zone r.zona_horaria)::date
                      = (r.inicio at time zone r.zona_horaria)::date then 'hoy' else 'mañana' end,
            r.negocio, r.servicio, r.profesional, v_cuando),
     greatest(now(), r.inicio - interval '24 hours'))
  on conflict (reserva_id, tipo) where tipo in ('confirmacion', 'recordatorio', 'cancelacion') do nothing;
end;
$$;
revoke all on function public.encolar_avisos(uuid) from public;

-- ── Cambiar el estado de una reserva ────────────────────────────────────────
--   pendiente_pago → confirmada (pagó en el local) | cancelada
--   confirmada     → completada | ausente | cancelada
--   completada / ausente → confirmada (deshacer)

create or replace function public.cambiar_estado_reserva(p_reserva uuid, p_estado text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.reservas;
  v_permitido boolean;
begin
  select * into v from public.reservas where id = p_reserva for update;
  if not found or not public.es_miembro(v.negocio_id) then
    raise exception 'Reserva inexistente' using errcode = 'TAL01';
  end if;

  v_permitido := case v.estado
    when 'pendiente_pago' then p_estado in ('confirmada', 'cancelada')
    when 'confirmada'     then p_estado in ('completada', 'ausente', 'cancelada')
    when 'completada'     then p_estado = 'confirmada'
    when 'ausente'        then p_estado = 'confirmada'
    else false end;
  if not v_permitido then
    raise exception 'No se puede pasar de % a %', v.estado, p_estado using errcode = 'TAL06';
  end if;
  if p_estado in ('completada', 'ausente') and lower(v.periodo) > now() then
    raise exception 'El turno todavía no empezó' using errcode = 'TAL06';
  end if;

  update public.reservas
     set estado = p_estado,
         expira_en = null,
         cancelada_en = case when p_estado = 'cancelada' then now() end
   where id = p_reserva;

  if p_estado = 'confirmada' and v.estado = 'pendiente_pago' then
    perform public.encolar_avisos(p_reserva);
  elsif p_estado = 'cancelada' then
    delete from public.mensajes where reserva_id = p_reserva and estado = 'en_cola';
    insert into public.mensajes (negocio_id, reserva_id, tipo, canal, destino, cuerpo)
    select v.negocio_id, v.id, 'cancelacion', 'whatsapp', c.telefono,
           format('Hola %s, tu turno del %s en %s quedó cancelado. Si querés, podés sacar otro en línea.',
                  split_part(c.nombre, ' ', 1),
                  to_char(lower(v.periodo) at time zone n.zona_horaria, 'DD/MM "a las" HH24:MI'), n.nombre)
      from public.clientes c, public.negocios n
     where c.id = v.cliente_id and n.id = v.negocio_id
    on conflict (reserva_id, tipo) where tipo in ('confirmacion', 'recordatorio', 'cancelacion') do nothing;
  end if;

  return p_estado;
end;
$$;

-- ── Reprogramar ─────────────────────────────────────────────────────────────
-- El equipo puede mover un turno a otro horario u otro profesional. Valida igual que la
-- reserva pública, salvo la anticipación mínima (el local puede acomodar a alguien ya mismo).

create or replace function public.reprogramar_reserva(p_reserva uuid, p_inicio timestamptz, p_profesional uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.reservas;
  v_neg public.negocios;
  v_dur integer;
  v_fin timestamptz;
  v_local timestamp;
  r record;
begin
  select * into v from public.reservas where id = p_reserva for update;
  if not found or not public.es_miembro(v.negocio_id) then
    raise exception 'Reserva inexistente' using errcode = 'TAL01';
  end if;
  if v.estado not in ('confirmada', 'pendiente_pago') then
    raise exception 'Solo se reprograman turnos activos' using errcode = 'TAL06';
  end if;

  select * into v_neg from public.negocios where id = v.negocio_id;
  v_dur := extract(epoch from (upper(v.periodo) - lower(v.periodo)))::int / 60;
  v_fin := p_inicio + make_interval(mins => v_dur);
  v_local := p_inicio at time zone v_neg.zona_horaria;

  perform 1 from public.profesional_servicios
   where profesional_id = p_profesional and servicio_id = v.servicio_id and negocio_id = v.negocio_id;
  if not found then raise exception 'El profesional no ofrece ese servicio' using errcode = 'TAL01'; end if;

  if p_inicio < now()
     or (extract(hour from v_local) * 60 + extract(minute from v_local))::int % v_neg.intervalo_min <> 0
     or extract(second from v_local) <> 0 then
    raise exception 'Horario inválido' using errcode = 'TAL02';
  end if;

  perform 1 from public.horarios h
   where h.profesional_id = p_profesional
     and h.dia_semana = extract(dow from v_local)
     and h.desde <= v_local::time
     and (v_fin at time zone v_neg.zona_horaria) <= v_local::date + h.hasta;
  if not found then raise exception 'Fuera del horario de atención' using errcode = 'TAL04'; end if;

  perform 1 from public.bloqueos b
   where b.negocio_id = v.negocio_id
     and (b.profesional_id is null or b.profesional_id = p_profesional)
     and b.periodo && tstzrange(p_inicio, v_fin);
  if found then raise exception 'Fuera del horario de atención' using errcode = 'TAL04'; end if;

  begin
    update public.reservas set periodo = tstzrange(p_inicio, v_fin), profesional_id = p_profesional
     where id = p_reserva;
  exception when exclusion_violation then
    raise exception 'El horario ya está tomado' using errcode = 'TAL05';
  end;

  -- Avisos: se descarta el recordatorio viejo y se avisa el cambio.
  delete from public.mensajes where reserva_id = p_reserva and estado = 'en_cola' and tipo = 'recordatorio';

  select c.nombre, c.telefono, p.nombre as profesional into r
    from public.clientes c, public.profesionales p
   where c.id = v.cliente_id and p.id = p_profesional;

  insert into public.mensajes (negocio_id, reserva_id, tipo, canal, destino, cuerpo)
  values (v.negocio_id, v.id, 'reprogramacion', 'whatsapp', r.telefono,
          format('Hola %s, movimos tu turno en %s: ahora es el %s con %s. Código: %s.',
                 split_part(r.nombre, ' ', 1), v_neg.nombre,
                 to_char(v_local, 'DD/MM "a las" HH24:MI'), r.profesional, v.codigo));

  if v.estado = 'confirmada' then
    perform public.encolar_avisos(p_reserva);   -- vuelve a programar el recordatorio
  end if;
end;
$$;

-- ── Horarios semanales de un profesional, de una sola vez ────────────────────

create or replace function public.guardar_horarios(p_profesional uuid, p_franjas jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_neg uuid;
begin
  select negocio_id into v_neg from public.profesionales where id = p_profesional;
  if v_neg is null or not public.es_dueno(v_neg) then
    raise exception 'Solo el dueño edita horarios' using errcode = 'TAL01';
  end if;
  delete from public.horarios where profesional_id = p_profesional;
  insert into public.horarios (negocio_id, profesional_id, dia_semana, desde, hasta)
  select v_neg, p_profesional, (f->>'dia')::smallint, (f->>'desde')::time, (f->>'hasta')::time
    from jsonb_array_elements(p_franjas) f;
end;
$$;

revoke all on function public.cambiar_estado_reserva(uuid, text) from public;
revoke all on function public.reprogramar_reserva(uuid, timestamptz, uuid) from public;
revoke all on function public.guardar_horarios(uuid, jsonb) from public;
grant execute on function public.cambiar_estado_reserva(uuid, text) to authenticated;
grant execute on function public.reprogramar_reserva(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.guardar_horarios(uuid, jsonb) to authenticated;
