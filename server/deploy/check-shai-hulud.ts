#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { Command } from "commander";
import debug from "debug";
import * as semver from "semver";
import * as yaml from "js-yaml";
import { isArray, isString } from "es-toolkit/compat";

const debugLog = debug("check-shai-hulud");
debugLog.enabled = true;

const LOCKFILES: string[] = ["package-lock.json", "pnpm-lock.yaml"];

interface KnownCompromised {
  [packageName: string]: string[];
}

const KNOWN_COMPROMISED: KnownCompromised = {
  "@asyncapi/diff": [">=3.0.0"],
  "@asyncapi/nodejs-ws-template": [">=1.0.0"],
  "@asyncapi/specs": [">=3.0.0"],
  "@asyncapi/generator": [">=2.0.0"],
  "@asyncapi/cli": [">=3.0.0"],
  "@asyncapi/parser": [">=2.0.0"],
  "posthog-node": [">=3.0.0"],
  "posthog-js": [">=1.0.0"],
  "@posthog/nextjs": [">=1.0.0"],
  "@posthog/plugin-server": [">=0.10.0"],
  "@posthog/rrweb": [">=2.0.0"],
  "@postman/tunnel-agent": [">=0.6.0"],
  "@postman/postman-collection-fork": [">=1.0.0"],
  "@postman/pm-bin-macos-arm64": [">=1.0.0"],
  "@ensdomains/ensjs": [">=2.0.0"],
  "@ensdomains/renewal": [">=1.0.0"],
  "@ensdomains/content-hash": [">=2.0.0"],
  "@ensdomains/thorin": [">=1.0.0"],
  "@zapier/zapier-sdk": [">=12.0.0"],
  "@zapier/platform-core": [">=12.0.0"],
  "@zapier/platform-cli": [">=12.0.0"],
  "go-template": [">=1.0.0"],
  "axios-builder": [">=1.0.0"],
  "eslint-config-zeallat-base": [">=1.0.0"],
  "react-native-use-modal": [">=1.0.0"],
  "medusa-plugin-zalopay": [">=1.0.0"],
};

interface PackageLock {
  name?: string;
  version?: string;
  packages?: Record<string, PackageLock>;
  dependencies?: Record<string, PackageLock>;
}

interface Vulnerability {
  pkg: string;
  ver: string;
  advice: string;
}

function deriveName(pkgPath: string): string | null {
  if (!pkgPath) {
    return null;
  }
  const normalized = pkgPath.replace(/^node_modules\//, "");
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("@")) {
    const segments = normalized.split("/");
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }
  const segments = normalized.split("/");
  return segments[0] || null;
}

function derivePnpmName(key: string): { name: string | null; version: string | null } {
  if (!key) {
    return { name: null, version: null };
  }
  const cleaned = key.replace(/^\/+/, "");
  const atIndex = cleaned.lastIndexOf("@");
  if (atIndex > 0) {
    const namePart = cleaned.slice(0, atIndex);
    const versionPart = cleaned.slice(atIndex + 1);
    const version = versionPart.split("(")[0].split("_")[0] || null;
    const name = namePart || null;
    return { name, version };
  }
  const segments = cleaned.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const versionCandidate = segments.pop() || "";
    const version = versionCandidate.split("(")[0].split("_")[0] || null;
    const name = segments.join("/") || null;
    return { name, version };
  }
  return { name: null, version: null };
}

function parsePnpmLockfile(lockfilePath: string): Record<string, string> {
  if (!fs.existsSync(lockfilePath)) {
    debugLog(`❌ No ${lockfilePath} found. Run 'pnpm install' first.`);
    process.exit(1);
  }
  const data = yaml.load(fs.readFileSync(lockfilePath, "utf8")) as Record<string, any>;
  const deps: Record<string, string> = {};
  const packages = (data && (data.packages || data.snapshots)) || {};
  const keys = Object.keys(packages);
  debugLog(`🔍 Lockfile format: pnpm (${lockfilePath})`);
  debugLog(`🔍 Raw package entries: ${keys.length}`);
  keys.forEach((key: string) => {
    const pkgData = packages[key] || {};
    const name = pkgData.name || derivePnpmName(key).name;
    const versionFromKey = derivePnpmName(key).version;
    const version = pkgData.version || versionFromKey;
    if (name && version) {
      deps[name] = version;
    } else {
      debugLog(`⚠️  Skipping invalid entry at ${key}: missing name/version`);
    }
  });
  const sample = Object.entries(deps).slice(0, 5).map(([k, v]) => `${k}@${v}`).join(", ");
  debugLog(`🔍 Sample extracted deps (first 5): ${sample}${Object.keys(deps).length > 5 ? ` ... (total ${Object.keys(deps).length})` : ""}`);
  return deps;
}

