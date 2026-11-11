import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { readKeggText, rejectKeggResponse } from "./http";
import { keggRequest } from "./request";

function parseTabSeparated(text: string, columns: string[]): Record<string, string>[] {
  return text.split(/\r?\n/).filter(line => line.length > 0).map(line => {
    const fields = line.split("\t");
    const row: Record<string, string> = {};
    for (let index = 0; index < columns.length; index++) row[columns[index]] = fields[index] ?? "";
    if (fields.length > columns.length) row.extra = fields.slice(columns.length).join("\t");
    return row;
  });
}

/** KEGG returns text tables; preserve values, duplicates and overflow columns. */
export function createKeggApiFetch(env?: { KEGG_BASE_URL?: string }): ApiFetchFn {
  return async request => {
    const { url, segments } = keggRequest(request, env?.KEGG_BASE_URL);
    const [operation, , option] = segments;
    const response = await readKeggText(url);
    const contentType = response.content_type.toLowerCase();
    const parsedText = response.text.replace(/^\uFEFF/, "");
    if (contentType.includes("text/html") || /^\s*<(?:!doctype\s+html|html|head|body)\b/i.test(parsedText)) rejectKeggResponse("KEGG returned HTML instead of API data", response);
    if (contentType.startsWith("image/") || contentType.includes("application/octet-stream")) rejectKeggResponse("KEGG returned unsupported binary data", response);
    if (operation === "get" && option === "json") {
      try {
        const data = JSON.parse(parsedText);
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Expected a BRITE object");
        return { status: response.status, data };
      } catch { rejectKeggResponse("KEGG returned malformed JSON", response); }
    }
    if (operation === "get" || operation === "info") return { status: response.status, data: { text: response.text } };
    if (operation === "link" && (segments[3] === "turtle" || segments[3] === "n-triple")) {
      return { status: response.status, data: { text: response.text } };
    }
    if (parsedText.split(/\r?\n/).some(line => line.length > 0 && (!line.includes("\t") || line.startsWith("\t")))) rejectKeggResponse("KEGG returned malformed tab-separated rows", response);
    const columns = operation === "ddi" ? ["drug_a", "drug_b", "type", "comment"]
      : operation === "conv" || operation === "link" ? ["source", "target"] : ["id", "name"];
    return { status: response.status, data: parseTabSeparated(parsedText, columns) };
  };
}
