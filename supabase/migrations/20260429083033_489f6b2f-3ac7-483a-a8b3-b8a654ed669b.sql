begin;

alter table public.api_keys enable row level security;
alter table public.knowledge enable row level security;
alter table public.media_assets enable row level security;
alter table public.members enable row level security;
alter table public.audit_log enable row level security;
alter table public.user_roles enable row level security;

-- Normalize admin policies per operation for reliability
 drop policy if exists "admin api_keys" on public.api_keys;
create policy "admin api_keys read"
on public.api_keys
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));
create policy "admin api_keys insert"
on public.api_keys
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin api_keys update"
on public.api_keys
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin api_keys delete"
on public.api_keys
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

 drop policy if exists "admin knowledge write" on public.knowledge;
create policy "admin knowledge insert"
on public.knowledge
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin knowledge update"
on public.knowledge
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin knowledge delete"
on public.knowledge
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));
create policy "admin knowledge read"
on public.knowledge
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

 drop policy if exists "admin media write" on public.media_assets;
create policy "admin media insert"
on public.media_assets
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin media update"
on public.media_assets
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin media delete"
on public.media_assets
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));
create policy "admin media read"
on public.media_assets
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

 drop policy if exists "admin members" on public.members;
create policy "admin members read"
on public.members
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));
create policy "admin members insert"
on public.members
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin members update"
on public.members
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin members delete"
on public.members
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

 drop policy if exists "admin audit" on public.audit_log;
create policy "admin audit insert"
on public.audit_log
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin audit read"
on public.audit_log
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

 drop policy if exists "admin manage roles" on public.user_roles;
create policy "admin roles read"
on public.user_roles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));
create policy "admin roles insert"
on public.user_roles
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin roles update"
on public.user_roles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
create policy "admin roles delete"
on public.user_roles
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Storage policies for media bucket uploads by admins
create policy "admin media bucket read"
on storage.objects
for select
to authenticated
using (bucket_id = 'media' and public.has_role(auth.uid(), 'admin'));

create policy "admin media bucket insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'media' and public.has_role(auth.uid(), 'admin'));

create policy "admin media bucket update"
on storage.objects
for update
to authenticated
using (bucket_id = 'media' and public.has_role(auth.uid(), 'admin'))
with check (bucket_id = 'media' and public.has_role(auth.uid(), 'admin'));

create policy "admin media bucket delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'media' and public.has_role(auth.uid(), 'admin'));

commit;