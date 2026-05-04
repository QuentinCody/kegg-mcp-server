// interlinked-tdd: exempt
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerQueryData } from "./tools/query-data";
import { registerGetSchema } from "./tools/get-schema";
import { registerCodeMode } from "./tools/code-mode";
import { KeggDataDO } from "./do";

export { KeggDataDO };

interface KeggEnv {
	KEGG_DATA_DO: DurableObjectNamespace;
	CODE_MODE_LOADER: WorkerLoader;
	KEGG_BASE_URL?: string;
}

export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "kegg",
		version: "0.1.0",
	});

	async init() {
		const env = this.env as unknown as KeggEnv;
		registerQueryData(this.server, env);
		registerGetSchema(this.server, env);
		registerCodeMode(this.server, env);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/health") {
			return new Response("ok", {
				status: 200,
				headers: { "content-type": "text/plain" },
			});
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp", { binding: "MCP_OBJECT" }).fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
