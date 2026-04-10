# Data Ingestion Pipeline

Standalone scripts for ingesting IKNL data sources into Neo4j. Each script is independent and can be run separately.

## Prerequisites

- Neo4j running on `bolt://localhost:7687` (see root `.env.local`)
- Node.js / tsx installed (already available via the main project)

## Available Ingesters

### 1. kanker.nl pages (`ingest-kanker-nl.ts`)
Loads the pre-crawled kanker.nl pages from `data/kanker_nl_pages_all.json` into Neo4j.

Creates nodes:
- `(:Page {url, source, cancerType, text, textPreview})`
- `(:CancerType {slug, name, source})`
- Relationship: `(:Page)-[:ABOUT]->(:CancerType)`

```bash
pnpm pipeline:kanker-nl
```

### 2. NKR navigation items (`ingest-nkr-navigation.ts`)
Fetches the NKR Cijfers API navigation structure and stores it in Neo4j.

Creates nodes:
- `(:NkrTopic {code, label, source})`

```bash
pnpm pipeline:nkr-nav
```

### 3. Cancer Atlas cancer groups (`ingest-cancer-atlas.ts`)
Fetches cancer group metadata from the Cancer Atlas API.

Creates nodes:
- `(:CancerAtlasGroup {id, name, source})`

```bash
pnpm pipeline:cancer-atlas
```

### Run all ingesters
```bash
pnpm pipeline:all
```

## Adding a new ingester

1. Create a new `pipeline/ingest-<name>.ts` file
2. Use the helper from `pipeline/neo4j-helpers.ts` for connection management
3. Add a script entry in `package.json`
4. The schema is flexible — just create whatever nodes/relationships make sense for your data

## Notes

- All scripts use `MERGE` to be idempotent (safe to re-run)
- The schema is intentionally loose — Neo4j is schema-optional
- Text content is stored directly on nodes for now; you can add vector embeddings later
- Each node has a `source` property for provenance tracking
