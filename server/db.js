import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';

const SUBS_PER_ACCOUNT_LIMIT = 5;
const SECONDARY_FILTERS_LIMIT = 100;

const SCHEMA_FNAME = './schema.sql';

export class DB {
  #stmt_insert_account;
  #stmt_get_account;
  #stmt_delete_account;
  #stmt_insert_push_sub;
  #stmt_get_all_sub_dids;
  #stmt_get_push_subs;
  #stmt_get_push_sub;
  #stmt_update_push_sub;
  #stmt_delete_push_sub;
  #stmt_get_push_info;
  #stmt_set_role;
  #stmt_get_notify_account_globals;
  #stmt_set_notify_account_globals;
  #stmt_set_notification_filter;
  #stmt_get_notification_filter;
  #stmt_count_notification_filters;
  #stmt_rm_notification_filter;

  #stmt_admin_add_secret;
  #stmt_admin_expire_secret;
  #stmt_admin_get_secrets;
  #stmt_admin_secret_accounts;
  #stmt_admin_nonsecret_accounts;

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
              a.role,
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

    this.#stmt_get_push_sub = db.prepare(
      `select session,
              subscription,
              (julianday(CURRENT_TIMESTAMP) - julianday(last_push)) * 24 * 60 * 60
                as 'since_last_push'
         from push_subs
        where session = ?`);

    this.#stmt_update_push_sub = db.prepare(
      `update push_subs
          set last_push = CURRENT_TIMESTAMP,
              total_pushes = total_pushes + 1
        where session = ?`);

    this.#stmt_delete_push_sub = db.prepare(
      `delete from push_subs
        where session = ?`);

    this.#stmt_get_push_info = db.prepare(
      `select created,
              last_push,
              total_pushes
         from push_subs
        where account_did = ?`);

    this.#stmt_set_role = db.prepare(
      `update accounts
          set role = :role,
              secret_password = :secret_password
        where did = :did
          and :secret_password in (select password
                                     from top_secret_passwords)`);

    this.#stmt_get_notify_account_globals = db.prepare(
      `select notify_enabled,
              notify_self
         from accounts
        where did = :did`);

    this.#stmt_set_notify_account_globals = db.prepare(
      `update accounts
          set notify_enabled = :notify_enabled,
              notify_self = :notify_self
        where did = :did`);

    this.#stmt_set_notification_filter = db.prepare(
      `insert into notification_filters (account_did, selector, selection, notify)
       values (:did, :selector, :selection, :notify)
           on conflict do update
          set notify = excluded.notify`);

    this.#stmt_get_notification_filter = db.prepare(
      `select notify
         from notification_filters
        where account_did = :did
          and selector = :selector
          and selection = :selection`);

    this.#stmt_count_notification_filters = db.prepare(
      `select count(*) as n
         from notification_filters
        where account_did = :did`);

    this.#stmt_rm_notification_filter = db.prepare(
      `delete from notification_filters
        where account_did = :did
          and selector = :selector
          and selection = :selection`);


    this.#stmt_admin_add_secret = db.prepare(
      `insert into top_secret_passwords (password)
       values (?)`);

    this.#stmt_admin_expire_secret = db.prepare(
      `update top_secret_passwords
          set expired = CURRENT_TIMESTAMP
        where expired is null
          and password = ?`);

    this.#stmt_admin_get_secrets = db.prepare(
      `select password,
              unixepoch(added) * 1000 as 'added',
              unixepoch(expired) * 1000 as 'expired'
         from top_secret_passwords
        order by expired, added desc`);

    this.#stmt_admin_secret_accounts = db.prepare(
      `select did,
              unixepoch(first_seen) * 1000 as 'first_seen',
              role,
              count(*) as 'active_subs',
              sum(p.total_pushes) as 'total_pushes',
              unixepoch(max(p.last_push)) * 1000 as 'last_push'
         from accounts
         left outer join push_subs p on (p.account_did = did)
        where secret_password = :password
        group by did
        order by first_seen desc`);

    this.#stmt_admin_nonsecret_accounts = db.prepare(
      `select did,
              unixepoch(first_seen) * 1000 as 'first_seen',
              role,
              count(*) as 'active_subs',
              sum(p.total_pushes) as 'total_pushes',
              unixepoch(max(p.last_push)) * 1000 as 'last_push'
         from accounts
         left outer join push_subs p on (p.account_did = did)
         left outer join top_secret_passwords s on (s.password = secret_password)
        where s.password is null
        group by did
        order by first_seen desc`);

    this.#transactionally = t => db.transaction(t).immediate();
  }

  addAccount(did) {
    this.#stmt_insert_account.run(did);
  }

  getAccount(did) {
    return this.#stmt_get_account.get(did);
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

  getSubscribedDids() {
    return this.#stmt_get_all_sub_dids.all().map(r => r.account_did);
  }

  getSubsByDid(did) {
    return this.#stmt_get_push_subs.all(did);
  }

  getSubBySession(session) {
    return this.#stmt_get_push_sub.get(session);
  }

  updateLastPush(session) {
    this.#stmt_update_push_sub.run(session);
  }

  deleteSub(session) {
    this.#stmt_delete_push_sub.run(session);
  }

  setRole(params) {
    let res = this.#stmt_set_role.run(params);
    return res.changes > 0;
  }

  getNotifyAccountGlobals(did) {
    return this.#stmt_get_notify_account_globals.get({ did });
  }

  setNotifyAccountGlobals(did, globals) {
    this.#transactionally(() => {
      const update = this.getNotifyAccountGlobals(did);
      if (globals.notify_enabled !== undefined) update.notify_enabled = +globals.notify_enabled;
      if (globals.notify_self !== undefined) update.notify_self = +globals.notify_self;
      update.did = did;
      this.#stmt_set_notify_account_globals.run(update);
    });
  }

  getNotificationFilter(did, selector, selection) {
    const res = this.#stmt_get_notification_filter.get({ did, selector, selection });
    const dbNotify = res?.notify;
    if (dbNotify === 1) return true;
    else if (dbNotify === 0) return false;
    else return null;
  }

  setNotificationFilter(did, selector, selection, notify) {
    if (notify === null) {
      this.#stmt_rm_notification_filter.run({ did, selector, selection });
    } else {
      this.#transactionally(() => {
        const { n } = this.#stmt_count_notification_filters.get({ did });
        if (n >= SECONDARY_FILTERS_LIMIT) {
          throw new Error('max filters set for account');
        }
        let dbNotify = null;
        if (notify === true) dbNotify = 1;
        else if (notify === false) dbNotify = 0;
        this.#stmt_set_notification_filter.run({ did, selector, selection, notify: dbNotify });
      });
    }
  }


  addTopSecret(secretPassword) {
    this.#stmt_admin_add_secret.run(secretPassword);
  }

  expireTopSecret(secretPassword) {
    let res = this.#stmt_admin_expire_secret.run(secretPassword);
    return res.changes > 0;
  }

  getSecrets() {
    return this.#stmt_admin_get_secrets.all();
  }

  getSecretAccounts(secretPassword) {
    return this.#stmt_admin_secret_accounts.all({ password: secretPassword });
  }

  getNonSecretAccounts() {
    return this.#stmt_admin_nonsecret_accounts.all();
  }
}
