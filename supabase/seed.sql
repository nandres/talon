-- Talón: datos de ejemplo. Todo es ficticio: negocios, personas y teléfonos.
-- Las reservas se generan relativas a la fecha actual, así la demo siempre tiene
-- turnos pasados (completados) y próximos (confirmados).

select setseed(0.42);

insert into public.negocios (id, slug, nombre, rubro, direccion, telefono, sena_porcentaje, anticipacion_min, ventana_dias, intervalo_min, foto, tema, lema) values
  ('11111111-0000-4000-8000-000000000001', 'la-navaja', 'Barbería La Navaja', 'Barbería',
   'Av. España 1240, Asunción', '+595981000101', 0, 60, 21, 15, '/vidriera/barberia.jpg', 'noche', 'Tijera, navaja y toalla caliente'),
  ('22222222-0000-4000-8000-000000000002', 'kine-mburucuya', 'Kine Mburucuyá', 'Kinesiología',
   'Santísimo Sacramento 870, Asunción', '+595981000202', 30, 180, 30, 15, '/vidriera/kine.jpg', 'dia', 'Rehabilitación y deporte');

insert into public.profesionales (id, negocio_id, nombre, especialidad, orden) values
  ('11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-000000000001', 'Ramón Giménez', 'Cortes clásicos y navaja', 1),
  ('11111111-0000-4000-8000-0000000000a2', '11111111-0000-4000-8000-000000000001', 'Lucas Benítez', 'Degradés y diseño', 2),
  ('11111111-0000-4000-8000-0000000000a3', '11111111-0000-4000-8000-000000000001', 'Tati Ortiz', 'Barba y color', 3),
  ('22222222-0000-4000-8000-0000000000b1', '22222222-0000-4000-8000-000000000002', 'Lic. Paula Rojas', 'Traumatología y deporte', 1),
  ('22222222-0000-4000-8000-0000000000b2', '22222222-0000-4000-8000-000000000002', 'Lic. Diego Acosta', 'Rehabilitación y drenaje', 2);

insert into public.servicios (id, negocio_id, nombre, descripcion, duracion_min, precio_gs, orden) values
  ('11111111-0000-4000-8000-0000000000c1', '11111111-0000-4000-8000-000000000001', 'Corte clásico', 'Tijera y máquina, lavado incluido.', 30, 50000, 1),
  ('11111111-0000-4000-8000-0000000000c2', '11111111-0000-4000-8000-000000000001', 'Corte y barba', 'Corte completo con perfilado de barba a navaja.', 45, 80000, 2),
  ('11111111-0000-4000-8000-0000000000c3', '11111111-0000-4000-8000-000000000001', 'Arreglo de barba', 'Perfilado, toalla caliente y aceite.', 20, 35000, 3),
  ('11111111-0000-4000-8000-0000000000c4', '11111111-0000-4000-8000-000000000001', 'Corte infantil', 'Hasta 12 años.', 25, 40000, 4),
  ('22222222-0000-4000-8000-0000000000d1', '22222222-0000-4000-8000-000000000002', 'Evaluación inicial', 'Primera consulta: historia clínica y plan de tratamiento.', 45, 150000, 1),
  ('22222222-0000-4000-8000-0000000000d2', '22222222-0000-4000-8000-000000000002', 'Sesión de kinesiología', 'Sesión de seguimiento.', 40, 120000, 2),
  ('22222222-0000-4000-8000-0000000000d3', '22222222-0000-4000-8000-000000000002', 'Drenaje linfático', 'Drenaje manual, 60 minutos.', 60, 180000, 3);

insert into public.profesional_servicios (negocio_id, profesional_id, servicio_id) values
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000c1'),
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000c2'),
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000c3'),
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a2', '11111111-0000-4000-8000-0000000000c1'),
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a2', '11111111-0000-4000-8000-0000000000c2'),
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a2', '11111111-0000-4000-8000-0000000000c4'),
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a3', '11111111-0000-4000-8000-0000000000c2'),
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a3', '11111111-0000-4000-8000-0000000000c3'),
  ('22222222-0000-4000-8000-000000000002', '22222222-0000-4000-8000-0000000000b1', '22222222-0000-4000-8000-0000000000d1'),
  ('22222222-0000-4000-8000-000000000002', '22222222-0000-4000-8000-0000000000b1', '22222222-0000-4000-8000-0000000000d2'),
  ('22222222-0000-4000-8000-000000000002', '22222222-0000-4000-8000-0000000000b2', '22222222-0000-4000-8000-0000000000d1'),
  ('22222222-0000-4000-8000-000000000002', '22222222-0000-4000-8000-0000000000b2', '22222222-0000-4000-8000-0000000000d2'),
  ('22222222-0000-4000-8000-000000000002', '22222222-0000-4000-8000-0000000000b2', '22222222-0000-4000-8000-0000000000d3');

-- Barbería: martes a sábado, con corte al mediodía. Kine: lunes a viernes.
insert into public.horarios (negocio_id, profesional_id, dia_semana, desde, hasta)
select '11111111-0000-4000-8000-000000000001'::uuid, p, d, f.desde, f.hasta
from unnest(array['11111111-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-0000000000a2']::uuid[]) p,
     generate_series(2, 6) d,
     (values ('09:00'::time, '13:00'::time), ('15:00', '20:00')) f(desde, hasta)
union all
select '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a3', d, '13:00', '21:00'
from generate_series(3, 6) d
union all
select '22222222-0000-4000-8000-000000000002', p, d, f.desde, f.hasta
from unnest(array['22222222-0000-4000-8000-0000000000b1', '22222222-0000-4000-8000-0000000000b2']::uuid[]) p,
     generate_series(1, 5) d,
     (values ('07:00'::time, '12:00'::time), ('14:00', '19:00')) f(desde, hasta);

