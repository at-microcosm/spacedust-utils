create table if not exists accounts (
  did             text primary key,
  first_seen      text not null default CURRENT_TIMESTAMP,
  role            text null,
  secret_password text null,
  notify_enabled  integer not null default false,
  notify_self     integer not null default false,

  check(did like 'did:%')
) strict;

create table if not exists push_subs (
  session      text primary key, -- uuidv4, bound to signed browser cookie
  account_did  text not null,
  subscription text not null, -- from browser, treat as opaque blob

  created      text not null default CURRENT_TIMESTAMP,

  last_push    text,
  total_pushes integer not null default 0,

  foreign key(account_did) references accounts(did)
    on delete cascade on update cascade
) strict;

create table if not exists top_secret_passwords (
  password text primary key,
  added    text not null default CURRENT_TIMESTAMP,
  expired  text null, -- timestamp

  check(length(password) >= 3)
) strict;

create table if not exists mute_by_secondary (
  account_did text not null,
  selector    text not null,
  selection   text not null,
  mute        integer not null default true,

  primary key(account_did, selector, selection),
  check(selector in ('all', 'app', 'group', 'source')),

  foreign key(account_did) references accounts(did)
    on delete cascade on update cascade
) strict;
