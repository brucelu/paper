-- 在 Supabase SQL Editor 一次性运行。先替换下方唯一的管理员邮箱占位符。
begin;
create table public.admins(email text primary key check(email=lower(email)));
insert into public.admins(email) values ('REPLACE_WITH_YOUR_ADMIN_EMAIL');
create table public.read_grants(email text primary key check(email=lower(email)), created_at timestamptz not null default now());
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admins where email=lower(auth.jwt()->>'email'));
$$;
create function public.can_read_all() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or exists(select 1 from public.read_grants where email=lower(auth.jwt()->>'email'));
$$;
revoke all on function public.is_admin(),public.can_read_all() from public;
grant execute on function public.is_admin(),public.can_read_all() to authenticated;
create table public.papers(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 reader_name text not null check(length(trim(reader_name)) between 1 and 100),
 reading_date date not null,
 title text not null check(length(trim(title)) between 1 and 500),
 publication_year integer not null check(publication_year between 1500 and 2200),
 journal text not null check(length(trim(journal)) between 1 and 300),
 abstract_zh text not null check(length(trim(abstract_zh)) between 1 and 20000),
 motivation_quote text not null check(length(trim(motivation_quote)) between 1 and 20000),
 model text not null check(length(trim(model)) between 1 and 20000),
 conclusions text not null check(length(trim(conclusions)) between 1 and 20000),
 image_paths text[] not null default '{}' check(cardinality(image_paths)<=6),
 created_at timestamptz not null default now()
);
create index on public.papers(owner_id);
create index on public.papers(created_at desc);
alter table public.admins enable row level security;
alter table public.read_grants enable row level security;
alter table public.papers enable row level security;
revoke all on public.admins,public.read_grants,public.papers from anon,authenticated;
grant select,insert,delete,update on public.read_grants to authenticated;
grant select,insert on public.papers to authenticated;
create policy grants_admin on public.read_grants for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy read_papers on public.papers for select to authenticated using(owner_id=auth.uid() or public.can_read_all());
create function public.valid_image_paths(paths text[]) returns boolean language sql stable set search_path='' as $$
 select not exists(select 1 from unnest(paths) p where p is null or split_part(p,'/',1)<>auth.uid()::text or p !~ '^[0-9a-f-]+/[0-9a-f-]+\.(png|jpg|webp)$');
$$;
revoke all on function public.valid_image_paths(text[]) from public;
grant execute on function public.valid_image_paths(text[]) to authenticated;
create policy submit_papers on public.papers for insert to authenticated with check(owner_id=auth.uid() and public.valid_image_paths(image_paths));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('paper-images','paper-images',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy upload_images on storage.objects for insert to authenticated with check(bucket_id='paper-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy read_images on storage.objects for select to authenticated using(bucket_id='paper-images' and ((storage.foldername(name))[1]=auth.uid()::text or (public.can_read_all() and exists(select 1 from public.papers p where name=any(p.image_paths)))));
create policy cleanup_images on storage.objects for delete to authenticated using(bucket_id='paper-images' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.papers p where name=any(p.image_paths)));
commit;
