/**
 * Ingest NKR Cijfers navigation items (topics) into Neo4j.
 *
 * Creates:
 *   (:NkrTopic {code, label, description, source})
 *
 * Usage: npx tsx pipeline/ingest-nkr-navigation.ts
 */

import { getSession, runPipeline } from "./neo4j-helpers";

const NKR_API = "https://api.nkr-cijfers.iknl.nl/api";

async function ingest() {
  const session = getSession();

  try {
    // Create index
    await session.run(
      `CREATE INDEX nkrtopic_code IF NOT EXISTS FOR (t:NkrTopic) ON (t.code)`
    );

    // Fetch navigation items
    console.log("📡 Fetching NKR navigation items...");
    const res = await fetch(`${NKR_API}/navigation-items?format=json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "nl-NL" }),
    });
    const data = await res.json();

    // The API returns a nested structure — flatten it
    const topics: Array<{ code: string; label: string; description?: string }> =
      [];

    function extractTopics(items: unknown[]) {
      for (const item of items) {
        const obj = item as Record<string, unknown>;
        if (obj.code && obj.label) {
          topics.push({
            code: obj.code as string,
            label: obj.label as string,
            description: (obj.description as string) ?? "",
          });
        }
        if (Array.isArray(obj.children)) {
          extractTopics(obj.children);
        }
        if (Array.isArray(obj.items)) {
          extractTopics(obj.items);
        }
      }
    }

    if (Array.isArray(data)) {
      extractTopics(data);
    } else if (data && typeof data === "object") {
      // Try common wrapper keys
      for (const key of ["items", "children", "navigationItems", "data"]) {
        if (Array.isArray((data as Record<string, unknown>)[key])) {
          extractTopics((data as Record<string, unknown>)[key] as unknown[]);
        }
      }
      // If still empty, store the raw response as a single node
      if (topics.length === 0) {
        topics.push({
          code: "root",
          label: "NKR Navigation Root",
          description: JSON.stringify(data).slice(0, 5000),
        });
      }
    }

    console.log(`📊 Found ${topics.length} NKR topics`);

    // Create nodes
    for (const topic of topics) {
      await session.run(
        `MERGE (t:NkrTopic {code: $code})
         ON CREATE SET t.label = $label, t.description = $description, t.source = 'nkr-cijfers.iknl.nl'
         ON MATCH SET t.label = $label, t.description = $description`,
        { code: topic.code, label: topic.label, description: topic.description ?? "" }
      );
    }

    console.log(`✅ Ingested ${topics.length} NKR topics`);
  } finally {
    await session.close();
  }
}

runPipeline("NKR navigation", ingest);
