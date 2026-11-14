-- Talón: la demo no enlaza a números reales.
-- Los teléfonos de ejemplo tenían formato válido de celular paraguayo, y al menos uno resultó ser
-- de un negocio real: el botón de WhatsApp de la vidriera abría un chat con esa empresa.
-- Ahora los negocios de ejemplo se marcan como demo (la interfaz no arma enlaces a WhatsApp) y sus
-- teléfonos usan el prefijo 0000, que no existe.

alter table public.negocios add column demo boolean not null default false;

create or replace function public.restaurar_demo()
returns void language plpgsql volatile security definer set search_path = '' as $fn$
declare
  v_hoy date := (now() at time zone 'America/Asuncion')::date;
  v_franja record;
  v_dia date;
  v_t timestamptz;
  fin_franja timestamptz;
  v_serv record;
  v_cli uuid;
  estado text;
  v_id uuid;
  v_numero integer;
begin
  perform setseed(0.42);

  -- En cascada se van profesionales, servicios, horarios, clientes, reservas, pagos y mensajes.
  delete from public.negocios where id in ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002');

insert into public.negocios (id, slug, nombre, rubro, direccion, telefono, sena_porcentaje, anticipacion_min, ventana_dias, intervalo_min, foto, tema, lema, demo) values
  ('11111111-0000-4000-8000-000000000001', 'la-navaja', 'Barbería La Navaja', 'Barbería',
   'Av. España 1240, Asunción', '0000 000 101', 0, 60, 21, 15, '/vidriera/barberia.jpg', 'noche', 'Tijera, navaja y toalla caliente', true),
  ('22222222-0000-4000-8000-000000000002', 'kine-mburucuya', 'Kine Mburucuyá', 'Kinesiología',
   'Santísimo Sacramento 870, Asunción', '0000 000 202', 30, 180, 30, 15, '/vidriera/kine.jpg', 'dia', 'Rehabilitación y deporte', true);

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
   tstzrange(((v_hoy + 6) + time '09:00') at time zone 'America/Asuncion',
             ((v_hoy + 6) + time '13:00') at time zone 'America/Asuncion'), 'Capacitación'),
  ('22222222-0000-4000-8000-000000000002', null,
   tstzrange(((v_hoy + 9) + time '00:00') at time zone 'America/Asuncion',
             ((v_hoy + 10) + time '00:00') at time zone 'America/Asuncion'), 'Jornada de actualización');

-- Clientes ficticios. El prefijo 0000 no existe en Paraguay: ningún número de la demo es de alguien.
insert into public.clientes (negocio_id, nombre, telefono)
select n.id, x.nombre, '0000' || n.prefijo || lpad(x.i::text, 5, '0')
from (values ('11111111-0000-4000-8000-000000000001'::uuid, '1'), ('22222222-0000-4000-8000-000000000002'::uuid, '2')) n(id, prefijo),
     unnest(array[
       'Andrés Cabrera', 'Belén Duarte', 'Carlos Villalba', 'Daniela Riveros', 'Emilio Franco',
       'Fátima Insfrán', 'Gustavo Aquino', 'Helena Ayala', 'Iván Martínez', 'Julia Cáceres',
       'Kevin Sanabria', 'Laura Ferreira', 'Matías Ramírez', 'Natalia Brítez', 'Óscar Galeano',
       'Patricia Núñez', 'Rodrigo Cardozo', 'Sofía Escobar', 'Tomás Vera', 'Valeria Ocampo',
       'Walter Amarilla', 'Ximena Paredes', 'Yanina Rolón', 'Zulma Báez'
     ]) with ordinality x(nombre, i);

  -- Reservas: recorre cada franja de cada profesional, dos semanas atrás y dos adelante.
  for v_dia in select generate_series(v_hoy - 14, v_hoy + 14, interval '1 day')::date loop
    for v_franja in
      select h.*, n.intervalo_min
      from public.horarios h join public.negocios n on n.id = h.negocio_id
      where h.dia_semana = extract(dow from v_dia)
      order by h.profesional_id, h.desde
    loop
      v_t := (v_dia + v_franja.desde) at time zone 'America/Asuncion';
      fin_franja := (v_dia + v_franja.hasta) at time zone 'America/Asuncion';
      while v_t < fin_franja loop
        select sv.id, sv.duracion_min, sv.precio_gs into v_serv
        from public.profesional_servicios ps join public.servicios sv on sv.id = ps.servicio_id
        where ps.profesional_id = v_franja.profesional_id
        order by random() limit 1;

        -- Más ocupado lo pasado y lo cercano; la semana que viene tiene huecos para reservar.
        if v_t + make_interval(mins => v_serv.duracion_min) <= fin_franja
           and random() < (case when v_dia < v_hoy then 0.7 when v_dia <= v_hoy + 3 then 0.5 else 0.3 end)
           and not exists (select 1 from public.bloqueos b
                           where b.negocio_id = v_franja.negocio_id
                             and (b.profesional_id is null or b.profesional_id = v_franja.profesional_id)
                             and b.periodo && tstzrange(v_t, v_t + make_interval(mins => v_serv.duracion_min))) then
          select id into v_cli from public.clientes where negocio_id = v_franja.negocio_id order by random() limit 1;
          estado := case
            when v_t + make_interval(mins => v_serv.duracion_min) > now() then 'confirmada'
            when random() < 0.07 then 'ausente'
            else 'completada' end;
          update public.negocios set ultimo_numero = ultimo_numero % 999 + 1
           where id = v_franja.negocio_id returning ultimo_numero into v_numero;
          insert into public.reservas (negocio_id, profesional_id, servicio_id, cliente_id, numero, periodo,
                                       estado, precio_gs, sena_gs, creado_en)
          values (v_franja.negocio_id, v_franja.profesional_id, v_serv.id, v_cli, v_numero,
                  tstzrange(v_t, v_t + make_interval(mins => v_serv.duracion_min)), estado, v_serv.precio_gs,
                  case when v_franja.negocio_id = '22222222-0000-4000-8000-000000000002' then round(v_serv.precio_gs * 0.3 / 1000) * 1000 else 0 end,
                  v_t - make_interval(days => 1 + floor(random() * 6)::int))
          returning id into v_id;
          if estado = 'confirmada' then perform public.encolar_avisos(v_id); end if;
          v_t := v_t + make_interval(mins => v_serv.duracion_min);
        else
          v_t := v_t + make_interval(mins => v_franja.intervalo_min);
        end if;
      end loop;
    end loop;
  end loop;

  -- Las confirmaciones de los turnos ya generados figuran como enviadas.
  update public.mensajes set estado = 'enviado', enviado_en = creado_en
   where tipo = 'confirmacion' and negocio_id in ('11111111-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000002');

  -- Las cuentas de la demo (si existen) vuelven a su negocio.
  insert into public.miembros (negocio_id, usuario_id, rol)
  select x.negocio, u.id, x.rol
    from (values ('ramon@lanavaja.demo', '11111111-0000-4000-8000-000000000001'::uuid, 'dueno'),
                 ('tati@lanavaja.demo',  '11111111-0000-4000-8000-000000000001'::uuid, 'personal'),
                 ('paula@kine.demo',     '22222222-0000-4000-8000-000000000002'::uuid, 'dueno')) x(correo, negocio, rol)
    join auth.users u on u.email = x.correo
  on conflict do nothing;
end;
$fn$;

revoke all on function public.restaurar_demo() from public, anon, authenticated;
grant execute on function public.restaurar_demo() to service_role;

-- Rehace la demo ya, con los teléfonos nuevos.
select public.restaurar_demo();
