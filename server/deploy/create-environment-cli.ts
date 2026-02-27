import debug from "debug";
import inquirer from "inquirer";
import {
  extractAreaCodeFromGroupCode,
  groupDetails,
  listGroupsByAreaCode,
  validateRamblersApiKey
} from "../lib/environment-setup/ramblers-api-client";
import { createEnvironment, validateSetupRequest } from "../lib/environment-setup/environment-setup-service";
import { validEmail } from "../../projects/ngx-ramblers/src/app/functions/strings";
import {
  AdminUserConfig,
  AwsAdminConfig,
  AwsConfig,
  BrevoConfig,
  EnvironmentBasics,
  EnvironmentSetupRequest,
  GoogleMapsConfig,
  MongoDbConfig,
  RamblersApiConfig,
  RamblersInfo,
  SetupOptions
} from "../lib/environment-setup/types";
import { adminConfigFromEnvironment, validateAwsAdminCredentials } from "../lib/environment-setup/aws-setup";
import { error as logError, log } from "../lib/cli/cli-logger";
import { RamblersGroupsApiResponse } from "../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { AWS_DEFAULTS, FLYIO_DEFAULTS } from "./types";
import { envConfig } from "../lib/env-config/env-config";

const defaults = {
  memory: FLYIO_DEFAULTS.MEMORY,
  scaleCount: String(FLYIO_DEFAULTS.SCALE_COUNT),
  mongodbCluster: "",
  awsRegion: AWS_DEFAULTS.REGION
};

const debugLog = debug(envConfig.logNamespace("create-environment-cli"));
debugLog.enabled = true;

interface GroupSelection {
  group: RamblersGroupsApiResponse;
  areaCode: string;
  areaName: string;
}

async function ensureAwsAdminCredentials(): Promise<void> {
  const existingConfig = adminConfigFromEnvironment();

  if (existingConfig) {
    log("✅ AWS admin credentials found in environment variables");
    const validation = await validateAwsAdminCredentials(existingConfig);
    if (validation.valid) {
      log("✅ AWS admin credentials validated successfully\n");
      return;
    }
    log(`⚠️  AWS credentials validation: ${validation.message}`);
  } else {
    log("⚠️  AWS admin credentials not found in environment variables");
    log("   These are required to create S3 buckets and IAM users for new environments.\n");
  }

  const { configureNow } = await inquirer.prompt({
    type: "confirm",
    name: "configureNow",
    message: "Would you like to enter AWS admin credentials now?",
    default: true
  });

  if (!configureNow) {
    log("\n⚠️  Continuing without AWS admin credentials.");
    log("   AWS resources will not be auto-created. You can set these later:");
    log("   - SETUP_AWS_ACCESS_KEY_ID");
    log("   - SETUP_AWS_SECRET_ACCESS_KEY");
    log("   - SETUP_AWS_REGION\n");
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "accessKeyId",
      message: "AWS Access Key ID:",
      default: process.env.SETUP_AWS_ACCESS_KEY_ID || "",
      validate: input => input.trim() ? true : "Access Key ID is required"
    },
    {
      type: "password",
      name: "secretAccessKey",
      message: "AWS Secret Access Key:",
      default: process.env.SETUP_AWS_SECRET_ACCESS_KEY || "",
      validate: input => input.trim() ? true : "Secret Access Key is required"
    },
    {
      type: "input",
      name: "region",
      message: "AWS Region:",
      default: process.env.SETUP_AWS_REGION || "eu-west-1"
    }
  ]);

  process.env.SETUP_AWS_ACCESS_KEY_ID = answers.accessKeyId;
  process.env.SETUP_AWS_SECRET_ACCESS_KEY = answers.secretAccessKey;
  process.env.SETUP_AWS_REGION = answers.region;

  const newConfig: AwsAdminConfig = {
    accessKeyId: answers.accessKeyId,
    secretAccessKey: answers.secretAccessKey,
    region: answers.region
  };

  log("\n⏳ Validating AWS credentials...");
  const validation = await validateAwsAdminCredentials(newConfig);

  if (validation.valid) {
    log("✅ AWS admin credentials validated successfully\n");
  } else {
    log(`⚠️  ${validation.message}`);
    log("   Continuing anyway - AWS resource creation may fail.\n");
  }
}

