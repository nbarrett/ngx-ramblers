import debug from "debug";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("inbox-google-setup"));
debugLog.enabled = true;

export const GOOGLE_CLOUD_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform"
];

export const GMAIL_PUBLISHER_SERVICE_ACCOUNT = "gmail-api-push@system.gserviceaccount.com";

export interface GoogleCloudProvisioningOptions {
  projectId: string;
  topicName: string;
  subscriptionName?: string;
  pushReceiverUrl: string;
}

export enum ProvisioningStepStatus {
  OK = "ok",
  SKIPPED = "skipped",
  FAILED = "failed"
}

export interface ProvisioningStep {
  step: string;
  status: ProvisioningStepStatus;
  detail: string;
}

export interface GoogleCloudProvisioningResult {
  projectId: string;
  topicFullName: string;
  subscriptionFullName: string;
  pushReceiverUrl: string;
  steps: ProvisioningStep[];
}

function bootstrapClient(accessToken: string): OAuth2Client {
  const client = new google.auth.OAuth2();
  client.setCredentials({access_token: accessToken});
  return client;
}

function shortSubscriptionName(topicName: string): string {
  return `${topicName}-push`;
}

export async function runGoogleCloudProvisioning(accessToken: string, options: GoogleCloudProvisioningOptions): Promise<GoogleCloudProvisioningResult> {
  const auth = bootstrapClient(accessToken);
  const subscriptionName = options.subscriptionName?.trim() || shortSubscriptionName(options.topicName);
  const topicFullName = `projects/${options.projectId}/topics/${options.topicName}`;
  const subscriptionFullName = `projects/${options.projectId}/subscriptions/${subscriptionName}`;
  const steps: ProvisioningStep[] = [];

  steps.push(await enableApi(auth, options.projectId, "gmail.googleapis.com"));
  steps.push(await enableApi(auth, options.projectId, "pubsub.googleapis.com"));
  steps.push(await ensureTopic(auth, topicFullName));
  steps.push(await grantTopicPublisher(auth, topicFullName));
  steps.push(await ensurePushSubscription(auth, subscriptionFullName, topicFullName, options.pushReceiverUrl));

  return {projectId: options.projectId, topicFullName, subscriptionFullName, pushReceiverUrl: options.pushReceiverUrl, steps};
}

async function enableApi(auth: OAuth2Client, projectId: string, serviceName: string): Promise<ProvisioningStep> {
  const stepLabel = `Enable ${serviceName}`;
  try {
    const serviceUsage = google.serviceusage({version: "v1", auth});
    const existing = await serviceUsage.services.get({name: `projects/${projectId}/services/${serviceName}`});
    if (existing.data.state === "ENABLED") {
      return {step: stepLabel, status: ProvisioningStepStatus.SKIPPED, detail: "API was already enabled"};
    }
    const operation = await serviceUsage.services.enable({name: `projects/${projectId}/services/${serviceName}`});
    debugLog(`${stepLabel}: enable started`, operation.data.name ?? "");
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "API enabled"};
  } catch (error) {
    return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (error as Error).message};
  }
}

async function ensureTopic(auth: OAuth2Client, topicFullName: string): Promise<ProvisioningStep> {
  const stepLabel = `Pub/Sub topic ${topicFullName}`;
  const pubsub = google.pubsub({version: "v1", auth});
  try {
    await pubsub.projects.topics.get({topic: topicFullName});
    return {step: stepLabel, status: ProvisioningStepStatus.SKIPPED, detail: "Topic already exists"};
  } catch (getError: any) {
    if (getError?.response?.status && getError.response.status !== 404 && getError.code !== 404) {
      return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: getError.message};
    }
  }
  try {
    await pubsub.projects.topics.create({name: topicFullName, requestBody: {}});
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "Topic created"};
  } catch (createError) {
    return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (createError as Error).message};
  }
}

async function grantTopicPublisher(auth: OAuth2Client, topicFullName: string): Promise<ProvisioningStep> {
  const stepLabel = `Grant Pub/Sub Publisher to ${GMAIL_PUBLISHER_SERVICE_ACCOUNT}`;
  const pubsub = google.pubsub({version: "v1", auth});
  try {
    const policyResponse = await pubsub.projects.topics.getIamPolicy({resource: topicFullName});
    const bindings = policyResponse.data.bindings ?? [];
    const publisherBinding = bindings.find(binding => binding.role === "roles/pubsub.publisher");
    const member = `serviceAccount:${GMAIL_PUBLISHER_SERVICE_ACCOUNT}`;
    if (publisherBinding?.members?.includes(member)) {
      return {step: stepLabel, status: ProvisioningStepStatus.SKIPPED, detail: "Service account already has Publisher role on topic"};
    }
    const nextBindings = publisherBinding
      ? bindings.map(binding => binding === publisherBinding ? {...binding, members: [...(binding.members ?? []), member]} : binding)
      : [...bindings, {role: "roles/pubsub.publisher", members: [member]}];
    await pubsub.projects.topics.setIamPolicy({resource: topicFullName, requestBody: {policy: {bindings: nextBindings, etag: policyResponse.data.etag}}});
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "Publisher role granted on topic"};
  } catch (error) {
    return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (error as Error).message};
  }
}

async function ensurePushSubscription(auth: OAuth2Client, subscriptionFullName: string, topicFullName: string, pushReceiverUrl: string): Promise<ProvisioningStep> {
  const stepLabel = `Pub/Sub push subscription ${subscriptionFullName}`;
  const pubsub = google.pubsub({version: "v1", auth});
  try {
    const existing = await pubsub.projects.subscriptions.get({subscription: subscriptionFullName});
    const currentEndpoint = existing.data.pushConfig?.pushEndpoint ?? "";
    if (currentEndpoint === pushReceiverUrl) {
      return {step: stepLabel, status: ProvisioningStepStatus.SKIPPED, detail: "Subscription already points at the NGX push receiver"};
    }
    await pubsub.projects.subscriptions.modifyPushConfig({subscription: subscriptionFullName, requestBody: {pushConfig: {pushEndpoint: pushReceiverUrl}}});
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "Subscription push endpoint updated"};
  } catch (getError: any) {
    if (getError?.response?.status && getError.response.status !== 404 && getError.code !== 404) {
      return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: getError.message};
    }
  }
  try {
    await pubsub.projects.subscriptions.create({
      name: subscriptionFullName,
      requestBody: {
        topic: topicFullName,
        pushConfig: {pushEndpoint: pushReceiverUrl},
        ackDeadlineSeconds: 30
      }
    });
    return {step: stepLabel, status: ProvisioningStepStatus.OK, detail: "Subscription created and pointed at the NGX push receiver"};
  } catch (createError) {
    return {step: stepLabel, status: ProvisioningStepStatus.FAILED, detail: (createError as Error).message};
  }
}
