create table accounts (
  did        text primary key,
  first_seen text not null default CURRENT_TIMESTAMP,

  check(did like 'did:%')
) strict;

create table push_subs (
  session      text primary key, -- uuidv4, bound to signed browser cookie
  account_did  text not null,
  subscription text not null, -- from browser, treat as opaque blob

  created      text not null default CURRENT_TIMESTAMP,

  last_push    text,
  total_pushes integer not null default 0,

  foreign key(account_did) references accounts(did)
    on delete cascade on update cascade
) strict;
