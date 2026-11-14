-- Talón: cada negocio elige cómo se ve su vidriera.
--   foto: imagen del local que va detrás del vidrio (ruta pública o URL).
--   tema: 'noche' (vidrio ahumado y rótulo de pan de oro) o 'dia' (vidrio claro y rótulo grabado).
--   lema: una línea bajo el nombre.

alter table public.negocios
  add column foto text,
  add column tema text not null default 'noche' check (tema in ('noche', 'dia')),
  add column lema text check (lema is null or length(lema) <= 80);
