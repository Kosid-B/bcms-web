-- Ensure the payment-slips bucket exists and is public
insert into storage.buckets (id, name, public)
values ('payment-slips', 'payment-slips', true)
on conflict (id) do update set public = excluded.public;

-- Drop old loose policies if they exist
drop policy if exists "payment_slips_upload" on storage.objects;
drop policy if exists "payment_slips_read" on storage.objects;
drop policy if exists "payment_slips_upload_own_org" on storage.objects;
drop policy if exists "payment_slips_read_own_org" on storage.objects;
drop policy if exists "payment_slips_update_own_org" on storage.objects;
drop policy if exists "payment_slips_delete_own_org" on storage.objects;

-- 1. Policy: Authenticated users can upload slips to their own org folder only
-- Path format: {org_id}/slips/{filename}
create policy "payment_slips_upload_own_org" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'payment-slips' AND
  (storage.foldername(name))[1] = (
    select org_id::text 
    from public.profiles 
    where id = auth.uid()
  )
);

-- 2. Policy: Authenticated users can view slips from their own org
-- (Though bucket is public, this allows listing/accessing via SDK)
create policy "payment_slips_read_own_org" on storage.objects
for select to authenticated
using (
  bucket_id = 'payment-slips' AND
  (storage.foldername(name))[1] = (
    select org_id::text 
    from public.profiles 
    where id = auth.uid()
  )
);

-- 3. Policy: Authenticated users can update slips in their own org folder
create policy "payment_slips_update_own_org" on storage.objects
for update to authenticated
using (
  bucket_id = 'payment-slips' AND
  (storage.foldername(name))[1] = (
    select org_id::text 
    from public.profiles 
    where id = auth.uid()
  )
);

-- 4. Policy: Authenticated users can delete slips in their own org folder
create policy "payment_slips_delete_own_org" on storage.objects
for delete to authenticated
using (
  bucket_id = 'payment-slips' AND
  (storage.foldername(name))[1] = (
    select org_id::text 
    from public.profiles 
    where id = auth.uid()
  )
);

-- 5. Policy: Allow Service Role (Admin) to do everything
-- (This is usually default, but good to keep in mind)

-- 6. Policy: Allow anyone to read slips if they have the direct public URL
-- This is handled by the 'public: true' flag on the bucket itself in Supabase,
-- so no additional SELECT policy for 'anon' is strictly required for the 
-- /storage/v1/object/public/ endpoint.
