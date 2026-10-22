create table if not exists ladders (
  id text primary key,
  name text not null,
  invite_code text not null unique,
  challenge_range integer not null default 4,
  owner_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists ladder_players (
  id text primary key,
  ladder_id text not null references ladders(id) on delete cascade,
  user_id text,
  display_name text not null,
  rank integer not null,
  stippen integer not null default 0,
  note_color text not null default 'cream',
  created_at timestamptz not null default now()
);

create unique index if not exists ladder_players_rank_idx
  on ladder_players (ladder_id, rank);
create unique index if not exists ladder_players_user_idx
  on ladder_players (ladder_id, user_id)
  where user_id is not null;

create table if not exists ladder_availability (
  player_id text not null references ladder_players(id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  start_min integer not null check (start_min between 0 and 1440),
  end_min integer not null check (end_min > start_min and end_min <= 1440),
  primary key (player_id, day)
);

create table if not exists ladder_challenges (
  id text primary key,
  ladder_id text not null references ladders(id) on delete cascade,
  challenger_id text not null references ladder_players(id) on delete cascade,
  defender_id text not null references ladder_players(id) on delete cascade,
  status text not null check (status in ('open', 'accepted', 'declined', 'played', 'cancelled')),
  proposed_day smallint,
  proposed_start_min integer,
  message text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists ladder_challenges_ladder_idx
  on ladder_challenges (ladder_id, created_at desc);

create table if not exists ladder_matches (
  id text primary key,
  ladder_id text not null references ladders(id) on delete cascade,
  challenge_id text,
  winner_id text references ladder_players(id) on delete set null,
  loser_id text references ladder_players(id) on delete set null,
  winner_name text not null,
  loser_name text not null,
  winner_score integer not null,
  loser_score integer not null,
  winner_rank_before integer not null,
  loser_rank_before integer not null,
  swapped boolean not null,
  stip_awarded boolean not null default false,
  played_at timestamptz not null,
  note text not null default '',
  recorded_by text not null
);

create index if not exists ladder_matches_ladder_idx
  on ladder_matches (ladder_id, played_at desc);
