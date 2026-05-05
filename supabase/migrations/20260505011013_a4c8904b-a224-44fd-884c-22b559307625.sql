DROP POLICY IF EXISTS "authenticated app_connections all" ON public.app_connections;
DROP POLICY IF EXISTS "admin app_connections all" ON public.app_connections;
CREATE POLICY "admin app_connections all"
ON public.app_connections
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "authenticated agent_events all" ON public.agent_events;
DROP POLICY IF EXISTS "admin agent_events all" ON public.agent_events;
CREATE POLICY "admin agent_events all"
ON public.agent_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));