async function promptRamblersApiKey(): Promise<string> {
  const { apiKey } = await inquirer.prompt({
    type: "input",
    name: "apiKey",
    message: "Enter your Ramblers API key:",
    validate: async input => {
      if (!input.trim()) return "API key is required";
      const validation = await validateRamblersApiKey(input.trim());
      return validation.valid || validation.message;
    }
  });
  return apiKey.trim();
}

async function promptGroupSelection(apiKey: string): Promise<GroupSelection> {
  const { lookupMethod } = await inquirer.prompt({
    type: "list",
    name: "lookupMethod",
    message: "How would you like to find the group?",
    choices: [
      { name: "Enter group code directly (e.g., 01SURREY)", value: "direct" },
      { name: "Browse groups by area code", value: "browse" }
    ]
  });

  if (lookupMethod === "direct") {
    const { groupCode } = await inquirer.prompt({
      type: "input",
      name: "groupCode",
      message: "Enter the Ramblers group code:",
      validate: input => input.trim() ? true : "Group code is required"
    });

    const group = await groupDetails({ groupCode: groupCode.trim(), apiKey });
    if (!group) {
      log(`Group ${groupCode} not found. Please try again.`);
      return promptGroupSelection(apiKey);
    }

    const areaCode = extractAreaCodeFromGroupCode(groupCode.trim());
    return {
      group,
      areaCode,
      areaName: group.name.includes("Area") ? group.name : `Area ${areaCode}`
    };
  }

  const { areaCode } = await inquirer.prompt({
    type: "input",
    name: "areaCode",
    message: "Enter the 2-digit area code (e.g., 01, 02):",
    validate: input => /^\d{2}$/.test(input.trim()) || "Area code must be 2 digits"
  });

  log("Fetching groups in area...");
  const groups = await listGroupsByAreaCode({ areaCode: areaCode.trim(), apiKey });

  if (groups.length === 0) {
    log(`No groups found for area ${areaCode}. Please try again.`);
    return promptGroupSelection(apiKey);
  }

  const { selectedGroup } = await inquirer.prompt({
    type: "list",
    name: "selectedGroup",
    message: "Select a group:",
    choices: groups.map(g => ({
      name: `${g.group_code} - ${g.name}`,
      value: g
    })),
    pageSize: 20
  });

  return {
    group: selectedGroup,
    areaCode: areaCode.trim(),
    areaName: groups[0]?.name?.includes("Area") ? groups[0].name : `Area ${areaCode}`
  };
}

async function promptEnvironmentBasics(groupName: string): Promise<EnvironmentBasics> {
  const defaultEnvName = groupName.toLowerCase()
    .replace(/ramblers?/gi, "")
    .replace(/group/gi, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 20);

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "environmentName",
      message: "Environment name:",
      default: defaultEnvName,
      validate: input => /^[a-z0-9-]+$/.test(input) || "Must be lowercase alphanumeric with hyphens"
    },
    {
      type: "input",
      name: "appName",
      message: "Fly.io app name:",
      default: (a: { environmentName: string }) => `ngx-ramblers-${a.environmentName}`
    },
    {
      type: "input",
      name: "memory",
      message: "Memory allocation (MB):",
      default: defaults.memory
    },
    {
      type: "input",
      name: "scaleCount",
      message: "Number of instances:",
      default: defaults.scaleCount
    },
    {
      type: "input",
      name: "organisation",
      message: "Fly.io organisation:",
      default: "personal"
    }
  ]);

  return {
    environmentName: answers.environmentName,
    appName: answers.appName,
    memory: answers.memory,
    scaleCount: parseInt(answers.scaleCount, 10),
    organisation: answers.organisation
  };
}

async function promptMongoDbConfig(environmentName: string): Promise<MongoDbConfig> {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "cluster",
      message: "MongoDB Atlas cluster (without .mongodb.net):",
      default: defaults.mongodbCluster
    },
    {
      type: "input",
      name: "username",
      message: "MongoDB username:",
      default: environmentName
    },
    {
      type: "password",
      name: "password",
      message: "MongoDB password:",
      validate: input => input.trim() ? true : "Password is required"
    },
    {
      type: "input",
      name: "database",
      message: "MongoDB database name:",
      default: `ngx-ramblers-${environmentName}`
    }
  ]);

  return answers;
}

