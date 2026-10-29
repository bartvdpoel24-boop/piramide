alter table ladder_challenges add column if not exists play_on date;

do $$
declare name text;
begin
  for name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'ladder_challenges'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%status%'
  loop
    execute format('alter table ladder_challenges drop constraint %I', name);
  end loop;
end $$;

alter table ladder_challenges add constraint ladder_challenges_status_check
  check (status in ('open', 'accepted', 'declined', 'played', 'cancelled', 'expired'));
