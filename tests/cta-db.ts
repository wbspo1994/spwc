import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
import { readFileSync } from "node:fs";
export class TestDB {
  sqlite = new DatabaseSync(":memory:");
  failOn = "";
  constructor() {
    this.sqlite.exec(
      readFileSync(
        new URL("../migrations/0001_inquiries.sql", import.meta.url),
        "utf8",
      ),
    );
  }
  prepare(sql: string) {
    const db = this;
    let args: unknown[] = [];
    return {
      bind(...values: unknown[]) {
        args = values;
        return this;
      },
      async first() {
        if (db.failOn && sql.includes(db.failOn))
          throw new Error("injected_d1");
        return db.sqlite.prepare(sql).get(...(args as never[])) ?? null;
      },
      async all() {
        return {
          success: true,
          results: db.sqlite.prepare(sql).all(...(args as never[])),
          meta: {},
        };
      },
      async run() {
        if (db.failOn && sql.includes(db.failOn))
          throw new Error("injected_d1");
        const result = db.sqlite.prepare(sql).run(...(args as never[]));
        return {
          success: true,
          results: [],
          meta: { changes: Number(result.changes) },
        };
      },
      _sql: sql,
      _args: () => args,
    };
  }
  async batch(statements: ReturnType<TestDB["prepare"]>[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) {
        if (this.failOn && statement._sql.includes(this.failOn))
          throw new Error("injected_batch");
        const stmt = this.sqlite.prepare(statement._sql);
        if (/^SELECT/i.test(statement._sql))
          results.push({
            success: true,
            results: stmt.all(...(statement._args() as never[])),
            meta: {},
          });
        else {
          const result = stmt.run(...(statement._args() as never[]));
          results.push({
            success: true,
            results: [],
            meta: { changes: Number(result.changes) },
          });
        }
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (e) {
      this.sqlite.exec("ROLLBACK");
      throw e;
    }
  }
  rows(table: string) {
    if (!["inquiries", "notification_outbox"].includes(table))
      throw new Error();
    return this.sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<
      string,
      any
    >[];
  }
  close() {
    this.sqlite.close();
  }
}
