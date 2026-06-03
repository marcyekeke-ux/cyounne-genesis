
CREATE TABLE public.tontine_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  app_connection_id uuid,
  phase text NOT NULL,
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, phase)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tontine_checkpoints TO authenticated;
GRANT ALL ON public.tontine_checkpoints TO service_role;

ALTER TABLE public.tontine_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin tontine_checkpoints all"
ON public.tontine_checkpoints
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_tontine_checkpoints
BEFORE UPDATE ON public.tontine_checkpoints
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
