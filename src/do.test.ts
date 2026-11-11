/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("cloudflare:workers", () => ({ RpcTarget: class {}, DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }));
import { KeggDataDO } from "./do";

const databases: DatabaseSync[] = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });
async function store(data: unknown) {
  const database = new DatabaseSync(":memory:"); databases.push(database);
  let ready: Promise<unknown> = Promise.resolve();
  const exec = (sql: string, ...args: SQLInputValue[]) => {
    const rows = database.prepare(sql).all(...args);
    return { toArray: () => rows, one: () => rows[0], [Symbol.iterator]: () => rows[Symbol.iterator]() };
  };
  const ctx = { blockConcurrencyWhile: (run: () => Promise<unknown>) => { ready = run(); return ready; },
    storage: { sql: { exec }, transactionSync: (run: () => unknown) => {
      database.exec("BEGIN"); try { const result = run(); database.exec("COMMIT"); return result; }
      catch (error) { database.exec("ROLLBACK"); throw error; }
    } } };
  // This test fixture implements only the Durable Object storage interfaces used here.
  const instance = new KeggDataDO(ctx as unknown as ConstructorParameters<typeof KeggDataDO>[0], {} as ConstructorParameters<typeof KeggDataDO>[1]);
  await ready;
  const result = await instance.fetch(new Request("https://fixture/process", { method: "POST", body: JSON.stringify({ data }) }));
  expect(await result.json()).toMatchObject({ success: true });
  return database;
}

it("materializes single flat-file/sequence text without dropping BOM or line endings", async () => {
  const text = "\uFEFF>hsa:7157 synthetic α\r\n" + "ACGTN".repeat(20001) + "\r\n";
  const database = await store({ text });
  let decoded = "";
  for (let start = 1; start <= text.length; start += 5000) decoded += database.prepare("SELECT substr(text,?,5000) AS part FROM kegg_text").get(start)?.part;
  expect(decoded).toBe(text);
});

it("retains repeated KEGG identifiers and overflow fields in ordered SQL rows", async () => {
  const data = [{ id: "T00007", name: "eco", extra: "Escherichia coli\tBacteria" }, { id: "T00007", name: "native repeated record", extra: "" }];
  const database = await store(data);
  expect(database.prepare("SELECT id,name,extra FROM kegg_entries ORDER BY _rowid").all()).toEqual(data);
});

it("materializes restaged SQL without colliding with native _rowid fields", async () => {
  const rows = [{ _rowid: 7, id: "T00007", native: { repeated: [1, 1] } }, { _rowid: 7, id: null }];
  const database = await store({ content: [], structuredContent: { success: true, data: { rows, sql: "SELECT * FROM fixture" } } });
  expect(database.prepare("SELECT native_json FROM query_rows ORDER BY row_index").all().map(row => JSON.parse(String(row.native_json)))).toEqual(rows);
});
