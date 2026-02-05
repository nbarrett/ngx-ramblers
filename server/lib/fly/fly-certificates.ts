import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("fly:certificates"));

export interface FlyConfig {
  apiToken: string;
  appName: string;
}

export interface CertificateInfo {
  hostname: string;
  clientStatus: string;
  issued: { type: string; expiresAt: string }[];
}

export interface AppIpAddresses {
  ipv4: string | null;
  ipv6: string | null;
}

interface GraphQLCertNode {
  hostname: string;
  clientStatus: string;
  issued: { nodes: { type: string; expiresAt: string }[] };
}

interface GraphQLCertsResponse {
  app: { certificates: { nodes: GraphQLCertNode[] } };
}

interface GraphQLAddCertResponse {
  addCertificate: { certificate: { hostname: string; createdAt: string } };
}

async function graphqlRequest<T>(apiToken: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch("https://api.fly.io/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  const data = await response.json();

  if (data.errors?.length > 0) {
    const errorMsg = data.errors.map((e: { message: string }) => e.message).join(", ");
    throw new Error(errorMsg);
  }

  return data.data;
}

export async function appIpAddresses(appName: string): Promise<AppIpAddresses> {
  const { execSync } = await import("child_process");

  debugLog("Looking up IP addresses for %s.fly.dev", appName);

  let ipv4: string | null = null;
  let ipv6: string | null = null;

  try {
    ipv4 = execSync(`dig +short ${appName}.fly.dev A`, { encoding: "utf-8" }).trim().split("\n")[0] || null;
  } catch {
    debugLog("Failed to get IPv4 address");
  }

  try {
    ipv6 = execSync(`dig +short ${appName}.fly.dev AAAA`, { encoding: "utf-8" }).trim().split("\n")[0] || null;
  } catch {
    debugLog("Failed to get IPv6 address");
  }

  debugLog("IP addresses: IPv4=%s, IPv6=%s", ipv4, ipv6);
  return { ipv4, ipv6 };
}

export async function addCertificate(config: FlyConfig, hostname: string): Promise<{ hostname: string; createdAt: string } | null> {
  debugLog("Adding certificate for %s to app %s", hostname, config.appName);

  const query = `
    mutation($appId: ID!, $hostname: String!) {
      addCertificate(appId: $appId, hostname: $hostname) {
        certificate {
          hostname
          createdAt
        }
      }
    }
  `;

  try {
    const data = await graphqlRequest<GraphQLAddCertResponse>(
      config.apiToken,
      query,
      { appId: config.appName, hostname }
    );
    return data.addCertificate?.certificate || null;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Hostname already exists")) {
      debugLog("Certificate already exists for %s", hostname);
      return null;
    }
    throw error;
  }
}

export async function getCertificates(config: FlyConfig): Promise<CertificateInfo[]> {
  debugLog("Getting certificates for app %s", config.appName);

  const query = `
    query($appName: String!) {
      app(name: $appName) {
        certificates {
          nodes {
            hostname
            clientStatus
            issued {
              nodes {
                type
                expiresAt
              }
            }
          }
        }
      }
    }
  `;

  const data = await graphqlRequest<GraphQLCertsResponse>(
    config.apiToken,
    query,
    { appName: config.appName }
  );

  return data.app.certificates.nodes.map(cert => ({
    hostname: cert.hostname,
    clientStatus: cert.clientStatus,
    issued: cert.issued.nodes
  }));
}

export async function deleteCertificate(config: FlyConfig, hostname: string): Promise<void> {
  debugLog("Deleting certificate for %s from app %s", hostname, config.appName);

  const query = `
    mutation($appId: ID!, $hostname: String!) {
      deleteCertificate(appId: $appId, hostname: $hostname) {
        app { name }
      }
    }
  `;

  await graphqlRequest(config.apiToken, query, { appId: config.appName, hostname });
  debugLog("Certificate deleted");
}
