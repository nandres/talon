-- Talón: esquema base.
-- Cada fila pertenece a un negocio (negocio_id) y la RLS de la migración siguiente
-- separa a los negocios entre sí. Los montos van en guaraníes enteros (sin decimales).

create extension if not exists btree_gist with schema extensions;

-- ── Negocios y quién los administra ─────────────────────────────────────────

create table public.negocios (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre              text not null check (length(nombre) between 2 and 80),
  rubro               text not null,
  direccion           text,
  telefono            text,
  zona_horaria        text not null default 'America/Asuncion',
  sena_porcentaje     smallint not null default 0 check (sena_porcentaje between 0 and 100),
  anticipacion_min    integer not null default 120 check (anticipacion_min >= 0),   -- minutos
  ventana_dias        integer not null default 30 check (ventana_dias between 1 and 180),
  intervalo_min       integer not null default 15 check (intervalo_min in (5, 10, 15, 20, 30, 60)),
  ultimo_numero       integer not null default 0,
  creado_en           timestamptz not null default now()
);

create table public.miembros (
  negocio_id  uuid not null references public.negocios on delete cascade,
  usuario_id  uuid not null references auth.users on delete cascade,
  rol         text not null check (rol in ('dueno', 'personal')),
  primary key (negocio_id, usuario_id)
);
create index on public.miembros (usuario_id);

-- ── Catálogo: quién atiende, qué se ofrece y cuándo ─────────────────────────

create table public.profesionales (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios on delete cascade,
  nombre        text not null check (length(nombre) between 2 and 80),
  especialidad  text,
  activo        boolean not null default true,
  orden         smallint not null default 0,
  unique (id, negocio_id)
);
create index on public.profesionales (negocio_id);

create table public.servicios (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios on delete cascade,
  nombre        text not null check (length(nombre) between 2 and 80),
  descripcion   text,
  duracion_min  integer not null check (duracion_min between 5 and 480 and duracion_min % 5 = 0),
  precio_gs     bigint not null check (precio_gs >= 0),
  activo        boolean not null default true,
  orden         smallint not null default 0,
  unique (id, negocio_id)
);
create index on public.servicios (negocio_id);

-- Qué profesional ofrece qué servicio. Las claves compuestas impiden cruzar negocios.
create table public.profesional_servicios (
  negocio_id      uuid not null,
  profesional_id  uuid not null,
  servicio_id     uuid not null,
  primary key (profesional_id, servicio_id),
  foreign key (profesional_id, negocio_id) references public.profesionales (id, negocio_id) on delete cascade,
  foreign key (servicio_id, negocio_id) references public.servicios (id, negocio_id) on delete cascade
);

-- Franjas semanales en hora local del negocio. dia_semana: 0 = domingo … 6 = sábado.
create table public.horarios (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null,
  profesional_id  uuid not null,
  dia_semana      smallint not null check (dia_semana between 0 and 6),
  desde           time not null,
  hasta           time not null,
  check (desde < hasta),
  foreign key (profesional_id, negocio_id) references public.profesionales (id, negocio_id) on delete cascade,
  exclude using gist (profesional_id with =, dia_semana with =, tsrange('2000-01-01'::date + desde, '2000-01-01'::date + hasta) with &&)
);
create index on public.horarios (negocio_id);

-- Feriados, vacaciones o una tarde libre. profesional_id nulo = cierra todo el negocio.
create table public.bloqueos (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null references public.negocios on delete cascade,
  profesional_id  uuid,
  periodo         tstzrange not null check (not isempty(periodo) and lower_inc(periodo) and not upper_inc(periodo)),
  motivo          text,
  foreign key (profesional_id, negocio_id) references public.profesionales (id, negocio_id) on delete cascade
);
create index on public.bloqueos using gist (negocio_id, periodo);

-- ── Clientes y reservas ─────────────────────────────────────────────────────

create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios on delete cascade,
  nombre      text not null check (length(nombre) between 2 and 80),
  telefono    text not null check (telefono ~ '^\+?[0-9]{7,15}$'),
  correo      text check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  creado_en   timestamptz not null default now(),
  unique (negocio_id, telefono),
  unique (id, negocio_id)
);

-- Estados que ocupan la agenda: pendiente_pago (mientras no vence), confirmada, completada y ausente.
create table public.reservas (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null references public.negocios on delete cascade,
  profesional_id  uuid not null,
  servicio_id     uuid not null,
  cliente_id      uuid not null,
  numero          integer not null,
  codigo          text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  periodo         tstzrange not null check (not isempty(periodo) and lower_inc(periodo) and not upper_inc(periodo)),
  estado          text not null check (estado in ('pendiente_pago', 'confirmada', 'cancelada', 'completada', 'ausente')),
  precio_gs       bigint not null check (precio_gs >= 0),
  sena_gs         bigint not null default 0 check (sena_gs >= 0 and sena_gs <= precio_gs),
  expira_en       timestamptz,
  notas           text,
  cancelada_en    timestamptz,
  creado_en       timestamptz not null default now(),
  foreign key (profesional_id, negocio_id) references public.profesionales (id, negocio_id),
  foreign key (servicio_id, negocio_id) references public.servicios (id, negocio_id),
  foreign key (cliente_id, negocio_id) references public.clientes (id, negocio_id),
  check ((estado = 'pendiente_pago') = (expira_en is not null)),
  -- La garantía central: un profesional nunca tiene dos turnos que se pisen,
  -- aunque dos personas reserven en el mismo milisegundo.
  constraint reservas_sin_solapamiento exclude using gist (
    profesional_id with =,
    periodo with &&
  ) where (estado <> 'cancelada')
);
create index on public.reservas (negocio_id, lower(periodo));
create index on public.reservas (cliente_id);

-- ── Pagos y mensajes ────────────────────────────────────────────────────────

create table public.pagos (
  id                  uuid primary key default gen_random_uuid(),
  negocio_id          uuid not null references public.negocios on delete cascade,
  reserva_id          uuid not null references public.reservas on delete cascade,
  proveedor           text not null,
  referencia          text not null unique,
  monto_gs            bigint not null check (monto_gs > 0),
  estado              text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado', 'vencido')),
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index on public.pagos (reserva_id);

-- Cada aviso de la pasarela se procesa una sola vez, aunque llegue repetido.
create table public.eventos_pago (
  id            text primary key,
  proveedor     text not null,
  referencia    text not null,
  tipo          text not null,
  recibido_en   timestamptz not null default now()
);

create table public.mensajes (
  id               uuid primary key default gen_random_uuid(),
  negocio_id       uuid not null references public.negocios on delete cascade,
  reserva_id       uuid not null references public.reservas on delete cascade,
  tipo             text not null check (tipo in ('confirmacion', 'recordatorio', 'cancelacion')),
  canal            text not null check (canal in ('whatsapp', 'correo')),
  destino          text not null,
  cuerpo           text not null,
  estado           text not null default 'en_cola' check (estado in ('en_cola', 'enviado', 'fallido')),
  programado_para  timestamptz not null default now(),
  enviado_en       timestamptz,
  creado_en        timestamptz not null default now(),
  unique (reserva_id, tipo)
);
create index on public.mensajes (estado, programado_para);
create index on public.mensajes (negocio_id, creado_en desc);
