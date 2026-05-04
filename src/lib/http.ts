// interlinked-tdd: exempt
import { restFetch } from "@bio-mcp/shared/http/rest-fetch";
import type { RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const KEGG_BASE = "https://rest.kegg.jp";
const RETRY_STATUSES = [429, 500, 502, 503] as const;
const DEFAULT_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface KeggFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
	baseUrl?: string;
}

/**
 * Fetch from the KEGG REST API at https://rest.kegg.jp.
 *
 * KEGG is path-based (no query params for most operations). Most responses
 * are tab-delimited text — the api-adapter parses this into structured JSON.
 */
export async function keggFetch(
	path: string,
	params?: Record<string, unknown>,
	opts?: KeggFetchOptions,
): Promise<Response> {
	const baseUrl = opts?.baseUrl ?? KEGG_BASE;
	const headers: Record<string, string> = {
		Accept: "text/plain, application/json;q=0.9, */*;q=0.5",
		...(opts?.headers ?? {}),
	};
	return restFetch(baseUrl, path, params, {
		...opts,
		headers,
		retryOn: [...RETRY_STATUSES],
		retries: opts?.retries ?? DEFAULT_RETRIES,
		timeout: opts?.timeout ?? DEFAULT_TIMEOUT_MS,
		userAgent: "kegg-mcp-server/1.0 (bio-mcp)",
	});
}
