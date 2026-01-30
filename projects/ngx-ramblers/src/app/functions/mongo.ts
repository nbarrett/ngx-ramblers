export interface MongoRegex {
  $regex: string;
  $options: string;
}

export function fieldStartsWithValue(fieldValue: string): MongoRegex {
  return {$regex: "^" + fieldValue, $options: "i"};
}

export function fieldContainsValue(fieldValue: string): MongoRegex {
  return {$regex: fieldValue, $options: "i"};
}

export function fieldEqualsValue(fieldValue: string): MongoRegex {
  return {$regex: "^" + fieldValue + "$", $options: "i"};
}

export interface ParsedMongoUri {
  uri: string;
  cluster: string;
  username: string;
  password: string;
  database: string;
  groupName: string;
}

export interface MongoDbConnectionConfig {
  cluster: string;
  username: string;
  password: string;
  database: string;
}

export function buildMongoUri(config: MongoDbConnectionConfig): string {
  const { cluster, username, password, database } = config;
  return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${cluster}.mongodb.net/${database}?retryWrites=true&w=majority`;
}

export function parseMongoUri(fullUri: string): ParsedMongoUri | null {
  if (!fullUri?.trim()) {
    return null;
  }

  const uri = fullUri.trim();
  const uriPattern = /^mongodb(\+srv)?:\/\/([^:]+):([^@]+)@(.+)$/;
  const match = uri.match(uriPattern);

  if (!match) {
    return null;
  }

  const [, srvSuffix, username, password, rest] = match;
  const protocol = `mongodb${srvSuffix || ""}`;

  const clusterMatch = rest.match(/^([^\/]+)/);
  const cluster = clusterMatch ? clusterMatch[1].replace(".mongodb.net", "") : "";

  const dbMatch = rest.match(/^[^\/]+\/([^?]+)/);
  const database = dbMatch ? dbMatch[1] : "";

  const groupName = extractGroupNameFromDatabase(database);

  return {
    uri: `${protocol}://${rest}`,
    cluster,
    username: decodeURIComponent(username),
    password: decodeURIComponent(password),
    database,
    groupName
  };
}

export function extractGroupNameFromDatabase(database: string): string {
  if (!database) {
    return "";
  }
  return database
    .replace("ngx-ramblers-", "")
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") + " Group";
}

export function extractClusterFromUri(uri: string): string | null {
  const match = uri.match(/@([^.]+\.[^.]+)\.mongodb\.net/);
  return match ? match[1] : null;
}

export function extractUsernameFromUri(uri: string): string | null {
  const match = uri.match(/mongodb\+srv:\/\/([^:]+):/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return null;
}
