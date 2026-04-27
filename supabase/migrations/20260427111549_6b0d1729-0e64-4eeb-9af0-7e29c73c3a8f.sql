
DROP POLICY IF EXISTS "anyone insert push" ON public.push_subscriptions;
CREATE POLICY "valid insert push" ON public.push_subscriptions FOR INSERT
  WITH CHECK (player_id IS NOT NULL AND length(player_id) > 4);
