import { config } from "dotenv";
import neo4j from "neo4j-driver";

config({
  path: ".env.local",
});

const runMigrate = async () => {
  const uri = process.env.NEO4J_URI;
  if (!uri) {
    console.log("NEO4J_URI not defined, skipping migrations");
    process.exit(0);
  }

  const user = process.env.NEO4J_USERNAME ?? "neo4j";
  const password = process.env.NEO4J_PASSWORD ?? "password";

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();

  console.log("Running Neo4j constraint / index migrations...");
  const start = Date.now();

  try {
    // Uniqueness constraints (act as indexes too)
    await session.run(
      `CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE`
    );
    await session.run(
      `CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE`
    );
    await session.run(
      `CREATE CONSTRAINT chat_id IF NOT EXISTS FOR (c:Chat) REQUIRE c.id IS UNIQUE`
    );
    await session.run(
      `CREATE CONSTRAINT message_id IF NOT EXISTS FOR (m:Message) REQUIRE m.id IS UNIQUE`
    );
    await session.run(
      `CREATE CONSTRAINT document_id_created IF NOT EXISTS FOR (d:Document) REQUIRE (d.id, d.createdAt) IS UNIQUE`
    );
    await session.run(
      `CREATE CONSTRAINT suggestion_id IF NOT EXISTS FOR (s:Suggestion) REQUIRE s.id IS UNIQUE`
    );
    await session.run(
      `CREATE CONSTRAINT stream_id IF NOT EXISTS FOR (s:Stream) REQUIRE s.id IS UNIQUE`
    );

    // Lookup indexes for common query patterns
    await session.run(
      `CREATE INDEX chat_userId IF NOT EXISTS FOR (c:Chat) ON (c.userId)`
    );
    await session.run(
      `CREATE INDEX message_chatId IF NOT EXISTS FOR (m:Message) ON (m.chatId)`
    );
    await session.run(
      `CREATE INDEX vote_chatId IF NOT EXISTS FOR (v:Vote) ON (v.chatId)`
    );
    await session.run(
      `CREATE INDEX vote_messageId IF NOT EXISTS FOR (v:Vote) ON (v.messageId)`
    );
    await session.run(
      `CREATE INDEX stream_chatId IF NOT EXISTS FOR (s:Stream) ON (s.chatId)`
    );
    await session.run(
      `CREATE INDEX suggestion_documentId IF NOT EXISTS FOR (s:Suggestion) ON (s.documentId)`
    );
    await session.run(
      `CREATE INDEX document_id IF NOT EXISTS FOR (d:Document) ON (d.id)`
    );

    const end = Date.now();
    console.log("Neo4j migrations completed in", end - start, "ms");
  } catch (err) {
    console.error("Migration failed");
    console.error(err);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }

  process.exit(0);
};

runMigrate();
