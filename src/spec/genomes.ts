import type { ApiEndpoint, WorkflowRecipe } from "@bio-mcp/shared/codemode/catalog";

export const genomeEndpoints: ApiEndpoint[] = [
  {
    method: "GET", path: "/list/genome/{option}", category: "list",
    summary: "Filter KEGG genomes by organism group or taxonomy rank ID",
    pathParams: [{ name: "option", type: "string", required: true, description: "KEGG group name (animals) or taxonomic phylum/class/order/family/genus/species ID (562 for E. coli)" }],
    usageHint: "Preserves KEGG T identifiers and organism names; not a sequence download. Numeric options are taxonomy IDs, not genome IDs. Broad groups may stage; use SQL on the returned handle.",
    example: 'return await api.get("/list/genome/{option}", {option: "562"});',
  },
  {
    method: "GET", path: "/link/{target_db}/{source}/{rank}", category: "link",
    summary: "Link genomes and NCBI taxonomy at an explicit taxonomic rank",
    pathParams: [
      { name: "target_db", type: "string", required: true, enum: ["genome", "taxonomy"], description: "Target namespace" },
      { name: "source", type: "string", required: true, description: "Source database or entry, e.g. taxid:562 or gn:eco; preserve returned identifiers" },
      { name: "rank", type: "string", required: true, enum: ["species", "genus", "family", "order", "class", "phylum"], description: "Taxonomic level, not a sequence similarity threshold" },
    ],
    usageHint: "Links may use gn:<organism code>, while genome lists use T IDs. Join through the organism listing/definition or genome record, not by assuming string equality.",
    example: 'return await api.get("/link/{target_db}/{source}/{rank}", {target_db: "genome", source: "taxid:562", rank: "species"});',
  },
];

export const genomeWorkflow: WorkflowRecipe = {
  title: "Taxonomy-scoped genome discovery with source release",
  description: "Discover E. coli genomes and species-level taxonomy links, retaining database metadata and both identifier namespaces. Pace calls; callers must also coordinate aggregate access.",
  keywords: ["genome", "taxonomy", "species", "release", "2026"],
  code: 'const release = await api.get("/info/{database}", {database: "genome"}); await new Promise(r => setTimeout(r, 400)); const genomes = await api.get("/list/genome/{option}", {option: "562"}); await new Promise(r => setTimeout(r, 400)); const taxonomy = await api.get("/link/{target_db}/{source}/{rank}", {target_db: "genome", source: "taxid:562", rank: "species"}); return {release, genomes, taxonomy};',
};
