// interlinked-tdd: exempt
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { keggCatalog } from "../spec/catalog";
import { createKeggApiFetch } from "../lib/api-adapter";

interface CodeModeEnv {
	KEGG_DATA_DO: DurableObjectNamespace;
	CODE_MODE_LOADER: WorkerLoader;
	KEGG_BASE_URL?: string;
}

export function registerCodeMode(server: McpServer, env: CodeModeEnv): void {
	const apiFetch = createKeggApiFetch({ KEGG_BASE_URL: env.KEGG_BASE_URL });

	const searchTool = createSearchTool({
		prefix: "kegg",
		catalog: keggCatalog,
	});
	searchTool.register(server as unknown as { tool: (...args: unknown[]) => void });

	const executeTool = createExecuteTool({
		prefix: "kegg",
		catalog: keggCatalog,
		apiFetch,
		doNamespace: env.KEGG_DATA_DO,
		loader: env.CODE_MODE_LOADER,
	});
	executeTool.register(server as unknown as { tool: (...args: unknown[]) => void });
}
