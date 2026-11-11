import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { KEGG_BASE } from "./http";

/** Validate the documented path grammar without narrowing organism/database IDs. */
export function keggRequest(request: Parameters<ApiFetchFn>[0], base = KEGG_BASE): { url: string; segments: string[] } {
  if (request.method !== "GET") throw new Error("KEGG REST supports GET requests only");
  if (request.body !== undefined || Object.keys(request.params ?? {}).length) throw new Error("KEGG uses path arguments, not query parameters or request bodies");
  if (!request.path.startsWith("/") || /[?#\\]/.test(request.path)) throw new Error("Invalid KEGG path");
  const segments = request.path.slice(1).split("/").map(value => decodeURIComponent(value));
  if (segments.some(value => !value || value === "." || value === ".." || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) throw new Error("Invalid KEGG path argument");
  const [operation, argument, option] = segments;
  const lengths: Record<string, number[]> = { info: [2], list: [2, 3], find: [3, 4], get: [2, 3], conv: [3], link: [3, 4], ddi: [2] };
  if (!Object.prototype.hasOwnProperty.call(lengths, operation) || !lengths[operation].includes(segments.length)) throw new Error("Unsupported KEGG operation or argument count");
  if (operation === "get" && option !== undefined && !["aaseq", "ntseq", "mol", "kcf", "conf", "kgml", "json"].includes(option)) throw new Error("Unsupported KEGG text format; binary images are not supported");
  if ((operation === "get" || operation === "list") && argument.split("+").length > 10) throw new Error("KEGG list/get accepts at most 10 entry identifiers");
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("KEGG base URL must be HTTPS without credentials, query or fragment");
  return { url: base.replace(/\/$/, "") + request.path, segments };
}
