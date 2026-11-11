// interlinked-tdd: exempt
import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

const ENTITY_KEY = "object";

export class KeggDataDO extends RestStagingDO {
	protected getTabularData(value: unknown): unknown {
		const record = (data: unknown): data is Record<string, unknown> => data !== null && typeof data === "object" && !Array.isArray(data);
		const data = record(value) && Array.isArray(value.content) && record(value.structuredContent) && "data" in value.structuredContent
			? value.structuredContent.data : value;
		// RestStagingDO retains the complete original payload independently.
		if (record(data) && typeof data.sql === "string" && Array.isArray(data.rows)) {
			return { query_rows: data.rows.map((native, row_index) => ({ row_index, native_json: JSON.stringify(native) })) };
		}
		if (record(data) && typeof data.text === "string") return { kegg_text: [data] };
		return data;
	}

	protected getSchemaHints(data: unknown): SchemaHints | undefined {
		if (!data || typeof data !== ENTITY_KEY) return undefined;
		if (!Array.isArray(data) || data.length === 0) return undefined;
		const sample = data[0];
		if (!sample || typeof sample !== ENTITY_KEY) return undefined;
		const s = sample as Record<string, unknown>;

		// /conv and /link: { source, target }
		if ("source" in s && "target" in s) {
			return {
				tableName: "kegg_xref",
				indexes: ["source", "target"],
			};
		}

		// /ddi: { drug_a, drug_b, type, comment }
		if ("drug_a" in s && "drug_b" in s) {
			return {
				tableName: "kegg_ddi",
				indexes: ["drug_a", "drug_b", "type"],
			};
		}

		// /list and /find: { id, name }
		if ("id" in s && "name" in s) {
			return {
				tableName: "kegg_entries",
				indexes: ["id"],
			};
		}

		return undefined;
	}
}
