
-- ===== ENUM rôles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'pax', 'mega_pax', 'super_pax', 'roi', 'reine');
CREATE TYPE public.alert_level AS ENUM ('leger', 'moyen', 'grave');
CREATE TYPE public.member_status AS ENUM ('actif', 'bloque', 'suspendu');

-- ===== profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  gender TEXT CHECK (gender IN ('XY','XX','unknown')) DEFAULT 'unknown',
  voice_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== user_roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ===== conversations =====
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nouvelle conversation',
  mode TEXT NOT NULL DEFAULT 'pax' CHECK (mode IN ('pax','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- ===== messages =====
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ===== api_keys (gérées via panneau admin) =====
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL UNIQUE,
  api_key TEXT,
  extra_config JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- ===== knowledge =====
CREATE TABLE public.knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  validated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge ENABLE ROW LEVEL SECURITY;

-- ===== members EMR =====
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pax_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  level public.app_role NOT NULL DEFAULT 'pax',
  status public.member_status NOT NULL DEFAULT 'actif',
  trust_score INTEGER NOT NULL DEFAULT 100,
  qr_code TEXT,
  avatar_url TEXT,
  team_leader TEXT,
  cumul NUMERIC NOT NULL DEFAULT 0,
  creances NUMERIC NOT NULL DEFAULT 0,
  gages NUMERIC NOT NULL DEFAULT 0,
  birthday DATE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- ===== alerts =====
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level public.alert_level NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ===== reports =====
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  pdf_url TEXT,
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ===== media_assets =====
CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- ===== audit_log =====
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ===== Trigger handle_new_user =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.id
  );
  -- assign default role 'pax'
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'pax');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Trigger updated_at =====
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_knowledge_updated BEFORE UPDATE ON public.knowledge FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== RLS POLICIES =====
-- profiles
CREATE POLICY "view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- conversations
CREATE POLICY "user manages own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- messages
CREATE POLICY "user manages own messages" ON public.messages FOR ALL USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- api_keys (admin only)
CREATE POLICY "admin api_keys" ON public.api_keys FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- knowledge
CREATE POLICY "admin knowledge write" ON public.knowledge FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth read knowledge" ON public.knowledge FOR SELECT USING (auth.role() = 'authenticated');

-- members
CREATE POLICY "admin members" ON public.members FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "view own member" ON public.members FOR SELECT USING (auth.uid() = user_id);

-- alerts (admin)
CREATE POLICY "admin alerts" ON public.alerts FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- reports (admin)
CREATE POLICY "admin reports" ON public.reports FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- media_assets
CREATE POLICY "admin media write" ON public.media_assets FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth read media" ON public.media_assets FOR SELECT USING (auth.role() = 'authenticated');

-- audit_log (admin)
CREATE POLICY "admin audit" ON public.audit_log FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed: API key services placeholders for admin panel
INSERT INTO public.api_keys (service, enabled) VALUES
  ('openai', true),
  ('brevo', true),
  ('onesignal', true),
  ('whatsapp_business', true),
  ('cloudinary', true),
  ('telegram_bot', true),
  ('buffer', true),
  ('activepieces', true),
  ('giphy', true),
  ('google_vision', true),
  ('dicebear', true),
  ('qr_code', true)
ON CONFLICT (service) DO NOTHING;

-- Seed: connaissances de base EMR
INSERT INTO public.knowledge (category, title, content, validated, tags) VALUES
('identite', 'EMR Business', 'EMR Business a été fondée le 08 janvier 2022 par Marcy-B EKEKE (prononcer e-ke-ke). Devise : Sécurité, Assurance, Gaieté. Mission : satisfaire les pax et réduire le chômage.', true, ARRAY['emr','histoire']),
('services', 'Services EMR', 'Paxage, graphisme, photographie, vente, WEWA MEN, formation.', true, ARRAY['services']),
('organisation', 'Structure', 'Team Leaders, Brand Ambassadeurs. Niveaux : PAX, MEGA PAX, SUPER PAX, Roi, Reine (honorifique admin).', true, ARRAY['structure']),
('plateforme', 'EMR Genesis & EMR-Zone', 'EMR Genesis : évolution de EMR Business, mouvement générationnel. EMR-Zone : marketplace, job board, publicité, Paxage, Cyounne.', true, ARRAY['plateforme']),
('paxage', 'Règles Paxage', 'Versements flexibles, rang de sortie, cumul, créances, gages, réinitialisation par cycle, validation team leaders, export CSV fond côté.', true, ARRAY['paxage']);
