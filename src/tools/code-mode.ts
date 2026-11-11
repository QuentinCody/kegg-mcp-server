import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { keggCatalog } from "../spec/catalog";
import { createKeggApiFetch } from "../lib/api-adapter";
import { keggResponse, KEGG_SOURCE } from "../lib/tool-result";

interface CodeModeEnv {
	KEGG_DATA_DO: DurableObjectNamespace;
	CODE_MODE_LOADER: WorkerLoader;
	KEGG_BASE_URL?: string;
}

export function registerCodeMode(server: McpServer, env: CodeModeEnv): void {
	const apiFetch = createKeggApiFetch({ KEGG_BASE_URL: env.KEGG_BASE_URL });
	const registrar = { tool: (...args: unknown[]) => {
		const [name, ...rest] = args;
		const register = server.tool.bind(server) as (...values: unknown[]) => void;
		const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof keggResponse>;
		for (const alias of [String(name), `mcp_${String(name)}`]) register(alias, ...rest,
			(input: unknown, extra: unknown) => keggResponse(() => handler(input, extra), env, alias, extra, input));
	} };

	const searchTool = createSearchTool({
		prefix: "kegg",
		catalog: keggCatalog,
	});
	searchTool.register(registrar);

	const executeTool = createExecuteTool({
		prefix: "kegg",
		// Verifiable provenance: kegg_execute results carry a _meta.citation.
		source: KEGG_SOURCE,
		catalog: keggCatalog,
		apiFetch,
		preserveApiErrors: true,
		maxInlineBytes: 30 * 1024,
		stagingThreshold: 30 * 1024,
		timeout: 90_000,
		doNamespace: env.KEGG_DATA_DO,
		loader: env.CODE_MODE_LOADER,
	});
	executeTool.register(registrar);
}
