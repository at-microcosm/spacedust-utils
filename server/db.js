import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';

const SUBS_PER_ACCOUNT_LIMIT = 5;
const SCHEMA_FNAME = './schema.sql';

export class DB {
  #stmt_insert_account;
  #stmt_get_account;
  #stmt_delete_account;
  #stmt_insert_push_sub;
  #stmt_get_all_sub_dids;
  #stmt_get_push_subs;
  #stmt_update_push_sub;
  #stmt_delete_push_sub;
  #stmt_get_push_info;
  #transactionally;
  #db;

  constructor(filename, init = false, handleExit = true) {
    const db = new Database(filename);

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    if (init) {
      const createSchema = readFileSync(SCHEMA_FNAME, 'utf8');
      db.exec(createSchema);
    }

    if (handleExit) { // probably a better way to do this 🤷‍♀️
      process.on('exit', () => db.close());
      process.on('SIGHUP', () => process.exit(128 + 1));
      process.on('SIGINT', () => process.exit(128 + 2));
      process.on('SIGTERM', () => process.exit(128 + 15));
    }

    this.#stmt_insert_account = db.prepare(
      `insert into accounts (did)
       values (?)
           on conflict do nothing`);

    this.#stmt_get_account = db.prepare(
      `select a.first_seen,
              count(*) as total_subs
         from accounts a
         left outer join push_subs p on (p.account_did = a.did)
        where a.did = ?
        group by a.did`);

    this.#stmt_delete_account = db.prepare(
      `delete from accounts
        where did = ?`);

    this.#stmt_insert_push_sub = db.prepare(
      `insert into push_subs (account_did, session, subscription)
       values (?, ?, ?)
           on conflict do update
          set subscription = excluded.subscription`);

    this.#stmt_get_all_sub_dids = db.prepare(
      `select distinct account_did
         from push_subs`);

    this.#stmt_get_push_subs = db.prepare(
      `select session,
              subscription,
              (julianday(CURRENT_TIMESTAMP) - julianday(last_push)) * 24 * 60 * 60
                as 'since_last_push'
         from push_subs
        where account_did = ?`);

    this.#stmt_update_push_sub = db.prepare(
      `update push_subs
          set last_push = CURRENT_TIMESTAMP,
              total_pushes = total_pushes + 1
        where session = ?`);

    this.#stmt_delete_push_sub = db.prepare(
      `delete from push_subs
        where account_did = ?
          and session = ?`);

    this.#stmt_get_push_info = db.prepare(
      `select created,
              last_push,
              total_pushes
         from push_subs
        where account_did = ?`);

    this.#transactionally = t => db.transaction(t).immediate();
  }

  addAccount(did) {
    this.#stmt_insert_account.run(did);
  }

  addPushSub(did, session, sub) {
    this.#transactionally(() => {
      const res = this.#stmt_get_account.get(did);
      if (!res) {
        throw new Error(`Could not find account for ${did}`);
      }
      if (res.total_subs >= SUBS_PER_ACCOUNT_LIMIT) {
        throw new Error(`Too many subscriptions for ${did}`);
      }
      this.#stmt_insert_push_sub.run(did, session, sub);
    });
  }

  removePushSub(did, session) {
    return this.#stmt_delete_push_sub.run(did, session);
  }

  getSubscribedDids() {
    return this.#stmt_get_all_sub_dids.all().map(r => r.account_did);
  }

  getSubsByDid(did) {
    return this.#stmt_get_push_subs.all(did);
  }

  updateLastPush(session) {
    this.#stmt_update_push_sub.run(session);
  }

  deleteSub(session) {
    this.#stmt_delete_push_sub.run(session);
  }
}
