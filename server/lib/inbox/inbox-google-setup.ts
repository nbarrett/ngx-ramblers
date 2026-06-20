import debug from "debug";
import { OAuth2Client } from "google-auth-library";
import { envConfig } from "../env-config/env-config";
import {
  GmailServiceAccount,
  GoogleApiService,
  GoogleCloudProvisioningOptions,
  GoogleCloudProvisioningResult,
  GoogleCloudSetupStatus,
  GoogleCloudSetupStatusRecord,
  ProvisioningStep,
  ProvisioningStepStatus
} from "./gmail-inbox.model";
import { inboxSetupStatus as inboxSetupStatusModel } from "../mongo/models/inbox-setup-status";
import { defaultTenantSlug } from "./inbox-aliases";
import { dateTimeNow } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("inbox-google-setup"));
debugLog.enabled = true;

type ProvisioningStepListener = (step: ProvisioningStep) => Promise<void> | void;

export async function beginGoogleCloudSetupStatus(projectId: string, topicName: string): Promise<void> {
  const now = dateTimeNow().toMillis();
  await inboxSetupStatusModel.findOneAndUpdate(
    {tenantSlug: defaultTenantSlug()},
    {
      $set: {
        status: GoogleCloudSetupStatus.RUNNING,
        projectId,
        topicName,
        topicFullName: null,
        subscriptionFullName: null,
        steps: [],
        errorMessage: null,
        startedAt: now,
        updatedAt: now
      }
    },
    {upsert: true});
}

async function appendGoogleCloudSetupStep(step: ProvisioningStep): Promise<void> {
  await inboxSetupStatusModel.updateOne(
    {tenantSlug: defaultTenantSlug()},
    {$push: {steps: step}, $set: {updatedAt: dateTimeNow().toMillis()}});
}

export async function completeGoogleCloudSetupStatus(result: GoogleCloudProvisioningResult): Promise<void> {
  const anyFailed = result.steps.some(step => step.status === ProvisioningStepStatus.FAILED);
  await inboxSetupStatusModel.updateOne(
    {tenantSlug: defaultTenantSlug()},
    {
      $set: {
        status: anyFailed ? GoogleCloudSetupStatus.FAILED : GoogleCloudSetupStatus.COMPLETED,
        projectId: result.projectId,
        topicFullName: result.topicFullName,
        subscriptionFullName: result.subscriptionFullName,
        errorMessage: anyFailed ? result.steps.filter(step => step.status === ProvisioningStepStatus.FAILED).map(step => `${step.step}: ${step.detail}`).join("; ") : null,
        updatedAt: dateTimeNow().toMillis()
      }
    });
}

export async function failGoogleCloudSetupStatus(message: string): Promise<void> {
  await inboxSetupStatusModel.updateOne(
    {tenantSlug: defaultTenantSlug()},
    {$set: {status: GoogleCloudSetupStatus.FAILED, errorMessage: message, updatedAt: dateTimeNow().toMillis()}});
}

export async function currentGoogleCloudSetupStatus(): Promise<GoogleCloudSetupStatusRecord | null> {
  return inboxSetupStatusModel.findOne({tenantSlug: defaultTenantSlug()}).lean() as unknown as GoogleCloudSetupStatusRecord | null;
}

const GOOGLE_API_TIMEOUT_MS = 20000;
const CLOUD_RESOURCE_MANAGER_ROOT = "https://cloudresourcemanager.googleapis.com/v3";
const SERVICE_USAGE_ROOT = "https://serviceusage.googleapis.com/v1";
const PUBSUB_ROOT = "https://pubsub.googleapis.com/v1";

function bootstrapClient(accessToken: string): OAuth2Client {
  const client = new OAuth2Client();
  client.setCredentials({access_token: accessToken});
  return client;
}

