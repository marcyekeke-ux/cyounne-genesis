-- app_connections: allow any authenticated user (admin UI is password-gated)
DROP POLICY IF EXISTS "authenticated app_connections all" ON public.app_connections;
CREATE POLICY "authenticated app_connections all"
ON public.app_connections
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- agent_events: same
DROP POLICY IF EXISTS "authenticated agent_events all" ON public.agent_events;
CREATE POLICY "authenticated agent_events all"
ON public.agent_events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);