async function promptAwsConfig(environmentName: string): Promise<AwsConfig> {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "bucket",
      message: "AWS S3 bucket name (will be auto-created):",
      default: `ngx-ramblers-${environmentName}`
    },
    {
      type: "input",
      name: "region",
      message: "AWS region:",
      default: defaults.awsRegion
    }
  ]);

  return answers;
}

async function promptBrevoConfig(): Promise<BrevoConfig> {
  const { apiKey } = await inquirer.prompt({
    type: "input",
    name: "apiKey",
    message: "Brevo API key:",
    validate: input => input.trim() ? true : "Brevo API key is required"
  });

  return { apiKey };
}

async function promptGoogleMapsConfig(): Promise<GoogleMapsConfig> {
  const { apiKey } = await inquirer.prompt({
    type: "input",
    name: "apiKey",
    message: `Google Maps API key (enter for shared default or configure in database later):`,
    default: ""
  });

  return { apiKey };
}

async function promptRamblersConfig(apiKey: string): Promise<RamblersApiConfig> {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "walksManagerUsername",
      message: "Walks Manager username (optional, leave empty to use shared):",
      default: ""
    },
    {
      type: "password",
      name: "walksManagerPassword",
      message: "Walks Manager password (optional, leave empty to use shared):",
      default: ""
    }
  ]);

  return {
    apiKey,
    walksManagerUsername: answers.walksManagerUsername || undefined,
    walksManagerPassword: answers.walksManagerPassword || undefined
  };
}

async function promptAdminUser(): Promise<AdminUserConfig> {
  const answers: Record<string, string> = {};

  const firstNameAnswer = await inquirer.prompt({
    type: "input",
    name: "firstName",
    message: "Admin user first name:",
    validate: (input: string) => input.trim() ? true : "First name is required"
  });
  answers.firstName = firstNameAnswer.firstName;

  const lastNameAnswer = await inquirer.prompt({
    type: "input",
    name: "lastName",
    message: "Admin user last name:",
    validate: (input: string) => input.trim() ? true : "Last name is required"
  });
  answers.lastName = lastNameAnswer.lastName;

  const emailAnswer = await inquirer.prompt({
    type: "input",
    name: "email",
    message: "Admin user email:",
    validate: (input: string) => validEmail(input) || "Valid email is required"
  });
  answers.email = emailAnswer.email;

  return {
    firstName: answers.firstName,
    lastName: answers.lastName,
    email: answers.email
  };
}

async function promptSetupOptions(brevoApiKey: string): Promise<SetupOptions> {
  return inquirer.prompt([
    {
      type: "confirm",
      name: "includeSamplePages",
      message: "Include sample page content?",
      default: true
    },
    {
      type: "confirm",
      name: "includeNotificationConfigs",
      message: "Include notification configurations?",
      default: true
    },
    {
      type: "confirm",
      name: "populateBrevoTemplates",
      message: "Populate Brevo templates?",
      default: !!brevoApiKey
    },
    {
      type: "confirm",
      name: "authenticateBrevoDomain",
      message: "Authenticate Brevo sending domain via Cloudflare DNS?",
      default: !!brevoApiKey
    },
    {
      type: "confirm",
      name: "skipFlyDeployment",
      message: "Skip Fly.io deployment (database init only)?",
      default: false
    },
    {
      type: "confirm",
      name: "copyStandardAssets",
      message: "Copy standard assets (logos, icons, backgrounds) to S3?",
      default: true
    },
    {
      type: "confirm",
      name: "setupSubdomain",
      message: "Setup subdomain (DNS + SSL certificate)?",
      default: false
    }
  ]);
}