function parseLockfile(lockfilePath: string): Record<string, string> {
  if (lockfilePath.endsWith(".yaml") || lockfilePath.endsWith(".yml")) {
    return parsePnpmLockfile(lockfilePath);
  }
  if (!fs.existsSync(lockfilePath)) {
    debugLog(`❌ No ${lockfilePath} found. Run 'npm install' first.`);
    process.exit(1);
  }
  const lockData: PackageLock = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
  const deps: Record<string, string> = {};

  if (lockData.name && lockData.version) {
    deps[lockData.name] = lockData.version;
  }

  const packages = lockData.packages || {};
  const rawCount = Object.keys(packages).length;
  const isV3 = !!packages;
  debugLog(`🔍 Lockfile format: ${isV3 ? "v3 (modern npm 7+)" : "v2 (older; limited support)"}`);
  debugLog(`🔍 Raw package entries: ${rawCount}`);

  Object.entries(packages).forEach(([pkgPath, pkgData]) => {
    const version = pkgData.version;
    const name = pkgData.name || deriveName(pkgPath);
    if (name && version) {
      deps[name] = version;
    } else {
      debugLog(`⚠️  Skipping invalid entry at ${pkgPath}: missing name/version`);
    }
  });

  if (!isV3 && lockData.dependencies) {
    function extractV2(node: PackageLock): void {
      if (node.name && node.version) {
        deps[node.name] = node.version;
      }
      if (node.dependencies) {
        Object.values(node.dependencies).forEach((dep: PackageLock) => extractV2(dep));
      }
    }

    extractV2(lockData);
    debugLog(`🔍 v2 fallback: Added ${Object.keys(deps).length - rawCount} extra deps`);
  }

  const sample = Object.entries(deps).slice(0, 5).map(([k, v]) => `${k}@${v}`).join(", ");
  debugLog(`🔍 Sample extracted deps (first 5): ${sample}${Object.keys(deps).length > 5 ? ` ... (total ${Object.keys(deps).length})` : ""}`);

  return deps;
}

function checkCompromised(deps: Record<string, string>): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  Object.entries(deps).forEach(([pkg, ver]) => {
    const compromisedVersions = KNOWN_COMPROMISED[pkg];
    if (compromisedVersions) {
      const isVulnerable = compromisedVersions.some((range: string) => {
        return semver.satisfies(ver, range, { loose: true });
      });
      if (isVulnerable) {
        vulnerabilities.push({
          pkg,
          ver,
          advice: `Vulnerable to Shai-Hulud 2.0. Pin to pre-Nov 21 version or remove. Run 'npm uninstall ${pkg}'`,
        });
      }
    }
  });
  return vulnerabilities;
}

interface AuditResult {
  issues: AuditIssue[];
  skipped: boolean;
  reason?: string;
}

interface AuditIssue {
  name: string;
  version: string;
  severity: string;
  via: string[];
}

function runNpmAudit(baseDir: string, packageManager: "npm" | "pnpm", skipAudit: boolean): AuditResult {
  if (skipAudit) {
    return { issues: [], skipped: true, reason: "skipped by flag" };
  }
  try {
    const auditCmd = packageManager === "pnpm" ? "pnpm audit --json" : "npm audit --json";
    const auditOutput: string = execSync(auditCmd, { encoding: "utf8", cwd: baseDir });
    const audit: any = JSON.parse(auditOutput);
    const highVulns = audit.vulnerabilities
      ? Object.values(audit.vulnerabilities).filter((v: any) => v.severity === "high" || v.severity === "critical")
      : [];
    return { issues: extractAuditIssues(highVulns), skipped: false };
  } catch (err: unknown) {
    const message = (err as Error).message || "";
    const stdout = (err as { stdout?: Buffer | string }).stdout;
    if (stdout) {
      try {
        const audit: any = JSON.parse(stdout.toString());
        const highVulns = audit.vulnerabilities
          ? Object.values(audit.vulnerabilities).filter((v: any) => v.severity === "high" || v.severity === "critical")
          : [];
        return { issues: extractAuditIssues(highVulns), skipped: false };
      } catch {
        debugLog("warn: npm audit output parse failed");
      }
    }
    const isNetwork = message.includes("ENOTFOUND") || message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT");
    if (isNetwork) {
      debugLog("info: npm audit skipped (network unavailable)");
      return { issues: [], skipped: true, reason: "network unavailable" };
    }
    debugLog("warn: npm audit failed (non-critical):", message);
    return { issues: [], skipped: true, reason: "audit failed" };
  }
}

function extractAuditIssues(raw: any[]): AuditIssue[] {
  return raw.map((vuln: any) => ({
    name: vuln.name || "unknown",
    version: vuln.version || "unknown",
    severity: vuln.severity || "unknown",
    via: isArray(vuln.via)
      ? vuln.via.map((item: any) => (isString(item) ? item : item.title || item.source || "unknown"))
      : []
  }));
}

