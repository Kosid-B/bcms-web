create or replace function public.apply_rbac_seed_for_known_users()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set
    access_level = case
      when lower(u.email) = 'buffkosid@gmail.com' then 'org'
      else 'department'
    end,
    department = case
      when lower(u.email) = 'support@b-tctraining.com' then 'IT'
      when lower(u.email) = 'keawtao2520@gmail.com' then 'Finance'
      else null
    end
  from auth.users u
  where p.id = u.id
    and lower(u.email) in (
      'buffkosid@gmail.com',
      'support@b-tctraining.com',
      'keawtao2520@gmail.com'
    );
end;
$$;

select public.apply_rbac_seed_for_known_users();
drop function public.apply_rbac_seed_for_known_users();