function googleApiRequest<T = unknown>(auth: OAuth2Client, url: string, method = "GET", data?: unknown): Promise<{data: T; status: number}> {
  return auth.request<T>({url, method, ...(data === undefined ? {} : {data}), timeout: GOOGLE_API_TIMEOUT_MS});
}

function httpStatusOf(error: unknown): number | undefined {
  return (error as {response?: {status?: number}; code?: number})?.response?.status ?? (error as {code?: number})?.code;
}

function shortSubscriptionName(topicName: string): string {
  return `${topicName}-push`;
}

export async function runGoogleCloudProvisioning(accessToken: string, options: GoogleCloudProvisioningOptions, onStep: ProvisioningStepListener = appendGoogleCloudSetupStep): Promise<GoogleCloudProvisioningResult> {
  const auth = bootstrapClient(accessToken);
  const steps: ProvisioningStep[] = [];

  const recordStep = async (step: ProvisioningStep): Promise<void> => {
    steps.push(step);
    await onStep(step);
  };

  const {step: verifyStep, projectId} = await resolveProject(auth, options.projectId);
  await recordStep(verifyStep);
  if (verifyStep.status === ProvisioningStepStatus.FAILED) {
    return {projectId: options.projectId, topicFullName: "", subscriptionFullName: "", pushReceiverUrl: options.pushReceiverUrl, steps};
  }

  const subscriptionName = options.subscriptionName?.trim() || shortSubscriptionName(options.topicName);
  const topicFullName = `projects/${projectId}/topics/${options.topicName}`;
  const subscriptionFullName = `projects/${projectId}/subscriptions/${subscriptionName}`;

  await recordStep(await enableApi(auth, projectId, GoogleApiService.GMAIL));
  await recordStep(await enableApi(auth, projectId, GoogleApiService.PUBSUB));
  await recordStep(await ensureTopic(auth, topicFullName));
  await recordStep(await grantTopicPublisher(auth, topicFullName));
  await recordStep(await ensurePushSubscription(auth, subscriptionFullName, topicFullName, options.pushReceiverUrl));

  return {projectId, topicFullName, subscriptionFullName, pushReceiverUrl: options.pushReceiverUrl, steps};
}

async function resolveProject(auth: OAuth2Client, projectIdOrNumber: string): Promise<{step: ProvisioningStep; projectId: string}> {
  const stepLabel = `Verify project ${projectIdOrNumber}`;
  try {
    const response = await googleApiRequest<{projectId?: string; displayName?: string}>(auth, `${CLOUD_RESOURCE_MANAGER_ROOT}/projects/${projectIdOrNumber}`);
    const canonicalId = response.data.projectId ?? projectIdOrNumber;
    const displayName = response.data.displayName ?? "";
    return {
      step: {step: stepLabel, status: ProvisioningStepStatus.OK, detail: `Using project ${canonicalId}${displayName ? ` (${displayName})` : ""}`},
      projectId: canonicalId
    };
  } catch (error) {
    const httpStatus = httpStatusOf(error);
    const detail = (httpStatus === 403 || httpStatus === 404)
      ? `Project "${projectIdOrNumber}" was not found or you don't have access. Use the project ID or its number, not the project's display name.`
      : (error as Error).message;
    return {step: {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail}, projectId: projectIdOrNumber};
  }
}

async function enableApi(auth: OAuth2Client, projectId: string, serviceName: string): Promise<ProvisioningStep> {
  const stepLabel = `Enable ${serviceName}`;
  try {
    const existing = await googleApiRequest<{state?: string}>(auth, `${SERVICE_USAGE_ROOT}/projects/${projectId}/services/${serviceName}`);
    if (existing.data.state === "ENABLED") {
      return {step: stepLabel, status: ProvisioningStepStatus.SKIPPED, detail: "API was already enabled"};
    }
    const operation = await googleApiRequest<{name?: string}>(auth, `${SERVICE_USAGE_ROOT}/projects/${projectId}/services/${serviceName}:enable`, "POST", {});
    debugLog(`${stepLabel}: enable started`, operation.data.name ?? "");
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "API enabled"};
  } catch (error) {
    return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (error as Error).message};
  }
}

