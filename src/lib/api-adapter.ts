// interlinked-tdd: exempt
import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { keggFetch } from "./http";

/**
 * KEGG REST returns tab-delimited text for nearly every operation. The
 * adapter parses these into arrays of objects so SQL staging and Code Mode
 * tooling can operate on structured rows.
 *
 * Operation → response shape mapping:
 *
 *   /info/<db>           → single descriptive blob (text)
 *   /list/<db>           → rows of `id\tname` (or `id\tname\tdescription` for some)
 *   /find/<db>/<query>   → rows of `id\tname`
 *   /get/<dbentries>     → KEGG flat file (multi-block plain text). Returned as text.
 *   /get/<dbentries>/json → JSON
 *   /conv/<tgt>/<src>    → rows of `source_id\ttarget_id`
 *   /link/<tgt>/<src>    → rows of `source_id\ttarget_id`
 *   /ddi/<dbentry>       → rows of `drug_a\tdrug_b\ttype\tcomment`
 *
 * The adapter looks at the FIRST path segment to pick the correct parser.
 * 404s on KEGG mean "no rows match" — we surface those as empty arrays.
 */

type Operation =
	| "info"
	| "list"
	| "find"
	| "get"
	| "conv"
	| "link"
	| "ddi"
	| "unknown";

const TEXT_PARSE_OPERATIONS: ReadonlySet<Operation> = new Set([
	"list",
	"find",
	"conv",
	"link",
	"ddi",
]);

function detectOperation(path: string): Operation {
	const trimmed = path.replace(/^\/+/, "").split("/")[0]?.toLowerCase();
	switch (trimmed) {
		case "info":
		case "list":
		case "find":
		case "get":
		case "conv":
		case "link":
		case "ddi":
			return trimmed;
		default:
			return "unknown";
	}
}

function isJsonGet(path: string): boolean {
	// /get/<entries>/json → JSON output
	const segments = path.replace(/^\/+/, "").split("/");
	return (
		segments.length >= 3 &&
		segments[0]?.toLowerCase() === "get" &&
		segments[segments.length - 1]?.toLowerCase() === "json"
	);
}

function parseTabSeparated(
	text: string,
	columns: string[],
): Record<string, string>[] {
	if (!text) return [];
	return text
		.split(/\r?\n/)
		.filter((line) => line.length > 0)
		.map((line) => {
			const fields = line.split("\t");
			const row: Record<string, string> = {};
			for (let i = 0; i < columns.length; i++) {
				row[columns[i]] = fields[i] ?? "";
			}
			// Capture overflow fields (rare) into a trailing `extra` column.
			if (fields.length > columns.length) {
				row.extra = fields.slice(columns.length).join("\t");
			}
			return row;
		});
}

function parseListLikeResponse(text: string, op: Operation): unknown {
	switch (op) {
		case "list":
		case "find":
			return parseTabSeparated(text, ["id", "name"]);
		case "conv":
		case "link":
			return parseTabSeparated(text, ["source", "target"]);
		case "ddi":
			return parseTabSeparated(text, ["drug_a", "drug_b", "type", "comment"]);
		default:
			return { text };
	}
}

interface KeggApiAdapterEnv {
	// Reserved for future use (e.g., proxying behind a custom KEGG mirror).
	KEGG_BASE_URL?: string;
}

export function createKeggApiFetch(env?: KeggApiAdapterEnv): ApiFetchFn {
	return async (request) => {
		const response = await keggFetch(request.path, request.params, {
			baseUrl: env?.KEGG_BASE_URL,
		});

		if (response.status === 404) {
			// KEGG uses 404 for "no matches" on find/list. Treat as empty result.
			const op = detectOperation(request.path);
			if (TEXT_PARSE_OPERATIONS.has(op)) {
				return { status: 200, data: [] };
			}
			// For other ops, surface as a structured error.
			return {
				status: 404,
				data: { error: "Not found", path: request.path },
			};
		}

		if (!response.ok) {
			const errorBody = await response.text().catch(() => response.statusText);
			const error = new Error(
				`HTTP ${response.status}: ${errorBody.slice(0, 300)}`,
			) as Error & { status: number; data: unknown };
			error.status = response.status;
			error.data = errorBody;
			throw error;
		}

		const op = detectOperation(request.path);
		const contentType = response.headers.get("content-type") || "";

		if (op === "get" && isJsonGet(request.path) && contentType.includes("json")) {
			const data = await response.json();
			return { status: response.status, data };
		}

		const text = await response.text();

		if (op === "get") {
			// KEGG flat file format — keep as text. Splitting into structured
			// blocks varies by entry type and is best left to consumers.
			return { status: response.status, data: { text } };
		}

		if (op === "info") {
			return { status: response.status, data: { text } };
		}

		if (TEXT_PARSE_OPERATIONS.has(op)) {
			return { status: response.status, data: parseListLikeResponse(text, op) };
		}

		// Unknown operation — return raw text so callers can handle it.
		return { status: response.status, data: { text } };
	};
}
