create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid references users(id),
  status text check (status in ('voting','quiz','finished')) default 'voting',
  created_at timestamptz default now()
);

create table room_members (
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);

create table movies (
  id text primary key, -- id de la API (ej TMDB)
  title text not null,
  year int,
  poster_url text,
  overview text
);

create table room_movies (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  movie_id text references movies(id),
  proposed_by uuid references users(id),
  accepted boolean,
  created_at timestamptz default now()
);

create table movie_votes (
  room_movie_id uuid references room_movies(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  vote boolean not null,
  voted_at timestamptz default now(),
  primary key (room_movie_id, user_id)
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  text text not null,
  options text[] not null,
  correct_index int not null,
  duration_seconds int default 20,
  published boolean default false,
  question_order int,
  created_at timestamptz default now()
);

create table answers (
  question_id uuid references questions(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  option_index int not null,
  answered_at timestamptz default now(),
  primary key (question_id, user_id)
);
