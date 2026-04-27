
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id text,
  from_number text NOT NULL,
  to_number text,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  body text,
  status text DEFAULT 'received',
  cyounne_reply text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin whatsapp" ON public.whatsapp_messages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL UNIQUE,
  user_id uuid,
  label text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin push read" ON public.push_subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "anyone insert push" ON public.push_subscriptions FOR INSERT
  WITH CHECK (true);

INSERT INTO public.api_keys (service, api_key, enabled, extra_config)
VALUES
  ('onesignal', NULL, true, '{"app_id":"","rest_api_key":""}'::jsonb),
  ('whatsapp_business', NULL, true, '{"phone_number_id":"","verify_token":"cyounne_verify","access_token":""}'::jsonb),
  ('activepieces', NULL, true, '{"webhook_url":""}'::jsonb)
ON CONFLICT (service) DO NOTHING;
