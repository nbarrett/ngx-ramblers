import { randomBytes } from "crypto";
import { MongoClient } from "mongodb";
import { buildMongoUri } from "../shared/mongodb-uri";
import { atlasRequest } from "./atlas-admin-api";
import { AtlasApiAccess, AtlasError } from "./atlas-admin-api.model";
import { registrationSettings } from "../site-registration/registration-store";
import { configuredEnvironments } from "../environments/environments-config";
import { ConsoleAccessService } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";

export interface CreatedEnvironmentMongoUser {
  username: string;
  password: string;
}

export function environmentDatabaseUserName(environmentName: string): string {
  const sanitised = (environmentName || "group").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return `ngx_${sanitised || "group"}_db_user`.slice(0, 64);
}

export async function platformAtlasAccess(): Promise<AtlasApiAccess> {
  const settings = await registrationSettings();
  const environments = await configuredEnvironments();
  const platform = environments.environments?.find(environment => environment.environment === settings.sourceEnvironmentName);
  return {...environments.atlas, projectId: platform?.consoleAccess?.[ConsoleAccessService.MONGODB_ATLAS]?.identifiers?.projectId};
}

export async function deleteEnvironmentMongoUser(atlas: AtlasApiAccess, username: string): Promise<string> {
  if (!atlas?.projectId || !atlas?.publicKey || !atlas?.privateKey) {
    throw new Error("MongoDB Atlas API access is not set up; remove the user by hand under Database Access in Atlas");
  } else {
    const deleted = await atlasRequest<AtlasError>(atlas, "DELETE", `/groups/${atlas.projectId}/databaseUsers/admin/${encodeURIComponent(username)}`);
    if (deleted.status === 404) {
      return `${username} not found (already deleted)`;
    } else if (deleted.status >= 300) {
      throw atlasFailure("delete", username, deleted.status, deleted.body);
    } else {
      return `Deleted ${username}`;
    }
  }
}

function databaseUserPassword(): string {
  return randomBytes(24).toString("base64url");
}

function atlasFailure(action: string, username: string, status: number, error: AtlasError | null): Error {
  return new Error(`MongoDB Atlas would not ${action} the database user ${username} (${status}${error?.errorCode ? ` ${error.errorCode}` : ""}): ${error?.detail || error?.reason || "no detail given"}`);
}

export async function createEnvironmentMongoUser(atlas: AtlasApiAccess, database: string, environmentName: string): Promise<CreatedEnvironmentMongoUser> {
  if (!atlas?.projectId) {
    throw new Error("The platform site has no MongoDB Atlas project ID, so the new site cannot be given its own database user. Add it under Estate rebuild → System logins → MongoDB Atlas, then retry.");
  } else if (!atlas?.publicKey || !atlas?.privateKey) {
    throw new Error("MongoDB Atlas API access is not set up, so the new site cannot be given its own database user. Add the Atlas API public and private key under Environment management → Global settings → MongoDB Atlas, then retry.");
  } else {
    const username = environmentDatabaseUserName(environmentName);
    const password = databaseUserPassword();
    const roles = [{databaseName: database, roleName: "readWrite"}, {databaseName: database, roleName: "dbAdmin"}];
    const users = `/groups/${atlas.projectId}/databaseUsers`;
    const created = await atlasRequest<AtlasError>(atlas, "POST", users, {databaseName: "admin", groupId: atlas.projectId, username, password, roles});
    const updated = created.status === 409
      ? await atlasRequest<AtlasError>(atlas, "PATCH", `${users}/admin/${encodeURIComponent(username)}`, {password, roles})
      : null;
    if (updated && updated.status >= 300) {
      throw atlasFailure("update", username, updated.status, updated.body);
    } else if (!updated && created.status >= 300) {
      throw atlasFailure("create", username, created.status, created.body);
    } else {
      return {username, password};
    }
  }
}

const LOGIN_ATTEMPTS = 30;
const LOGIN_RETRY_MS = 10000;

async function mongoLoginWorks(cluster: string, user: CreatedEnvironmentMongoUser, database: string): Promise<boolean> {
  return MongoClient.connect(buildMongoUri({cluster, username: user.username, password: user.password, database}), {serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000})
    .then(async client => {
      await client.db(database).command({ping: 1});
      await client.close();
      return true;
    })
    .catch(() => false);
}

export async function waitForMongoLogin(cluster: string, user: CreatedEnvironmentMongoUser, database: string, onWaiting: (attempt: number) => void, retryMs = LOGIN_RETRY_MS, attempt = 1): Promise<void> {
  if (await mongoLoginWorks(cluster, user, database)) {
    onWaiting(0);
  } else if (attempt >= LOGIN_ATTEMPTS) {
    throw new Error(`MongoDB Atlas had not activated the database user ${user.username} after ${Math.round(LOGIN_ATTEMPTS * retryMs / 60000)} minutes. Retry the registration in a few minutes.`);
  } else {
    onWaiting(attempt);
    await new Promise(resolve => setTimeout(resolve, retryMs));
    await waitForMongoLogin(cluster, user, database, onWaiting, retryMs, attempt + 1);
  }
}
