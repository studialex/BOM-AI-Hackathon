import { config } from "dotenv";
import neo4j, { type Driver, type Session } from "neo4j-driver";

config({ path: ".env.local" });

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI ?? "bolt://localhost:7687";
    const user = process.env.NEO4J_USERNAME ?? "neo4j";
    const password = process.env.NEO4J_PASSWORD ?? "password";
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

export function getSession(): Session {
  return getDriver().session();
}

export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Run a pipeline function with automatic driver cleanup.
 */
export async function runPipeline(
  name: string,
  fn: () => Promise<void>
) {
  console.log(`\n🚀 Starting pipeline: ${name}`);
  const start = Date.now();
  try {
    await fn();
    const elapsed = Date.now() - start;
    console.log(`✅ Pipeline "${name}" completed in ${elapsed}ms\n`);
  } catch (err) {
    console.error(`❌ Pipeline "${name}" failed:`, err);
    process.exit(1);
  } finally {
    await closeDriver();
  }
}
