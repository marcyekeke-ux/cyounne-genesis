-- Table des règles configurables par tontine connectée
CREATE TABLE IF NOT EXISTS public.tontine_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_connection_id UUID NOT NULL REFERENCES public.app_connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Formule frais retard: { type: 'fixed_per_day'|'percent_per_week'|'tiered', value: number, tiers?: [{from_day,to_day,amount}] }
  late_fee_formula JSONB NOT NULL DEFAULT '{"type":"fixed_per_day","value":500}'::jsonb,
  -- Politique blocage: { after_late_count: 3, action: 'block_all'|'skip_next'|'alert_only' }
  block_policy JSONB NOT NULL DEFAULT '{"after_late_count":3,"action":"alert_only"}'::jsonb,
  -- Félicitations: { enabled: bool, days_before: 1, channel: 'whatsapp'|'push'|'all', template: text }
  congrats_policy JSONB NOT NULL DEFAULT '{"enabled":true,"days_before":1,"channel":"all","template":"Yoh {name} 🎉 Demain c''est ta sortie tontine. Sois prêt(e) !"}'::jsonb,
  -- Reçu PDF: { enabled: bool, auto_send: bool, include_qr: bool }
  receipt_policy JSONB NOT NULL DEFAULT '{"enabled":true,"auto_send":true,"include_qr":true}'::jsonb,
  -- Mapping tables distantes: { contributions: 'cotisations', members: 'pax', payouts: 'sorties' }
  table_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tontine_rules_app ON public.tontine_rules(app_connection_id);

ALTER TABLE public.tontine_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin tontine_rules all" ON public.tontine_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_tontine_rules_updated
  BEFORE UPDATE ON public.tontine_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Journal des actions auto exécutées
CREATE TABLE IF NOT EXISTS public.tontine_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.tontine_rules(id) ON DELETE SET NULL,
  app_connection_id UUID REFERENCES public.app_connections(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'late_fee_applied' | 'pax_blocked' | 'congrats_sent' | 'receipt_generated'
  target_ref TEXT, -- id pax / cotisation / sortie côté app distante
  status TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'error' | 'skipped'
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tontine_actions_rule ON public.tontine_actions(rule_id);
CREATE INDEX IF NOT EXISTS idx_tontine_actions_created ON public.tontine_actions(created_at DESC);

ALTER TABLE public.tontine_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin tontine_actions all" ON public.tontine_actions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));