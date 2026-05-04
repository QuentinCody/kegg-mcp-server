// interlinked-tdd: exempt
import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

/**
 * KEGG REST API catalog.
 *
 * KEGG (Kyoto Encyclopedia of Genes and Genomes) is the canonical pathway,
 * disease, drug, and orthology knowledgebase. It is the gold standard for
 * non-human pathway coverage and metabolic pathway connectivity, and is
 * complementary to Reactome (human-focused) and WikiPathways (community-
 * curated).
 *
 * The REST endpoint at https://rest.kegg.jp is FREE for academic and
 * non-commercial use via interactive queries. Bulk download requires a
 * separate license via Pathway Solutions Inc. — this server only proxies
 * per-request queries, which is permitted under the public REST policy.
 *
 * Most operations return tab-delimited plaintext. The api-adapter parses
 * each operation type into a structured row format:
 *
 *   list/find        → [{ id, name }]
 *   conv/link        → [{ source, target }]
 *   ddi              → [{ drug_a, drug_b, type, comment }]
 *   get              → { text } (KEGG flat file — too varied to parse generically)
 *   get/<id>/json    → JSON
 *   info             → { text } (descriptive statistics)
 */
export const keggCatalog: ApiCatalog = {
	name: "KEGG REST",
	baseUrl: "https://rest.kegg.jp",
	version: "118.0",
	auth: "none",
	endpointCount: 12,
	notes:
		"- LICENSE: free for per-request academic/non-commercial use. Bulk downloads require a license — do not loop over `/list/genes` or fetch full DB dumps.\n" +
		"- KEGG is path-segmented (no query strings): `/operation/arg1/arg2/...`. Build paths with template segments — `/list/{db}`, `/conv/{target}/{source}`, etc.\n" +
		"- Most operations return TAB-DELIMITED text. The api-adapter parses these into arrays: list/find → [{id, name}]; conv/link → [{source, target}]; ddi → [{drug_a, drug_b, type, comment}]; get → {text}; info → {text}.\n" +
		"- Append `/json` to a `/get/{entries}` path to receive structured JSON instead of KEGG flat-file text (e.g. `/get/hsa:7157/json`).\n" +
		"- Multi-entry get: pipe-separated entries `cpd:C00031+cpd:C00029` (URL-encoded `+`). Max 10 entries per request per KEGG policy.\n" +
		"- Database codes you'll use most: `pathway`, `module`, `ko` (KEGG orthology), `genes`, `genome`, `compound`, `glycan`, `reaction`, `enzyme`, `network`, `variant`, `disease`, `drug`, `dgroup`, `brite`. Organism codes: `hsa` (human), `mmu` (mouse), `dme` (fly), `eco` (E. coli K-12), etc.\n" +
		"- External cross-reference databases for `conv`/`link`: `pubmed`, `ncbi-geneid`, `ncbi-proteinid`, `uniprot`, `pubchem`, `chebi`, `atc`, `jtc`, `ndc`, `yj`, `yk`.\n" +
		"- Find options for compound search: `formula` (molecular formula), `exact_mass`, `mol_weight`, `nop` (no opt — name only). Example: `/find/compound/C7H10O5/formula`.\n" +
		"- Image/molfile/KGML/KCF outputs are returned as text (binary data is not supported by Code Mode). Use `kgml` for pathway XML, `mol` for compound molfile, `aaseq`/`ntseq` for gene sequences.\n" +
		"- 404 from list/find → no matching entries (adapter returns []). 404 from get → invalid entry id.\n" +
		"- KEGG enforces an undocumented soft rate limit. Avoid bursty parallel calls; the adapter retries on 429/500/502/503.",
	endpoints: [
		// ── info ──────────────────────────────────────────────────
		{
			method: "GET",
			path: "/info/{database}",
			summary:
				"Database release statistics. Use `kegg` to summarize the full KEGG release; otherwise pass a specific db like `pathway`, `compound`, `genes`, `disease`, etc.",
			category: "info",
			pathParams: [
				{
					name: "database",
					type: "string",
					required: true,
					description: "KEGG database (`kegg`, `pathway`, `compound`, `genes`, `disease`, …) or organism code (`hsa`, `mmu`, …).",
				},
			],
		},

		// ── list ─────────────────────────────────────────────────
		{
			method: "GET",
			path: "/list/{database}",
			summary:
				"List all entries in a KEGG database. Returns rows of `[id, name]`. Useful databases: pathway, module, ko, genome, compound, glycan, reaction, enzyme, network, variant, disease, drug, dgroup, brite.",
			category: "list",
			pathParams: [
				{
					name: "database",
					type: "string",
					required: true,
					description: "KEGG database to enumerate.",
					enum: [
						"pathway",
						"brite",
						"module",
						"ko",
						"genome",
						"compound",
						"glycan",
						"reaction",
						"rclass",
						"enzyme",
						"network",
						"variant",
						"disease",
						"drug",
						"dgroup",
						"organism",
					],
				},
			],
		},
		{
			method: "GET",
			path: "/list/pathway/{organism}",
			summary:
				"Organism-specific pathway list (e.g. `/list/pathway/hsa` for all human KEGG pathways).",
			category: "list",
			pathParams: [
				{
					name: "organism",
					type: "string",
					required: true,
					description: "KEGG organism code (e.g. hsa, mmu, dme, eco).",
				},
			],
		},
		{
			method: "GET",
			path: "/list/{database}/{org}",
			summary:
				"Organism-restricted entry list for module/orthology/etc. Example: `/list/module/hsa`.",
			category: "list",
			pathParams: [
				{
					name: "database",
					type: "string",
					required: true,
					description: "Module-aware KEGG database.",
					enum: ["module", "ko", "rclass", "reaction", "enzyme"],
				},
				{
					name: "org",
					type: "string",
					required: true,
					description: "Organism code (hsa, mmu, etc.).",
				},
			],
		},

		// ── find ─────────────────────────────────────────────────
		{
			method: "GET",
			path: "/find/{database}/{query}",
			summary:
				"Search entry identifiers and names by keyword. Returns rows of `[id, name]`. Supports compound formula/mass searches via the option variant below.",
			category: "find",
			pathParams: [
				{
					name: "database",
					type: "string",
					required: true,
					description: "KEGG database to search (compound, drug, pathway, disease, …).",
				},
				{
					name: "query",
					type: "string",
					required: true,
					description: "URL-encoded search string. Match is case-insensitive substring across id and name.",
				},
			],
		},
		{
			method: "GET",
			path: "/find/{database}/{query}/{option}",
			summary:
				"Compound/glycan/drug search by chemical attribute. `formula`, `exact_mass`, `mol_weight`, or `nop` (name-only). Example: `/find/compound/C6H12O6/formula`.",
			category: "find",
			pathParams: [
				{
					name: "database",
					type: "string",
					required: true,
					description: "Chemistry-aware database.",
					enum: ["compound", "glycan", "drug"],
				},
				{
					name: "query",
					type: "string",
					required: true,
					description: "Formula, mass value, or other query string.",
				},
				{
					name: "option",
					type: "string",
					required: true,
					description: "Search modality.",
					enum: ["formula", "exact_mass", "mol_weight", "nop"],
				},
			],
		},

		// ── get ──────────────────────────────────────────────────
		{
			method: "GET",
			path: "/get/{dbentries}",
			summary:
				"Fetch one or more KEGG entries (compound, gene, pathway, etc.). Multi-entry: pipe-separated like `hsa:7157+hsa:7158`. Default output is KEGG flat-file text wrapped in {text}.",
			category: "get",
			pathParams: [
				{
					name: "dbentries",
					type: "string",
					required: true,
					description:
						"One or more entry IDs separated by `+`. Examples: `hsa00010`, `cpd:C00031`, `dr:D00139+dr:D00140`.",
				},
			],
		},
		{
			method: "GET",
			path: "/get/{dbentries}/{option}",
			summary:
				"Fetch entries with a non-default formatting option. `json` for structured JSON, `aaseq`/`ntseq` for protein/nucleotide sequences (gene entries), `mol`/`kcf` for chemistry, `kgml` for pathway XML, `image` for PNG (returned as binary text — not recommended through Code Mode).",
			category: "get",
			pathParams: [
				{
					name: "dbentries",
					type: "string",
					required: true,
					description: "One or more entry IDs separated by `+`.",
				},
				{
					name: "option",
					type: "string",
					required: true,
					description: "Output format.",
					enum: ["aaseq", "ntseq", "mol", "kcf", "image", "conf", "kgml", "json"],
				},
			],
		},

		// ── conv ─────────────────────────────────────────────────
		{
			method: "GET",
			path: "/conv/{target_db}/{source_db}",
			summary:
				"Bulk identifier mapping between two databases. Example: `/conv/eco/ncbi-geneid` maps every NCBI gene ID to its E. coli K-12 KEGG locus.",
			category: "conv",
			pathParams: [
				{
					name: "target_db",
					type: "string",
					required: true,
					description: "Target database / organism code.",
				},
				{
					name: "source_db",
					type: "string",
					required: true,
					description:
						"Source database. External: `pubmed`, `ncbi-geneid`, `ncbi-proteinid`, `uniprot`, `pubchem`, `chebi`. Internal: organism code or KEGG db.",
				},
			],
		},
		{
			method: "GET",
			path: "/conv/{target_db}/{dbentries}",
			summary:
				"Identifier-level cross-reference. Pass specific entries instead of a whole DB. Example: `/conv/uniprot/hsa:7157`.",
			category: "conv",
			pathParams: [
				{
					name: "target_db",
					type: "string",
					required: true,
					description: "Target database / organism code.",
				},
				{
					name: "dbentries",
					type: "string",
					required: true,
					description: "One or more entries separated by `+`.",
				},
			],
		},

		// ── link ─────────────────────────────────────────────────
		{
			method: "GET",
			path: "/link/{target_db}/{source}",
			summary:
				"Find related entries across databases via cross-references. Source can be a KEGG database/organism code OR pipe-separated entries. Examples: `/link/pathway/hsa:7157` (pathways for TP53), `/link/disease/drug` (every disease→drug edge).",
			category: "link",
			pathParams: [
				{
					name: "target_db",
					type: "string",
					required: true,
					description: "Target KEGG database (pathway, disease, drug, module, …).",
				},
				{
					name: "source",
					type: "string",
					required: true,
					description:
						"Source database/org code OR `+`-separated entry list (e.g. `hsa:7157` or `dr:D00139+dr:D00140`).",
				},
			],
		},

		// ── ddi ──────────────────────────────────────────────────
		{
			method: "GET",
			path: "/ddi/{dbentry}",
			summary:
				"Drug-drug interactions. Pass one or more drug IDs separated by `+`. Returns rows of `[drug_a, drug_b, type, comment]`. Type values include `CI` (contraindication), `P` (precaution), and `M` (monitor).",
			category: "ddi",
			pathParams: [
				{
					name: "dbentry",
					type: "string",
					required: true,
					description:
						"Drug ID or pipe-separated list (e.g. `dr:D00139` or `dr:D00139+dr:D00140`).",
				},
			],
		},
	],
};
