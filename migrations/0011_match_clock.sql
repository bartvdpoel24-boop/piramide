update ladder_matches
set played_at = (
  ((played_at at time zone 'Europe/Amsterdam')::date + (created_at at time zone 'Europe/Amsterdam')::time)
  at time zone 'Europe/Amsterdam'
)
where to_char(played_at at time zone 'Europe/Amsterdam', 'HH24:MI') = '12:00'
  and to_char(created_at at time zone 'Europe/Amsterdam', 'HH24:MI') <> '12:00';
