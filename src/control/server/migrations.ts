import type { Database } from 'bun:sqlite'

const SCHEMA_VERSION = 2

/**
 * Versioned migrations. The abandoned unversioned rundowns/instances tables
 * (no meta row, missing revision/layer columns) are dropped on first boot.
 */
export function runMigrations(db: Database): void {
  db.exec(`
    create table if not exists meta (
      key text primary key,
      value text not null
    );
  `)

  const row = db.query<{ value: string }, [string]>('select value from meta where key = ?').get('schema_version')
  const current = row ? Number.parseInt(row.value, 10) : 0

  if (!Number.isFinite(current) || current < 1) {
    // Drop legacy tables from the abandoned controller attempt.
    const tables = db
      .query<{ name: string }, []>(
        `select name from sqlite_master where type = 'table' and name in ('rundowns', 'instances')`,
      )
      .all()
    if (tables.length > 0 && current === 0) {
      // Unversioned legacy: check for missing columns and wipe.
      const cols = db
        .query<{ name: string }, []>(`pragma table_info(instances)`)
        .all()
        .map((c) => c.name)
      const hasRevision = cols.includes('revision')
      const hasLayer = cols.includes('layer')
      if (!hasRevision || !hasLayer) {
        db.exec('drop table if exists instances;')
        db.exec('drop table if exists rundowns;')
      }
    }
  }

  if (current < 1) {
    db.exec(`
      create table if not exists rundowns (
        id text primary key,
        name text not null,
        created_at integer not null,
        updated_at integer not null,
        cued_instance_id text
      );

      create table if not exists instances (
        id text primary key,
        rundown_id text not null references rundowns(id) on delete cascade,
        template_id text not null,
        label text not null,
        sort_order integer not null,
        layer integer not null default 0,
        props text not null,
        on_screen integer not null default 0,
        revision integer not null default 1,
        updated_at integer not null
      );

      create index if not exists instances_rundown_idx
        on instances(rundown_id, sort_order);
    `)
  }

  if (current < 2) {
    db.exec(`
      create table if not exists packages (
        id text primary key,
        file text not null,
        name text not null,
        version text not null,
        content_hash text not null,
        format_version integer not null,
        enabled integer not null default 1,
        source text not null default 'disk',
        installed_at integer not null,
        error text
      );
    `)
  }

  if (current < SCHEMA_VERSION) {
    db.query('insert or replace into meta (key, value) values (?, ?)').run(
      'schema_version',
      String(SCHEMA_VERSION),
    )
  }
}
