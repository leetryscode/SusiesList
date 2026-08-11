-- one photo per recipe wasn't enough - move to an array of Storage paths.
-- Existing single photos are preserved, not dropped.
alter table items add column photo_paths text[] not null default '{}';

update items set photo_paths = array[photo_path] where photo_path is not null;

alter table items drop column photo_path;