insert into public.bloqueos (negocio_id, profesional_id, periodo, motivo) values
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000a2',
   tstzrange(((current_date + 6) + time '09:00') at time zone 'America/Asuncion',
             ((current_date + 6) + time '13:00') at time zone 'America/Asuncion'), 'Capacitación'),
  ('22222222-0000-4000-8000-000000000002', null,
   tstzrange(((current_date + 9) + time '00:00') at time zone 'America/Asuncion',
             ((current_date + 10) + time '00:00') at time zone 'America/Asuncion'), 'Jornada de actualización');

-- Clientes ficticios
insert into public.clientes (negocio_id, nombre, telefono)
select n.id, x.nombre, '+59598' || n.prefijo || lpad(x.i::text, 6, '0')
from (values ('11111111-0000-4000-8000-000000000001'::uuid, '1'), ('22222222-0000-4000-8000-000000000002'::uuid, '2')) n(id, prefijo),
     unnest(array[
       'Andrés Cabrera', 'Belén Duarte', 'Carlos Villalba', 'Daniela Riveros', 'Emilio Franco',
       'Fátima Insfrán', 'Gustavo Aquino', 'Helena Ayala', 'Iván Martínez', 'Julia Cáceres',
       'Kevin Sanabria', 'Laura Ferreira', 'Matías Ramírez', 'Natalia Brítez', 'Óscar Galeano',
       'Patricia Núñez', 'Rodrigo Cardozo', 'Sofía Escobar', 'Tomás Vera', 'Valeria Ocampo',
       'Walter Amarilla', 'Ximena Paredes', 'Yanina Rolón', 'Zulma Báez'
     ]) with ordinality x(nombre, i);

-- Reservas: recorre cada franja de cada profesional, dos semanas atrás y dos adelante.
do $$
declare
  f record;
  d date;
  t timestamptz;
  fin_franja timestamptz;
  s record;
  c uuid;
  estado text;
  v_id uuid;
  v_numero integer;
begin
  for d in select generate_series(current_date - 14, current_date + 14, interval '1 day')::date loop
    for f in
      select h.*, n.intervalo_min
      from public.horarios h join public.negocios n on n.id = h.negocio_id
      where h.dia_semana = extract(dow from d)
      order by h.profesional_id, h.desde
    loop
      t := (d + f.desde) at time zone 'America/Asuncion';
      fin_franja := (d + f.hasta) at time zone 'America/Asuncion';
      while t < fin_franja loop
        select sv.id, sv.duracion_min, sv.precio_gs into s
        from public.profesional_servicios ps join public.servicios sv on sv.id = ps.servicio_id
        where ps.profesional_id = f.profesional_id
        order by random() limit 1;

        -- Más ocupado lo pasado y lo cercano; la semana que viene tiene huecos para reservar.
        if t + make_interval(mins => s.duracion_min) <= fin_franja
           and random() < (case when d < current_date then 0.7 when d <= current_date + 3 then 0.5 else 0.3 end)
           and not exists (select 1 from public.bloqueos b
                           where b.negocio_id = f.negocio_id
                             and (b.profesional_id is null or b.profesional_id = f.profesional_id)
                             and b.periodo && tstzrange(t, t + make_interval(mins => s.duracion_min))) then
          select id into c from public.clientes where negocio_id = f.negocio_id order by random() limit 1;
          estado := case
            when t + make_interval(mins => s.duracion_min) > now() then 'confirmada'
            when random() < 0.07 then 'ausente'
            else 'completada' end;
          update public.negocios set ultimo_numero = ultimo_numero % 999 + 1
           where id = f.negocio_id returning ultimo_numero into v_numero;
          insert into public.reservas (negocio_id, profesional_id, servicio_id, cliente_id, numero, periodo,
                                       estado, precio_gs, sena_gs, creado_en)
          values (f.negocio_id, f.profesional_id, s.id, c, v_numero,
                  tstzrange(t, t + make_interval(mins => s.duracion_min)), estado, s.precio_gs,
                  case when f.negocio_id = '22222222-0000-4000-8000-000000000002' then round(s.precio_gs * 0.3 / 1000) * 1000 else 0 end,
                  t - make_interval(days => 1 + floor(random() * 6)::int))
          returning id into v_id;
          if estado = 'confirmada' then perform public.encolar_avisos(v_id); end if;
          t := t + make_interval(mins => s.duracion_min);
        else
          t := t + make_interval(mins => f.intervalo_min);
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- Las confirmaciones de los turnos ya generados figuran como enviadas.
update public.mensajes set estado = 'enviado', enviado_en = creado_en where tipo = 'confirmacion';

-- ── Cuentas de demostración ────────────────────────────────────────────────
-- Contraseña común: talon-demo-2026 (datos ficticios; la usa el botón "Entrar como…").

do $$
declare
  u record;
begin
  for u in select * from (values
    ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'ramon@lanavaja.demo', '11111111-0000-4000-8000-000000000001'::uuid, 'dueno'),
    ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'tati@lanavaja.demo',  '11111111-0000-4000-8000-000000000001'::uuid, 'personal'),
    ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'paula@kine.demo',     '22222222-0000-4000-8000-000000000002'::uuid, 'dueno')
  ) t(id, correo, negocio, rol) loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.correo,
            extensions.crypt('talon-demo-2026', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.correo, 'email_verified', true),
            'email', now(), now(), now());
    insert into public.miembros (negocio_id, usuario_id, rol) values (u.negocio, u.id, u.rol);
  end loop;
end $$;
