import { afterEach, expect, it, vi } from "vitest";
import { createKeggApiFetch } from "./api-adapter";

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["/list/genome/562", "T00007\teco; Escherichia coli K-12 MG1655\n", [{id: "T00007", name: "eco; Escherichia coli K-12 MG1655"}]],
  ["/find/vtax/coronavirus", "11137\tHuman coronavirus 229E\n", [{id: "11137", name: "Human coronavirus 229E"}]],
  ["/link/genome/taxid:562/species", "taxid:562\tgn:eco\n", [{source: "taxid:562", target: "gn:eco"}]],
  ["/link/taxonomy/gn:eco/species", "gn:eco\ttaxid:562\n", [{source: "gn:eco", target: "taxid:562"}]],
  ["/conv/uniprot/hsa:7157", "hsa:7157\tup:P04637\n", [{source: "hsa:7157", target: "up:P04637"}]],
  ["/list/organism", "T01001\thsa\tHomo sapiens\tEukaryotes\r\n", [{id: "T01001", name: "hsa", extra: "Homo sapiens\tEukaryotes"}]],
  ["/ddi/D00564", "dr:D00564\tdr:D00100\tCI\tprovider detail\n", [{drug_a: "dr:D00564", drug_b: "dr:D00100", type: "CI", comment: "provider detail"}]],
])("preserves identifiers and provider fields for %s", async (path, body, data) => {
  const fetch = vi.fn().mockResolvedValue(new Response(body)); vi.stubGlobal("fetch", fetch);
  expect(await createKeggApiFetch()({method: "GET", path})).toEqual({status: 200, data});
  expect(fetch.mock.calls[0][0]).toBe(`https://rest.kegg.jp${path}`);
});

it.each(["", "\n", null])("returns empty rows only for successful empty response %j", async body => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
  expect(await createKeggApiFetch()({method: "GET", path: "/find/compound/no-matches"})).toEqual({status: 200, data: []});
});

it.each(["/list/genome/not-a-real-group", "/find/vtax/unavailable", "/link/genome/unavailable", "/get/unavailable"])("does not mislabel upstream 404 as no evidence at %s", async path => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", {status: 404})));
  await expect(createKeggApiFetch()({method: "GET", path})).rejects.toMatchObject({status: 404, data: {text: "not found", source_url: `https://rest.kegg.jp${path}`, body_bytes: 9, body_sha256: expect.any(String)}});
});

it("preserves info and flat-file text including database-specific update dates", async () => {
  const text = "vgenome\tPathogenic viruses\n\tLast update 2024/09/25\n";
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(text)));
  for (const path of ["/info/vgenome", "/get/T40004"]) {
    expect(await createKeggApiFetch()({method: "GET", path})).toEqual({status: 200, data: {text}});
  }
});

it.each(["<html>error</html>", "\uFEFF<!DOCTYPE html><html>blocked</html>", "Service unavailable", "\tmissing id"])("rejects malformed successful tables without losing evidence: %j", async text => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(text)));
  await expect(createKeggApiFetch()({method: "GET", path: "/list/genome/562"})).rejects.toMatchObject({status: 502, data: {text, body_sha256: expect.any(String)}});
});

it("preserves duplicate rows, overflow columns, whitespace and UTF-8", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("\uFEFFT1\t α \tfield 3\t\r\nT1\t α \tfield 3\t\r\n")));
  expect(await createKeggApiFetch()({method: "GET", path: "/list/genome/562"})).toEqual({status: 200, data: [{id: "T1", name: " α ", extra: "field 3\t"}, {id: "T1", name: " α ", extra: "field 3\t"}]});
});

it.each(["not json", "null", "[]", "1"])("requires an object for explicit JSON format: %j", async text => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(text)));
  await expect(createKeggApiFetch()({method: "GET", path: "/get/br:br08301/json"})).rejects.toMatchObject({status: 502, data: {text}});
});

it("parses explicit JSON even with a text MIME type, retaining all native fields", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('\uFEFF{"name":"root","children":[],"native":true}')));
  expect(await createKeggApiFetch()({method: "GET", path: "/get/br:br08301/json"})).toEqual({status: 200, data: {name: "root", children: [], native: true}});
});

it("preserves documented RDF text instead of fabricating TSV rows", async () => {
  const text = '<https://www.kegg.jp/entry/D01441> <https://example.invalid/predicate> "fixture" .\n';
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(text)));
  expect(await createKeggApiFetch()({method: "GET", path: "/link/atc/D01441/n-triple"})).toEqual({status: 200, data: {text}});
});

it("retains BRITE JSON and optional mirror routing", async () => {
  const data = {name: "fixture", children: [{name: "child"}]};
  const fetch = vi.fn().mockResolvedValue(Response.json(data)); vi.stubGlobal("fetch", fetch);
  expect(await createKeggApiFetch({KEGG_BASE_URL: "https://mirror.example"})({method: "GET", path: "/get/br:br08301/json"})).toEqual({status: 200, data});
  expect(fetch.mock.calls[0][0]).toBe("https://mirror.example/get/br:br08301/json");
});

it("rejects HTML success pages and unsupported methods", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("<html>error</html>", {headers: {"content-type": "text/html"}}));
  vi.stubGlobal("fetch", fetch);
  await expect(createKeggApiFetch()({method: "POST", path: "/list/genome/562"})).rejects.toThrow("GET requests only");
  expect(fetch).not.toHaveBeenCalled();
  await expect(createKeggApiFetch()({method: "GET", path: "/list/genome/562"})).rejects.toThrow("HTML");
});
