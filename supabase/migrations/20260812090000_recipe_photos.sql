-- recipe photos: online-only for now (see SPEC.md §17). Private bucket,
-- scoped by family_id like everything else - path is `{family_id}/{filename}`.
alter table items add column photo_path text;

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', false);

create policy recipe_photos_select on storage.objects for select
  using (
    bucket_id = 'recipe-photos'
    and is_family_member((storage.foldername(name))[1]::uuid)
  );

create policy recipe_photos_insert on storage.objects for insert
  with check (
    bucket_id = 'recipe-photos'
    and is_family_member((storage.foldername(name))[1]::uuid)
  );