function displaySummary(request: EnvironmentSetupRequest): void {
  log("\n========================================");
  log("  ENVIRONMENT SETUP SUMMARY");
  log("========================================\n");

  log("Ramblers Group:");
  log(`  Group Code: ${request.ramblersInfo.groupCode}`);
  log(`  Group Name: ${request.ramblersInfo.groupName}`);
  log(`  Area Code: ${request.ramblersInfo.areaCode}`);
  log(`  Area Name: ${request.ramblersInfo.areaName}`);

  log("\nEnvironment:");
  log(`  Name: ${request.environmentBasics.environmentName}`);
  log(`  App Name: ${request.environmentBasics.appName}`);
  log(`  Memory: ${request.environmentBasics.memory}MB`);
  log(`  Instances: ${request.environmentBasics.scaleCount}`);

  log("\nMongoDB:");
  log(`  Cluster: ${request.serviceConfigs.mongodb.cluster}`);
  log(`  Database: ${request.serviceConfigs.mongodb.database}`);
  log(`  Username: ${request.serviceConfigs.mongodb.username}`);

  log("\nAWS:");
  log(`  Bucket: ${request.serviceConfigs.aws.bucket}`);
  log(`  Region: ${request.serviceConfigs.aws.region}`);

  log("\nAdmin User:");
  log(`  Name: ${request.adminUser.firstName} ${request.adminUser.lastName}`);
  log(`  Email: ${request.adminUser.email}`);

  log("\nOptions:");
  log(`  Sample Pages: ${request.options.includeSamplePages ? "Yes" : "No"}`);
  log(`  Notification Configs: ${request.options.includeNotificationConfigs ? "Yes" : "No"}`);
  log(`  Populate Brevo Templates: ${request.options.populateBrevoTemplates ? "Yes" : "No"}`);
  log(`  Skip Fly.io: ${request.options.skipFlyDeployment ? "Yes" : "No"}`);
  log(`  Copy Standard Assets: ${request.options.copyStandardAssets ? "Yes" : "No"}`);

  log("\n========================================\n");
}

async function main(): Promise<void> {
  log("\n🚀 ngx-ramblers Environment Setup\n");

  await ensureAwsAdminCredentials();

  const ramblersApiKey = await promptRamblersApiKey();
  const groupSelection = await promptGroupSelection(ramblersApiKey);
  const environmentBasics = await promptEnvironmentBasics(groupSelection.group.name);
  const mongodb = await promptMongoDbConfig(environmentBasics.environmentName);
  const aws = await promptAwsConfig(environmentBasics.environmentName);
  const brevo = await promptBrevoConfig();
  const googleMaps = await promptGoogleMapsConfig();
  const ramblers = await promptRamblersConfig(ramblersApiKey);
  const adminUser = await promptAdminUser();
  const options = await promptSetupOptions(brevo.apiKey);

  const ramblersInfo: RamblersInfo = {
    areaCode: groupSelection.areaCode,
    areaName: groupSelection.areaName,
    groupCode: groupSelection.group.group_code,
    groupName: groupSelection.group.name,
    groupUrl: groupSelection.group.url || groupSelection.group.external_url,
    groupData: groupSelection.group
  };

  const request: EnvironmentSetupRequest = {
    ramblersInfo,
    environmentBasics,
    serviceConfigs: {
      aws,
      mongodb,
      brevo,
      googleMaps,
      ramblers
    },
    adminUser,
    options
  };

  displaySummary(request);

  const { proceed } = await inquirer.prompt({
    type: "confirm",
    name: "proceed",
    message: "Do you want to proceed with environment creation?",
    default: true
  });

  if (!proceed) {
    log("\nSetup cancelled.");
    process.exit(0);
  }

  log("\n⏳ Validating configuration...");
  const validationResults = await validateSetupRequest(request);
  const failedValidations = validationResults.filter(r => !r.valid);

  if (failedValidations.length > 0) {
    log("\n❌ Validation failed:");
    failedValidations.forEach(r => log(`   - ${r.message}`));
    process.exit(1);
  }

  log("✅ All validations passed\n");
  log("⏳ Creating environment...\n");

  try {
    const result = await createEnvironment(request, progress => {
      const statusIcon = progress.status === "completed" ? "✅" :
        progress.status === "failed" ? "❌" :
          progress.status === "running" ? "⏳" : "⏸️";
      log(`${statusIcon} ${progress.step}${progress.message ? `: ${progress.message}` : ""}`);
    });

    log("\n========================================");
    log("  ✅ ENVIRONMENT CREATED SUCCESSFULLY");
    log("========================================\n");
    log(`Environment Name: ${result.environmentName}`);
    log(`App URL: ${result.appUrl}`);
    log(`Admin User: ${adminUser.email}`);
    log("\nNext Steps:");
    log("1. Deploy the app: npm run deploy");
    log(`2. Open the app: ${result.appUrl}`);
    log(`3. Login with: ${adminUser.email}`);
    log("\n");
  } catch (error) {
    log("\n❌ Environment creation failed:", error.message);
    process.exit(1);
  }
}

main().catch(error => {
  logError("Unexpected error:", error);
  process.exit(1);
});
