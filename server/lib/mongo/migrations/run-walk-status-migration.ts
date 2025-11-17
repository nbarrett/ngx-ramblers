import { MongoClient } from "mongodb";
import { up, down } from "./database/20251118000000-set-status-on-migrated-walks";

async function runMigration() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI environment variable not set");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();

    console.log("\n=== Running Migration: set-status-on-migrated-walks ===\n");

    await up(db, client);

    console.log("\nMigration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\nDisconnected from MongoDB");
  }
}

runMigration();
