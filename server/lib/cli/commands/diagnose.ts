import { Command } from "commander";
import mongoose from "mongoose";
import tls from "tls";
import dns from "dns/promises";
import { findEnvironmentFromDatabase } from "../../environments/environments-config";
import { buildMongoUri } from "../../shared/mongodb-uri";
import { log } from "../cli-logger";
import { padLeft, padRight } from "../../shared/string-utils";
import { sortBy } from "../../../../projects/ngx-ramblers/src/app/functions/arrays";
import { QueryBenchmark, ShardInfo } from "../cli.model";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const AMBER = "\x1b[33m";
const RESET = "\x1b[39m";

function colourForMs(ms: number): string {
  if (ms < 50) return GREEN;
  if (ms < 200) return AMBER;
  return RED;
}

function colourForConnectMs(ms: number): string {
  if (ms < 300) return GREEN;
  if (ms < 1000) return AMBER;
  return RED;
}

function colourForDocs(docs: number): string {
  if (docs < 100) return GREEN;
  if (docs < 1000) return AMBER;
  return RED;
}

function colourForIndexes(indexes: number): string {
  if (indexes >= 3) return GREEN;
  if (indexes >= 2) return AMBER;
  return RED;
}

function c(value: string, colour: string): string {
  return colour + value + RESET;
}

function statusSymbol(colour: string): string {
  if (colour === GREEN) return c("\u2713", GREEN);
  if (colour === AMBER) return c("\u26A0", AMBER);
  return c("\u2717", RED);
}

const INDEX_RECOMMENDATIONS: Record<string, string> = {
  refreshTokens: "createIndex({refreshToken: 1}, {unique: true})",
  deletedMembers: "createIndex({deletedAt: 1})",
  contentText: "createIndex({name: 1, category: 1})",
  mailListAudit: "createIndex({createdBy: 1, timestamp: -1}), createIndex({memberId: 1, listId: 1})",
  memberUpdateAudit: "createIndex({memberId: 1})",
};

function valueOf(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    const obj = v as { low?: number; high?: number };
    const low = (obj.low ?? 0) < 0 ? (obj.low ?? 0) + 4294967296 : (obj.low ?? 0);
    return (obj.high ?? 0) * 4294967296 + low;
  }
  return Number(v);
}

