-- Ajout du mode de connexion proxy
ALTER TABLE public.app_connections
  ADD COLUMN IF NOT EXISTS connection_mode text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS endpoint_url text,
  ADD COLUMN IF NOT EXISTS endpoint_key text,
  ADD COLUMN IF NOT EXISTS endpoint_header_name text DEFAULT 'x-cyounne-key';

-- Rendre les champs Supabase optionnels (mode edge_proxy n'en a pas besoin)
ALTER TABLE public.app_connections
  ALTER COLUMN supabase_url DROP NOT NULL,
  ALTER COLUMN supabase_anon_key DROP NOT NULL;

-- Reconfiguration EMR Tontines
UPDATE public.app_connections
SET connection_mode = 'edge_proxy',
    endpoint_url = 'https://ctfivjezmznemwwetfdb.supabase.co/functions/v1/cyounne-agent',
    endpoint_key = 'DppSEXWYTjqjRnxf32JjCNDk-N9GHDQHqQoK99n9j--a38nPUrMZAJRWOTEigHjw',
    endpoint_header_name = 'x-cyounne-key',
    supabase_url = NULL,
    supabase_anon_key = NULL,
    service_role_key = NULL,
    updated_at = now()
WHERE name ILIKE '%tontine%' OR name ILIKE '%E.M.R%';