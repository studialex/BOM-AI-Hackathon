/**
 * Ingest Cancer Atlas cancer group metadata into Neo4j.
 *
 * Creates:
 *   (:CancerAtlasGroup {groupId, name, source, ...metadata})
 *
 * Usage: npx tsx pipeline/ingest-cancer-atlas.ts
 */

import { getSession, runPipeline } from "./neo4j-helpers";

const ATLAS_API =
  "https://iknl-atlas-strapi-prod.azurewebsites.net/api";

async function ingest() {
  const session = getSession();

  try {
    // Create index
    await session.run(
      `CREATE INDEX canceratlas_groupid IF NOT EXISTS FOR (g:CancerAtlasGroup) ON (g.groupId)`
    );

    // Fetch cancer groups
    console.log("📡 Fetching Cancer Atlas cancer groups...");
    const res = await fetch(
      `${ATLAS_API}/cancer-groups/cancergrppc?locale=nl`
    );
    const data = await res.json();

    // The API may return an array or an object with a data key
    let groups: unknown[] = [];
    if (Array.isArray(data)) {
      groups = data;
    } else if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).data)) {
      groups = (data as Record<string, unknown>).data as unknown[];
    } else if (data && typeof data === "object") {
      // Single object — wrap it
      groups = [data];
    }

    console.log(`🗺️  Found ${groups.length} cancer groups`);

    for (const group of groups) {
      const obj = group as Record<string, unknown>;
      const id = obj.id ?? obj.groupId ?? obj.cancerGroupId;
      const name =
        obj.name ?? obj.label ?? obj.cancerGroupName ?? `Group ${id}`;

      // Store all properties dynamically
      const safeProps: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (
          val !== null &&
          val !== undefined &&
          typeof val !== "object"
        ) {
          safeProps[key] = val;
        }
      }

      await session.run(
        `MERGE (g:CancerAtlasGroup {groupId: $groupId})
         ON CREATE SET g += $props, g.source = 'kankeratlas.iknl.nl'
         ON MATCH SET g += $props`,
        {
          groupId: String(id),
          props: { ...safeProps, name: String(name) },
        }
      );
    }

    // Also fetch filters for reference
    console.log("📡 Fetching Cancer Atlas filters...");
    const filtersRes = await fetch(
      "https://kankeratlas.iknl.nl/locales/nl/filters.json?format=json"
    );
    const filters = await filtersRes.json();

    // Store filters as a reference node
    await session.run(
      `MERGE (f:CancerAtlasFilters {id: 'filters'})
       SET f.data = $data, f.source = 'kankeratlas.iknl.nl'`,
      { data: JSON.stringify(filters).slice(0, 50000) }
    );

    console.log(`✅ Ingested ${groups.length} cancer atlas groups + filters`);
  } finally {
    await session.close();
  }
}

runPipeline("Cancer Atlas groups", ingest);