async function resolveShards(uri: string): Promise<ShardInfo[]> {
  const hostname = uri.replace(/^mongodb\+srv:\/\/[^@]+@/, "").replace(/\/.*/, "");
  const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${hostname}`);
  const shards: ShardInfo[] = [];
  for (const record of srvRecords) {
    const host = record.name;
    const addresses = await dns.resolve4(host);
    for (const ip of addresses) {
      const start = Date.now();
      try {
        await new Promise<void>((resolve, reject) => {
          const socket = tls.connect(27017, ip, { rejectUnauthorized: false });
          socket.setTimeout(5000);
          socket.once("connect", () => {
            socket.destroy();
            resolve();
          });
          socket.once("error", reject);
          socket.once("timeout", () => {
            socket.destroy();
            reject(new Error("timeout"));
          });
        });
        shards.push({ host, ip, tcpMs: Date.now() - start });
      } catch {
        shards.push({ host, ip, tcpMs: -1 });
      }
    }
  }
  return shards;
}

async function benchmarkCollection(collection: string, db: mongoose.mongo.Db, samples: number): Promise<QueryBenchmark | null> {
  const coll = db.collection(collection);
  try {
    const indexes = await coll.indexes();
    const estimate = await coll.estimatedDocumentCount();
    const times: number[] = [];
    for (let i = 0; i < samples; i++) {
      const start = Date.now();
      await coll.find({}).limit(1).toArray();
      times.push(Date.now() - start);
    }
    const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
    return {
      label: collection,
      avgMs: Math.round(avgMs),
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      docCount: estimate,
      indexes: indexes.length,
    };
  } catch {
    return null;
  }
}

async function runDiagnostics(environmentName: string): Promise<void> {
  log("═══ Performance Diagnostic: %s ═══", environmentName);
  log("");

  const envConfigRecord = await findEnvironmentFromDatabase(environmentName);
  if (!envConfigRecord?.mongo) {
    log("Environment '%s' not found or has no MongoDB configuration", environmentName);
    return;
  }

  const mongo = envConfigRecord.mongo;
  const uri = buildMongoUri({
    cluster: mongo.cluster,
    username: mongo.username,
    password: mongo.password,
    database: mongo.db,
  });

  log("Target: %s/%s via %s", mongo.cluster, mongo.db, mongo.username);
  log("");

  log("── Network Latency ──");
  const shards = await resolveShards(uri);
  log("  %s %s %s", padRight("Shard", 45), padRight("IP", 16), "Latency");
  log("  %s", "─".repeat(70));
  for (const s of shards) {
    const shardName = s.host.split(".")[0];
    const shardColour = s.tcpMs >= 0 ? colourForMs(s.tcpMs) : RED;
    const status = s.tcpMs >= 0 ? c(s.tcpMs + "ms", shardColour) : c("FAILED", RED);
    log("  %s %s %s", padRight(shardName, 45), padRight(s.ip, 16), status);
  }
  log("");

  log("── Query Performance ──");
  log("  Connecting...");
  const connectStart = Date.now();
  const diagnosticConn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    heartbeatFrequencyMS: 5000,
    maxPoolSize: 5,
    minPoolSize: 1,
    ssl: true,
  }).asPromise();
  const connectMs = Date.now() - connectStart;
  log("  Connection: %s", c(connectMs + "ms", colourForConnectMs(connectMs)));

  const db = diagnosticConn.db;
  if (!db) {
    log("No database connection");
    return;
  }

  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name).sort();

  const benchmarks: QueryBenchmark[] = [];
  for (const name of collectionNames) {
    const result = await benchmarkCollection(name, db, 5);
    if (result) {
      benchmarks.push(result);
    }
  }

  const maxLabelLen = Math.max(...benchmarks.map(b => b.label.length), 10) + 2;
  benchmarks.sort((a, b) => b.avgMs - a.avgMs);
  const colLabel = maxLabelLen;
  const colDocs = 7;
  const colAvg = 7;
  const colMin = 6;
  const colMax = 6;
  const totalWidth = colLabel + colDocs + colAvg + colMin + colMax + 10;
  log("  %s %s %s %s %s %s",
    padRight("Collection", colLabel),
    padLeft("Docs", colDocs),
    padLeft("Avg", colAvg),
    padLeft("Min", colMin),
    padLeft("Max", colMax),
    padLeft("Idx", 3));
  log("  %s", "─".repeat(totalWidth));
  for (const b of benchmarks) {
    log("  %s %s %s %s %s %s",
      padRight(b.label, colLabel),
      c(padLeft(String(b.docCount), colDocs), colourForDocs(b.docCount)),
      c(padLeft(b.avgMs + "ms", colAvg), colourForMs(b.avgMs)),
      c(padLeft(b.minMs + "ms", colMin), colourForMs(b.minMs)),
      c(padLeft(b.maxMs + "ms", colMax), colourForMs(b.maxMs)),
      c(padLeft(String(b.indexes), 3), colourForIndexes(b.indexes)));
  }
  log("");

  log("── Server Metrics ──");
  let status: any;
  let cumulativeReadAvgMs = 0;
  let cumulativeReadOps = 0;
  try {
    status = await db.admin().command({ serverStatus: 1 });
  } catch {
    log("  (serverStatus not available - insufficient privileges)");
  }
  if (status) {
    const conn = status.connections;
    if (conn) {
      const totalCreated = valueOf(conn.totalCreated);
      const uptimeHours = (status.uptime / 3600).toFixed(1);
      const perHour = totalCreated / (status.uptime / 3600);
      log("  Connections: %d current, %d available, %d created (%s/hr over %sh)",
        conn.current, conn.available, totalCreated,
        isNaN(perHour) ? "?" : perHour.toFixed(1), uptimeHours);
    }

    const latencyStats = status.opLatencies;
    if (latencyStats) {
      log("  Op Latency Averages:");
      for (const key of ["reads", "writes", "commands"]) {
        const stat = latencyStats[key];
        if (stat) {
          const totalOps = valueOf(stat.ops);
          const totalLatUs = valueOf(stat.latency);
          const avgMs = totalOps > 0 ? (totalLatUs / 1000 / totalOps) : 0;
          if (key === "reads") { cumulativeReadAvgMs = Math.round(avgMs); cumulativeReadOps = totalOps; }
          log("    %s %s ops, %s ms avg",
            padRight(key, 10),
            padLeft(String(totalOps), 6),
            padLeft(avgMs.toFixed(0), 8));
        }
      }
    }
  }
  log("");

  log("── Slow Query Check ──");
  try {
    const slowOps = await db.admin().command({
      currentOp: 1,
      $ownOps: true,
    });
    const active = (slowOps.inprog || []).filter((o: any) => o.secs_running > 0.5);
    if (active.length > 0) {
      log("  %d operations running >500ms:", active.length);
      for (const op of active) {
        log("    ns=%s secs=%d op=%s", op.ns, op.secs_running, op.op);
      }
    } else {
      log("  No slow operations detected");
    }
  } catch {
    log("  (cannot query currentOp on this Atlas tier)");
  }
  log("");

  log("── Index Coverage ──");
  for (const name of collectionNames) {
    const coll = db.collection(name);
    const indexes = await coll.indexes();
    const onlyIdIndex = indexes.length === 1 && indexes[0].name === "_id_";
    if (onlyIdIndex) {
      log("  %s has only _id_ index", name);
    }
  }
  log("");

  await diagnosticConn.close();

  const worstBenchmark = benchmarks[0];
  const bestBenchmark = benchmarks[benchmarks.length - 1];
  const overallAvg = Math.round(benchmarks.reduce((a, b) => a + b.avgMs, 0) / benchmarks.length);
  const warningCollections = benchmarks.filter(b => b.avgMs > 200);

  log("── Verdict ──");
  log("  %s Connection to cluster: %s", statusSymbol(colourForConnectMs(connectMs)), c(connectMs + "ms", colourForConnectMs(connectMs)));
  log("  %s Average query across %d collections: %s", statusSymbol(colourForMs(overallAvg)), benchmarks.length, c(overallAvg + "ms", colourForMs(overallAvg)));
  log("  %s Worst: %s (%s)", statusSymbol(RED), worstBenchmark.label, c(worstBenchmark.avgMs + "ms", colourForMs(worstBenchmark.avgMs)));
  log("  %s Best: %s (%s)", statusSymbol(GREEN), bestBenchmark.label, c(bestBenchmark.avgMs + "ms", colourForMs(bestBenchmark.avgMs)));

  if (cumulativeReadAvgMs > 200) {
    log("  %s %s", statusSymbol(RED), c("Cumulative read latency high: " + cumulativeReadAvgMs + "ms average across " + cumulativeReadOps + " operations", RED));
    log("    Check Atlas Real-Time Performance panel for recent slow queries.");
  }

  if (overallAvg > 100) {
    log("  %s %s", statusSymbol(AMBER), c("Average query time exceeds 100ms", AMBER));
    log("    High network latency between app host and Atlas cluster.");
    log("    Ensure Atlas cluster region matches app deployment region.");
  }

  if (warningCollections.length > 0) {
    log("  %s %d collection(s) average >200ms:", statusSymbol(AMBER), warningCollections.length);
    for (const w of warningCollections) {
      log("    %s: %s (%d docs, %d indexes)", w.label, c(w.avgMs + "ms", colourForMs(w.avgMs)), w.docCount, w.indexes);
    }
  }

  const noIndex = [...benchmarks.filter(b => b.indexes <= 1 && b.docCount > 100)].sort(sortBy("label"));
  if (noIndex.length > 0) {
    log("  %s %d collection(s) with >100 documents but only _id index:", statusSymbol(AMBER), noIndex.length);
    for (const n of noIndex) {
      const recommendation = INDEX_RECOMMENDATIONS[n.label];
      if (recommendation) {
        log("    %s (%d docs) \u2192 %s", n.label, n.docCount, c(recommendation, AMBER));
      } else {
        log("    %s (%d docs)", n.label, n.docCount);
      }
    }
    const unrecommended = noIndex.filter(n => !INDEX_RECOMMENDATIONS[n.label]);
    if (unrecommended.length > 0) {
      log("    %s Review query patterns for: %s", c("\u26A0", AMBER), unrecommended.map(n => n.label).join(", "));
    }
  }

  if (overallAvg < 50 && connectMs < 300 && cumulativeReadAvgMs < 100) {
    log("  %s Everything looks healthy.", c("\u2713", GREEN));
  }
  log("");
}

export function createDiagnoseCommand(): Command {
  const diagnose = new Command("diagnose")
    .description("Run performance diagnostics against an environment's MongoDB");

  diagnose
    .argument("[environment]", "Environment name (defaults to staging)", "staging")
    .action(async (environment: string) => {
      try {
        await runDiagnostics(environment);
        process.exit(0);
      } catch (error) {
        log("Error: %s", error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return diagnose;
}
