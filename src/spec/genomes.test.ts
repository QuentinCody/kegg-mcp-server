/// <reference types="node" />
import { runInNewContext } from "node:vm";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { afterEach, expect, it, vi } from "vitest";
import { createKeggApiFetch } from "../lib/api-adapter";
import { keggCatalog } from "./catalog";
import { genomeEndpoints, genomeWorkflow } from "./genomes";

afterEach(() => vi.unstubAllGlobals());
it("runs provider-grounded genome recipes through the real API proxy", async () => {
  const fetch = vi.fn().mockImplementation(async (url: string) => new Response(url.includes("/info/") ? "genome\tKEGG organisms\nRelease 119.0" : url.includes("/link/") ? "taxid:562\tgn:eco\n" : "T00007\teco; Escherichia coli K-12 MG1655\n"));
  vi.stubGlobal("fetch", fetch);
  // SAFETY: small fixture responses do not require staging or session capabilities.
  const proxy = createApiProxyTool({catalog: keggCatalog, apiFetch: createKeggApiFetch(), doNamespace: {} as DurableObjectNamespace, stagingPrefix: "kegg"});
  // SAFETY: no staged handles exist in these fixtures.
  const context = {} as Parameters<typeof proxy.handler>[1];
  const api = {get: (path: string, params?: Record<string, unknown>) => proxy.handler({method: "GET", path, params}, context)};
  const schedule = vi.fn((callback: () => void, _delay: number) => callback());
  const execute = (code: string) => runInNewContext(`(async()=>{${code}})()`, {api, setTimeout: schedule});
  expect(await execute(genomeEndpoints[0].example!)).toEqual([{id: "T00007", name: "eco; Escherichia coli K-12 MG1655"}]);
  expect(await execute(genomeEndpoints[1].example!)).toEqual([{source: "taxid:562", target: "gn:eco"}]);
  const result = await execute(genomeWorkflow.code);
  expect(result.release.text).toContain("Release 119.0");
  expect(result.genomes[0].id).toBe("T00007");
  expect(result.taxonomy[0].target).toBe("gn:eco");
  expect(schedule.mock.calls.map(c => c[1])).toEqual([400, 400]);
  expect(fetch.mock.calls.map(c => new URL(c[0]).pathname)).toEqual(["/list/genome/562", "/link/genome/taxid%3A562/species", "/info/genome", "/list/genome/562", "/link/genome/taxid%3A562/species"]);
  expect(fetch.mock.calls.every(c => !new URL(c[0]).search)).toBe(true);
});

it("discovers the new databases without advertising an immutable live release", () => {
  const databases = keggCatalog.endpoints.find(e => e.path === "/list/{database}")?.pathParams?.[0].enum;
  expect(databases).toEqual(expect.arrayContaining(["vtax", "vgenome", "ag", "vg", "vp", "rmodule", "ntmap"]));
  expect(keggCatalog.version).toBeUndefined();
  expect(keggCatalog.endpointCount).toBe(keggCatalog.endpoints.length);
  expect(keggCatalog.endpoints.find(e => e.path === "/list/{database}/{org}")?.deprecated).toBe(true);
});