async function ensureTopic(auth: OAuth2Client, topicFullName: string): Promise<ProvisioningStep> {
  const stepLabel = `Pub/Sub topic ${topicFullName}`;
  try {
    await googleApiRequest(auth, `${PUBSUB_ROOT}/${topicFullName}`);
    return {step: stepLabel, status: ProvisioningStepStatus.SKIPPED, detail: "Topic already exists"};
  } catch (getError) {
    const status = httpStatusOf(getError);
    if (status && status !== 404) {
      return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (getError as Error).message};
    }
  }
  try {
    await googleApiRequest(auth, `${PUBSUB_ROOT}/${topicFullName}`, "PUT", {});
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "Topic created"};
  } catch (createError) {
    return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (createError as Error).message};
  }
}

async function grantTopicPublisher(auth: OAuth2Client, topicFullName: string): Promise<ProvisioningStep> {
  const stepLabel = `Grant Pub/Sub Publisher to ${GmailServiceAccount.PUBLISHER}`;
  try {
    const policyResponse = await googleApiRequest<{bindings?: {role?: string; members?: string[]}[]; etag?: string}>(auth, `${PUBSUB_ROOT}/${topicFullName}:getIamPolicy`);
    const bindings = policyResponse.data.bindings ?? [];
    const publisherBinding = bindings.find(binding => binding.role === "roles/pubsub.publisher");
    const member = `serviceAccount:${GmailServiceAccount.PUBLISHER}`;
    if (publisherBinding?.members?.includes(member)) {
      return {step: stepLabel, status: ProvisioningStepStatus.SKIPPED, detail: "Service account already has Publisher role on topic"};
    }
    const nextBindings = publisherBinding
      ? bindings.map(binding => binding === publisherBinding ? {...binding, members: [...(binding.members ?? []), member]} : binding)
      : [...bindings, {role: "roles/pubsub.publisher", members: [member]}];
    await googleApiRequest(auth, `${PUBSUB_ROOT}/${topicFullName}:setIamPolicy`, "POST", {policy: {bindings: nextBindings, etag: policyResponse.data.etag}});
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "Publisher role granted on topic"};
  } catch (error) {
    return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (error as Error).message};
  }
}

async function ensurePushSubscription(auth: OAuth2Client, subscriptionFullName: string, topicFullName: string, pushReceiverUrl: string): Promise<ProvisioningStep> {
  const stepLabel = `Pub/Sub push subscription ${subscriptionFullName}`;
  try {
    const existing = await googleApiRequest<{pushConfig?: {pushEndpoint?: string}}>(auth, `${PUBSUB_ROOT}/${subscriptionFullName}`);
    const currentEndpoint = existing.data.pushConfig?.pushEndpoint ?? "";
    if (currentEndpoint === pushReceiverUrl) {
      return {step: stepLabel, status: ProvisioningStepStatus.SKIPPED, detail: "Subscription already points at the NGX push receiver"};
    }
    await googleApiRequest(auth, `${PUBSUB_ROOT}/${subscriptionFullName}:modifyPushConfig`, "POST", {pushConfig: {pushEndpoint: pushReceiverUrl}});
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "Subscription push endpoint updated"};
  } catch (getError) {
    const status = httpStatusOf(getError);
    if (status && status !== 404) {
      return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (getError as Error).message};
    }
  }
  try {
    await googleApiRequest(auth, `${PUBSUB_ROOT}/${subscriptionFullName}`, "PUT", {topic: topicFullName, pushConfig: {pushEndpoint: pushReceiverUrl}, ackDeadlineSeconds: 30});
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "Subscription created and pointed at the NGX push receiver"};
  } catch (createError) {
    return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (createError as Error).message};
  }
}
