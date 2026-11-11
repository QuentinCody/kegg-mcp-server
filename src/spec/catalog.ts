// interlinked-tdd: exempt
import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";
import { genomeEndpoints, genomeWorkflow } from "./genomes";

/**
 * KEGG REST API catalog.
 *
 * KEGG (Kyoto Encyclopedia of Genes and Genomes) is the canonical pathway,
 * disease, drug, and orthology knowledgebase. It is the gold standard for
 * non-human pathway coverage and metabolic pathway connectivity, and is
 * complementary to Reactome (human-focused) and WikiPathways (community-
 * curated).
 *
 * The public REST endpoint is restricted to academic users. Service-provider
 * and non-academic use have separate licensing requirements; see KEGG's policy.
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
	auth: "none",
	endpointCount: 12 + genomeEndpoints.length,
	notes:
		"- ACCESS: rest.kegg.jp is for academic users. Academic service providers and non-academic users need separately arranged licensing: https://www.kegg.jp/kegg/legal.html . Public HTTP access does not establish permission to redistribute or operate a service.\n" +
		"- KEGG is path-segmented (no query strings): `/operation/arg1/arg2/...`. Build paths with template segments — `/list/{db}`, `/conv/{target}/{source}`, etc.\n" +
		"- Most operations return TAB-DELIMITED text. The api-adapter parses these into arrays: list/find → [{id, name}]; conv/link → [{source, target}]; ddi → [{drug_a, drug_b, type, comment}]; get → {text}; info → {text}.\n" +
		"- JSON is documented for BRITE hierarchies, e.g. `/get/br:br08301/json`; do not assume gene entries support it.\n" +
		"- Multi-entry get: plus-separated entries `cpd:C00031+cpd:C00029`. Max 10 entries per request.\n" +
		"- Database codes you'll use most: `pathway`, `module`, `ko` (KEGG orthology), `genes`, `genome`, `compound`, `glycan`, `reaction`, `enzyme`, `network`, `variant`, `disease`, `drug`, `dgroup`, `brite`. Organism codes: `hsa` (human), `mmu` (mouse), `dme` (fly), `eco` (E. coli K-12), etc.\n" +
		"- Additional databases: vtax (viruses), vgenome (viral pathogens), vg (viral genes), vp (mature viral peptides), ag (addendum proteins), rmodule (reaction modules), ntmap (network variation maps). Use /info/{database} for current update/release and linked databases; these can have different dates.\n" +
		"- External cross-references are operation-specific: conv supports gene/protein and chemical identifier conversion; link supports taxonomy, pubmed and drug classification codes. Taxonomy links use taxid: identifiers and optional ranks.\n" +
		"- Find options for compound search: `formula` (molecular formula), `exact_mass`, `mol_weight`, `nop` (no opt — name only). Example: `/find/compound/C7H10O5/formula`.\n" +
		"- Binary image/image2x requests are rejected before fetching. Use `kgml` for pathway XML, `mol`/`kcf` for chemistry text, `aaseq`/`ntseq` for gene sequences.\n" +
		"- Each GET has an 8 MiB decoded-body limit and a 30-second deadline; no automatic retries. Complete HTTP 200 is required. Redirects, byte-range fragments, malformed UTF-8/JSON/tables and HTML error pages fail explicitly. Tool results include citations; complete envelopes above 30 KiB stage with lossless payload recovery.\n" +
		"- HTTP 400/404 stay errors. Only a successful empty response becomes []. An invalid genome group is not an empty biological result.\n" +
		"- Limit all calls to at most 3 per second as documented by KEGG. Pace sequential calls and coordinate callers across Worker instances; this adapter does not enforce a fleet-wide quota. Avoid whole-corpus crawling. Retries also count toward provider limits.",
	workflows: [genomeWorkflow],
	endpoints: [
		...genomeEndpoints,
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
						"vtax", "vgenome", "vg", "vp", "ag", "rmodule", "ntmap",
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
				"Unsupported organism-specific list template: /list/module/hsa returns HTTP 400. For organism-to-module associations use /link/module/{organism}; /list/pathway/{organism} is supported.",
			deprecated: true,
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
						description: "Literal search string; the template helper URL-encodes it once. Use + between keywords as documented by KEGG.",
				},
			],
		},
		{
			method: "GET",
			path: "/find/{database}/{query}/{option}",
			summary:
				"Compound/drug search by chemical attribute. `formula`, `exact_mass`, `mol_weight`, or `nop` (name-only). Example: `/find/compound/C6H12O6/formula`.",
			category: "find",
			pathParams: [
				{
					name: "database",
					type: "string",
					required: true,
					description: "Chemistry-aware database.",
					enum: ["compound", "drug"],
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
				"Fetch one or more KEGG entries (compound, gene, pathway, etc.). Multi-entry: plus-separated like `hsa:7157+hsa:7158`. Default output is KEGG flat-file text wrapped in {text}.",
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
				"Fetch text formats: `json` for BRITE hierarchies, `aaseq`/`ntseq` for gene sequences, `mol`/`kcf` for chemistry and `kgml` for pathway XML. Binary images are unsupported.",
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
						enum: ["aaseq", "ntseq", "mol", "kcf", "conf", "kgml", "json"],
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
							"Source database. External: `ncbi-geneid`, `ncbi-proteinid`, `uniprot`, `pubchem`, `chebi`. PubMed uses link rather than conv. Internal: organism code or KEGG db.",
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
				"Find related entries across databases via cross-references. Source can be a KEGG database/organism code OR plus-separated entries. Examples: `/link/pathway/hsa:7157` (pathways for TP53), `/link/disease/drug` (every disease→drug edge).",
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
				"Drug-drug interaction evidence extracted from Japanese drug labels, with provider CI (contraindication) and P (precaution) annotations retained. An empty result does not establish safety or complete DDI coverage. Returns rows of [drug_a, drug_b, type, comment].",
			category: "ddi",
			pathParams: [
				{
					name: "dbentry",
					type: "string",
					required: true,
					description:
							"Drug ID or plus-separated list (e.g. `dr:D00139` or `dr:D00139+dr:D00140`).",
				},
			],
		},
	],
};
