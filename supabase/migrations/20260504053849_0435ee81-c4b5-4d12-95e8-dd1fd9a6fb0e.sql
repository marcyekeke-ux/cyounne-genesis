
CREATE TABLE IF NOT EXISTS public.app_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  app_type text NOT NULL DEFAULT 'unknown',
  supabase_url text NOT NULL,
  supabase_anon_key text NOT NULL,
  service_role_key text,
  table_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_cache jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin app_connections all" ON public.app_connections
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_connections_updated_at
BEFORE UPDATE ON public.app_connections
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_connection_id uuid REFERENCES public.app_connections(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin agent_events all" ON public.agent_events
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_agent_events_created ON public.agent_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_app ON public.agent_events(app_connection_id);
