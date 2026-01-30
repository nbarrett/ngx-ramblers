import { Command } from "commander";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { buildMongoUri } from "../../shared/mongodb-uri";
import { validateMongoConnection } from "../../environment-setup/database-initialiser";
import { validateAwsAdminCredentials, adminConfigFromEnvironment } from "../../environment-setup/aws-setup";
import { validateRamblersApiKey } from "../../environment-setup/ramblers-api-client";
import { ValidationResult, MongoValidationConfig, ProgressCallback } from "../types";
import { log } from "../cli-logger";

const debugLog = debug(envConfig.logNamespace("cli:validate"));

export async function validateMongodb(config: MongoValidationConfig, onProgress?: ProgressCallback): Promise<ValidationResult> {
  if (onProgress) {
    onProgress({ step: "validate-mongodb", status: "running", message: "Validating MongoDB connection" });
  }

  const uri = buildMongoUri(config);
  const result = await validateMongoConnection({ uri, database: config.database });

  if (onProgress) {
    onProgress({
      step: "validate-mongodb",
      status: result.valid ? "completed" : "failed",
      message: result.message
    });
  }

  return result;
}

export async function validateAwsAdmin(onProgress?: ProgressCallback): Promise<ValidationResult> {
  if (onProgress) {
    onProgress({ step: "validate-aws-admin", status: "running", message: "Validating AWS admin credentials" });
  }

  const adminConfig = adminConfigFromEnvironment();
  if (!adminConfig) {
    const result: ValidationResult = {
      valid: false,
      message: "AWS admin credentials not configured (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or SETUP_AWS_ACCESS_KEY_ID/SETUP_AWS_SECRET_ACCESS_KEY)"
    };
    if (onProgress) {
      onProgress({ step: "validate-aws-admin", status: "failed", message: result.message });
    }
    return result;
  }

  const result = await validateAwsAdminCredentials(adminConfig);

  if (onProgress) {
    onProgress({
      step: "validate-aws-admin",
      status: result.valid ? "completed" : "failed",
      message: result.message
    });
  }

  return result;
}

export async function validateRamblersApi(apiKey: string, onProgress?: ProgressCallback): Promise<ValidationResult> {
  if (onProgress) {
    onProgress({ step: "validate-ramblers-api", status: "running", message: "Validating Ramblers API key" });
  }

  const result = await validateRamblersApiKey(apiKey);

  if (onProgress) {
    onProgress({
      step: "validate-ramblers-api",
      status: result.valid ? "completed" : "failed",
      message: result.message
    });
  }

  return result;
}

export function createValidateCommand(): Command {
  const validate = new Command("validate")
    .alias("val")
    .description("Validation commands for credentials and connections");

  validate
    .command("mongodb")
    .description("Validate MongoDB connection")
    .requiredOption("--cluster <cluster>", "MongoDB cluster (e.g., cluster0.abc123)")
    .requiredOption("--username <username>", "MongoDB username")
    .requiredOption("--password <password>", "MongoDB password")
    .requiredOption("--database <database>", "MongoDB database name")
    .action(async options => {
      try {
        const result = await validateMongodb({
          cluster: options.cluster,
          username: options.username,
          password: options.password,
          database: options.database
        });
        log("%s %s", result.valid ? "✓" : "✗", result.message);
        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  validate
    .command("aws-admin")
    .description("Validate AWS admin credentials from environment variables")
    .action(async () => {
      try {
        const result = await validateAwsAdmin();
        log("%s %s", result.valid ? "✓" : "✗", result.message);
        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  validate
    .command("ramblers-api")
    .description("Validate Ramblers API key")
    .requiredOption("--api-key <key>", "Ramblers API key")
    .action(async options => {
      try {
        const result = await validateRamblersApi(options.apiKey);
        console.log(result.valid ? "✓" : "✗", result.message);
        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
      }
    });

  return validate;
}