function checkSuspiciousFiles(baseDir: string): string[] {
  const suspicious: string[] = ["cloud.json", "truffleSecrets.json", ".github/workflows/discussion.yaml"];
  return suspicious
    .map((file: string) => path.join(baseDir, file))
    .filter((filePath: string) => fs.existsSync(filePath))
    .map((filePath: string) => `Found suspicious: ${path.relative(baseDir, filePath)}`);
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("check-shai-hulud")
    .description("Scan lockfiles for Shai-Hulud 2.0 indicators")
    .argument("[target]", "Target directory to scan", ".")
    .option("-p, --path <dir>", "Target directory to scan")
    .option("-l, --lockfile <file>", "Override lockfile name")
    .option("--skip-audit", "Skip npm/pnpm audit step", false);

  program.parse(process.argv);
  const options = program.opts<{ path?: string; lockfile?: string; skipAudit?: boolean }>();
  const args = program.processedArgs as string[];

  debugLog("🛡️  Checking for Shai-Hulud 2.0 vulnerabilities...\n");

  const cliPath = options.path || args[0];
  const targetDir = cliPath ? path.resolve(process.cwd(), cliPath) : process.cwd();
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    debugLog(`❌ Target path is invalid: ${targetDir}`);
    process.exit(1);
  }
  debugLog(`📂 Target directory: ${targetDir}`);

  const lockfileCandidates = options.lockfile ? [options.lockfile] : LOCKFILES;
  const lockfile = lockfileCandidates.find((file: string) => fs.existsSync(path.join(targetDir, file)));
  if (!lockfile) {
    debugLog("❌ No lockfile found. Expected package-lock.json or pnpm-lock.yaml");
    process.exit(1);
  }
  const lockfilePath = path.join(targetDir, lockfile);
  const packageManager: "npm" | "pnpm" = lockfile.includes("pnpm-lock") ? "pnpm" : "npm";
  debugLog(`🔗 Using lockfile: ${lockfilePath}`);
  debugLog(`🔧 Package manager: ${packageManager}`);
  const deps: Record<string, string> = parseLockfile(lockfilePath);
  debugLog(`📦 Found ${Object.keys(deps).length} dependencies.\n`);

  const exitReasons: string[] = [];
  const compromised: Vulnerability[] = checkCompromised(deps);
  if (compromised.length > 0) {
    debugLog("🚨 COMPROMISED PACKAGES FOUND:");
    compromised.forEach((v: Vulnerability) => debugLog(`  - ${v.pkg}@${v.ver} → ${v.advice}`));
    exitReasons.push("compromised-packages");
  } else {
    debugLog("✅ No known Shai-Hulud 2.0 packages detected.");
  }

  const auditResult = runNpmAudit(targetDir, packageManager, options.skipAudit === true);
  if (auditResult.issues.length > 0) {
    debugLog("\n🔍 NPM Audit High/Critical Issues:");
    auditResult.issues.forEach((issue: AuditIssue) => {
      const viaText = issue.via.length > 0 ? issue.via.join("; ") : "no detail";
      debugLog(`  - ${issue.name}@${issue.version}: ${issue.severity} - ${viaText}`);
    });
    debugLog('💡 Fix: Run "npm audit fix" (review changes).');
    exitReasons.push("audit-issues");
  } else {
    if (auditResult.skipped) {
      debugLog(`\nℹ️  NPM audit skipped (${auditResult.reason || "no reason provided"}).`);
    } else {
      debugLog("\n✅ NPM audit clean for high/critical vulns.");
    }
  }

  const suspicious: string[] = checkSuspiciousFiles(targetDir);
  if (suspicious.length > 0) {
    debugLog("\n🚨 Suspicious files detected (possible worm persistence):");
    suspicious.forEach((f: string) => debugLog(`  - ${f}`));
    exitReasons.push("suspicious-files");
  } else {
    debugLog("\n✅ No suspicious files found.");
  }

  if (exitReasons.length > 0) {
    const recommendations: string[] = [];
    if (exitReasons.includes("compromised-packages")) {
      recommendations.push("  - Remove or pin compromised packages, then reinstall dependencies.");
      recommendations.push("  - Rotate env secrets (e.g., via Fly.io dashboard).");
    }
    if (exitReasons.includes("audit-issues")) {
      recommendations.push('  - Run "npm audit fix" and manually upgrade remaining high/critical advisories.');
      recommendations.push("  - Rebuild and rerun tests after dependency updates.");
    }
    if (exitReasons.includes("suspicious-files")) {
      recommendations.push("  - Delete suspicious files and verify no persistence artifacts remain.");
    }
    recommendations.push("  - For latest threats: Check https://www.npmjs.com/advisories");
    debugLog("\n🔒 Recommendations:");
    recommendations.forEach((rec: string) => debugLog(rec));
    debugLog(`\n⛔ Exiting with status 1 due to: ${exitReasons.join(", ")}`);
    process.exit(1);
  }
  debugLog("\n✅ Exiting clean.");
}

main();
