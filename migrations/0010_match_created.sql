alter table ladder_matches add column if not exists created_at timestamptz;
update ladder_matches set created_at = played_at where created_at is null;
alter table ladder_matches alter column created_at set default now();
alter table ladder_matches alter column created_at set not null;
