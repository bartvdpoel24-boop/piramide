alter table ladder_availability add column if not exists id text;

update ladder_availability
set id = player_id || ':' || day::text || ':' || start_min::text
where id is null;

alter table ladder_availability alter column id set not null;

alter table ladder_availability drop constraint if exists ladder_availability_pkey;

alter table ladder_availability add primary key (id);
