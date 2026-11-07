-- Base de datos de la versión global (Supabase → SQL Editor → pegar y ejecutar una vez).
-- Una sola tabla clave/valor con el mismo uso que Netlify Blobs; la función de Netlify entra con la clave de servicio.
create table if not exists public.kv (
  key   text collate "C" primary key,   -- "C": las búsquedas por prefijo (c/<clase>/students/...) usan el índice
  value jsonb  not null,
  ver   bigint not null                 -- cambia en cada escritura: sirve para no pisar cambios hechos a la vez
);
-- sin políticas: nadie entra desde el navegador; solo la clave de servicio (que salta RLS) puede leer y escribir
alter table public.kv enable row level security;
