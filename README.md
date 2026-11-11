# KEGG MCP Server

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets MCP clients (Claude Desktop, Claude Code, Continue, etc.) query the upstream KEGG API in natural language. It is one of 100+ servers in the [Bio MCP](../../README.md) monorepo.

## Connect

The server is deployed and ready at:

```
https://kegg-mcp-server.quentincody.workers.dev/mcp
```

Add it to your MCP client (Claude Desktop → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "kegg": {
      "command": "npx",
      "args": ["mcp-remote", "https://kegg-mcp-server.quentincody.workers.dev/mcp"]
    }
  }
}
```

For local development the server runs at `http://localhost:8898/mcp` (start it with `./scripts/dev-servers.sh kegg`):

```json
{
  "mcpServers": {
    "kegg-local": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8898/mcp"]
    }
  }
}
```

## Tools

- `kegg_search` — discover available API operations and genome/taxonomy recipes
- `kegg_execute` — **Code Mode**: write JavaScript in a V8 isolate (`api.get()` / `searchSpec()`); KEGG supports read-only GET requests
- `kegg_query_data` — run SQL over large responses auto-staged into a per-session SQLite database
- `kegg_get_schema` — inspect the inferred schema of a staged dataset

Large responses (>30KB) are auto-staged into a queryable SQLite database; the tools return a `data_access_id` you can query with SQL.

Each tool also has an `mcp_` alias. Success and error results include `content`, `structuredContent` and a citation; failures set `isError`. The complete response envelope, including composed results and large SQL/schema outputs, stages above 30 KiB. `payloads` retains the original response independently of SQL projections; single text responses also have a `kegg_text` table.

Reads have an 8 MiB body limit and a 30-second deadline covering headers and body. They require complete HTTP 200 responses, strict UTF-8 and the requested text/JSON format. Redirects, byte-range fragments and HTML success pages fail explicitly. Native HTTP error text, URL, byte count and SHA-256 survive within bounded error evidence. Binary images are rejected; use sequence, molfile, KCF or KGML text formats. There are no automatic retries. These are local changes; fresh provider and edited Worker acceptance remain pending.

## Genome and viral data discovery

The [June 2026 API contract](https://www.kegg.jp/kegg/rest/keggapi.html) supports `/list/genome/{option}`, where the option is a KEGG organism group (such as `animals`) or a taxonomy ID (such as `562`, E. coli). `/link/{target_db}/{source}/{rank}` supports genome/taxonomy links at species through phylum rank. Genome lists return T identifiers; taxonomy links may use `gn:eco`-style organism codes. Keep these namespaces distinct and use provider definitions/records to join them.

Discovery now includes `vtax` (viruses), `vgenome` (viral pathogens), `vg` (viral genes), `vp` (mature peptides), `ag` (addendum proteins), `rmodule` and `ntmap`. For example, `/find/vtax/coronavirus` returns taxonomic identifiers as strings, while `/list/vgenome` returns T identifiers. A failed query is not evidence of biological absence: HTTP 400/404 remain errors; successful empty text becomes an empty array.

The catalog's taxonomy-scoped workflow retains `/info/genome` beside the list and links. Use `/info/{database}` to preserve the observed update date and linked databases; dates differ across resources and the catalog does not pin the live data to a release number. Broad lists stage automatically; query their handle with SQL rather than requesting a whole-corpus loop.

`/list/module/hsa` is unsupported; use `/link/module/hsa` for module associations and `/list/pathway/hsa` for the supported pathway list. JSON retrieval is documented for BRITE hierarchies, not arbitrary gene records.

## Provider access

[KEGG limits the public API to academic users and at most three calls per second](https://www.kegg.jp/kegg/rest/). Academic service providers and non-academic users have [separate licensing requirements](https://www.kegg.jp/kegg/legal.html). An anonymous HTTP success does not establish service/redistribution rights. Pace requests, include retries in the count, and coordinate concurrent callers; this adapter does not enforce a quota across Worker instances. No license or entitlement is supplied by this server.

## Development

```bash
./scripts/dev-servers.sh kegg            # run locally (port 8898)
pnpm --filter kegg-mcp-server run deploy   # deploy to Cloudflare Workers
```

See [`docs/adding-mcp-servers.md`](../../docs/adding-mcp-servers.md) and the root [README](../../README.md) for the full architecture (Code Mode, staging, portals).

---

*Auto-generated baseline README — refine with server-specific detail as needed.*

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from KEGG REST and stays under the terms of that source: Academic use only; commercial needs a Pathway Solutions license.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
