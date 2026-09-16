import { randomBytes } from "crypto";
import { MongoClient } from "mongodb";
import { buildMongoUri } from "../shared/mongodb-uri";

export interface EnvironmentMongoAdmin {
  cluster: string;
  username: string;
  password: string;
}

export interface CreatedEnvironmentMongoUser {
  username: string;
  password: string;
}

function databaseUserName(environmentName: string): string {
  const sanitised = (environmentName || "group").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return `ngx_${sanitised || "group"}_db_user`.slice(0, 64);
}

function databaseUserPassword(): string {
  return randomBytes(24).toString("base64url");
}

export async function createEnvironmentMongoUser(admin: EnvironmentMongoAdmin, database: string, environmentName: string): Promise<CreatedEnvironmentMongoUser> {
  const username = databaseUserName(environmentName);
  const password = databaseUserPassword();
  const roles = [{role: "readWrite", db: database}, {role: "dbAdmin", db: database}];
  const uri = buildMongoUri({cluster: admin.cluster, username: admin.username, password: admin.password, database: "admin"});
  const client = await MongoClient.connect(uri, {serverSelectionTimeoutMS: 30000, connectTimeoutMS: 30000});
  try {
    const adminDb = client.db("admin");
    try {
      await adminDb.command({createUser: username, pwd: password, roles});
    } catch (error: any) {
      if (error?.codeName === "DuplicateUser" || error?.code === 51003) {
        await adminDb.command({updateUser: username, pwd: password, roles});
      } else {
        throw new Error(`Could not create a MongoDB user for ${environmentName}: ${error?.message || error}`);
      }
    }
  } finally {
    await client.close();
  }
  return {username, password};
}
