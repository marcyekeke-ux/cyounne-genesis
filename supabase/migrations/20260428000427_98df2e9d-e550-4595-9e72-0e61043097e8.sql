
-- Fix: les sessions anonymes ont role 'anon' pas 'authenticated'.
-- Autoriser lecture (SELECT) des knowledge & media pour TOUS (public), déjà contenu non sensible.
DROP POLICY IF EXISTS "auth read knowledge" ON public.knowledge;
CREATE POLICY "public read knowledge"
  ON public.knowledge FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "auth read media" ON public.media_assets;
CREATE POLICY "public read media"
  ON public.media_assets FOR SELECT
  USING (true);

-- Permettre aux utilisateurs (même anonymes) avec rôle admin d'insérer, si ce n'est déjà couvert.
-- Les policies "admin ... write" (ALL) couvrent déjà via has_role — rien à ajouter.

-- S'assurer que la lecture des comptes de base (stats) est possible pour admins anonymes :
-- déjà OK via policies "admin xxx" pour ALL.
