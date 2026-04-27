
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "admin upload media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update media" ON storage.objects FOR UPDATE USING (bucket_id = 'media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete media" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND public.has_role(auth.uid(),'admin'));
