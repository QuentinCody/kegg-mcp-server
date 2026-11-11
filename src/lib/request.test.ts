import { expect, it } from "vitest";
import { keggRequest } from "./request";

it.each(["/other", "//evil.test/info/kegg", "/info/../kegg", "/info/%2e%2e", "/info/kegg?x=y", "/info/kegg#fragment", "/info/ke%0Agg", "/info/kegg/extra", "/get/C00002/image", "/get/map00600/image2x"])("rejects invalid or binary route %s", path => {
  expect(() => keggRequest({method: "GET", path})).toThrow();
});
it("rejects ignored inputs and oversized entry batches", () => {
  for (const request of [{method: "POST", path: "/info/kegg"}, {method: "GET", path: "/info/kegg", body: {}}, {method: "GET", path: "/info/kegg", params: {limit: 10}}]) expect(() => keggRequest(request)).toThrow();
  expect(() => keggRequest({method: "GET", path: "/get/" + Array(11).fill("hsa:7157").join("+")})).toThrow("10 entry");
});
it.each(["http://mirror.example", "https://user:password@mirror.example", "https://mirror.example?x=y", "https://mirror.example/#fragment"])("rejects invalid configured base %s", base => {
  expect(() => keggRequest({method: "GET", path: "/info/kegg"}, base)).toThrow("HTTPS");
});
it("preserves proxy-encoded colons, entry separators and query keywords exactly once", () => {
  for (const path of ["/get/hsa%3A7157%2Bhsa%3A7158", "/find/genes/shiga%2Btoxin", "/link/genome/taxid%3A562/species", "/list/T01001", "/list/brite/ko"]){
    expect(keggRequest({method: "GET", path}, "https://mirror.example/rest/").url).toBe("https://mirror.example/rest" + path);
  }
});
