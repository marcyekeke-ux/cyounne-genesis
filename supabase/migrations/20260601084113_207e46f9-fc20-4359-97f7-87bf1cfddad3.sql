-- Créer ou mettre à jour la règle Tontine pour EMR Tontines avec le bon mapping
INSERT INTO public.tontine_rules (app_connection_id, name, enabled, late_fee_formula, block_policy, congrats_policy, receipt_policy, table_mapping)
SELECT 
  'c72dd6b3-f8d9-411b-a71d-751ab8f9822a'::uuid,
  'Règles EMR Tontines',
  true,
  '{"type":"fixed_per_day","value":200}'::jsonb,
  '{"action":"alert_only","after_late_count":3,"late_after_days":2}'::jsonb,
  '{"enabled":true,"days_before":1,"channel":"all","template":"Yoh {name} 🎉 Demain c''est ta sortie tontine, sois prêt(e) !"}'::jsonb,
  '{"enabled":true,"auto_send":false,"include_qr":true}'::jsonb,
  '{"versements":"versements","profiles":"profiles","pax_groups":"pax_groups","recus":"recus","groups":"groups"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.tontine_rules WHERE app_connection_id = 'c72dd6b3-f8d9-411b-a71d-751ab8f9822a'::uuid
);

UPDATE public.tontine_rules
SET table_mapping = '{"versements":"versements","profiles":"profiles","pax_groups":"pax_groups","recus":"recus","groups":"groups"}'::jsonb,
    block_policy = jsonb_set(COALESCE(block_policy,'{}'::jsonb), '{late_after_days}', '2'::jsonb, true),
    updated_at = now()
WHERE app_connection_id = 'c72dd6b3-f8d9-411b-a71d-751ab8f9822a'::uuid;