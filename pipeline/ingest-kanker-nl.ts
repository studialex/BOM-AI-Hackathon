/**
 * Ingest kanker.nl pages from data/kanker_nl_pages_all.json into Neo4j.
 *
 * Creates:
 *   (:Page {url, source, cancerType, text, textPreview})
 *   (:CancerType {slug, name, source})
 *   (:Page)-[:ABOUT]->(:CancerType)
 *
 * Usage: npx tsx pipeline/ingest-kanker-nl.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSession, runPipeline } from "./neo4j-helpers";

interface PageEntry {
  kankersoort: string;
  text: string;
}

type PagesData = Record<string, PageEntry>;

const BATCH_SIZE = 100;

async function ingest() {
  const filePath = resolve(__dirname, "../data/kanker_nl_pages_all.json");
  const raw = readFileSync(filePath, "utf-8");
  const pages: PagesData = JSON.parse(raw);
  const urls = Object.keys(pages);

  console.log(`📄 Loaded ${urls.length} pages from kanker.nl`);

  const session = getSession();

  try {
    // 1. Create indexes for the pipeline nodes (idempotent)
    await session.run(
      `CREATE INDEX page_url IF NOT EXISTS FOR (p:Page) ON (p.url)`
    );
    await session.run(
      `CREATE INDEX cancertype_slug IF NOT EXISTS FOR (ct:CancerType) ON (ct.slug)`
    );

    // 2. Collect unique cancer types
    const cancerTypes = new Set<string>();
    for (const entry of Object.values(pages)) {
      cancerTypes.add(entry.kankersoort);
    }

    console.log(`🦀 Found ${cancerTypes.size} unique cancer types`);

    // 3. Create CancerType nodes
    for (const slug of cancerTypes) {
      const name = slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      await session.run(
        `MERGE (ct:CancerType {slug: $slug})
         ON CREATE SET ct.name = $name, ct.source = 'kanker.nl'`,
        { slug, name }
      );
    }
    console.log(`✅ Created ${cancerTypes.size} CancerType nodes`);

    // 4. Create Page nodes in batches
    let processed = 0;
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE).map((url) => ({
        url,
        cancerType: pages[url].kankersoort,
        text: pages[url].text,
        textPreview: pages[url].text.slice(0, 300),
      }));

      await session.run(
        `UNWIND $batch AS item
         MERGE (p:Page {url: item.url})
         ON CREATE SET
           p.source = 'kanker.nl',
           p.cancerType = item.cancerType,
           p.text = item.text,
           p.textPreview = item.textPreview
         ON MATCH SET
           p.text = item.text,
           p.textPreview = item.textPreview
         WITH p, item
         MATCH (ct:CancerType {slug: item.cancerType})
         MERGE (p)-[:ABOUT]->(ct)`,
        { batch }
      );

      processed += batch.length;
      if (processed % 500 === 0 || processed === urls.length) {
        console.log(`  📥 ${processed}/${urls.length} pages ingested`);
      }
    }

    console.log(`✅ Ingested ${urls.length} pages with relationships`);
  } finally {
    await session.close();
  }
}

runPipeline("kanker.nl pages", ingest);
