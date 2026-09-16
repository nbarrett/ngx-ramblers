import debug from "debug";
import { MongoClient, ObjectId } from "mongodb";
import { BrevoClient } from "@getbrevo/brevo";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, CommitteeMember, roleEmailAddresses } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { MailConfig, MailSubscription, NotificationConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  MoveBrevoListPlan,
  MoveBrevoRequest,
  MoveBrevoResult,
  MoveBrevoSenderPlan,
  MoveBrevoStatus
} from "../../../../projects/ngx-ramblers/src/app/models/move-brevo.model";
import { RamblersWalksManagerDateFormat as DateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";
import {
  MoveBrevoContactableMembers,
  MoveBrevoDestination,
  MoveBrevoDomainOutcome,
  MoveBrevoMemberUpdate,
  MoveBrevoNamedItem,
  MoveBrevoNotificationUpdate,
  MoveBrevoPropagation,
  MoveBrevoPropagationInput,
  MoveBrevoSite,
  MoveBrevoWebhookOutcome
} from "./move-brevo.model";
import { envConfig } from "../../env-config/env-config";
import { configuredEnvironments } from "../../environments/environments-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { buildMongoUri } from "../../shared/mongodb-uri";
import { dateTimeNow } from "../../shared/dates";
import { emailDomain } from "../../../../projects/ngx-ramblers/src/app/functions/strings";
import { authenticateSendingDomain } from "../domains/domain-authentication";
import { configuredCloudflare } from "../../cloudflare/cloudflare-config";
import { zoneForHostname } from "../../cloudflare/cloudflare-dns";
import { fetchAllFolders, fetchAllLists } from "../lists/existing-list-ids";

const debugLog = debug(envConfig.logNamespace("brevo:move-brevo"));
debugLog.enabled = true;

const DEFAULT_FOLDER_NAME = "NGX";
const jobs = new Map<string, MoveBrevoResult>();

export function mailSubscriptions(member: Member): MailSubscription[] {
  return member.mail?.subscriptions || [];
}

export function remapSubscriptions(subscriptions: MailSubscription[], listIdMap: Map<number, number>): MailSubscription[] {
  return subscriptions.map(subscription => {
    const remapped = listIdMap.get(subscription.id);
    if (remapped === undefined) {
      return subscription;
    } else {
      return { ...subscription, id: remapped };
    }
  });
}

export function isAlreadyExistsError(error: unknown): boolean {
  const asRecord = error as { statusCode?: number; body?: { message?: string } };
  const status = asRecord.statusCode;
  const message = `${asRecord.body?.message || (error instanceof Error ? error.message : String(error))}`.toLowerCase();
  return status === 400 && (message.includes("already") || message.includes("exist"));
}

export function contactableMembers<T extends Member>(members: T[]): { contactable: T[]; skippedDoNotEmail: number } {
  const withEmail = members.filter(member => !!member.email);
  return {
    contactable: withEmail.filter(member => !member.doNotEmail),
    skippedDoNotEmail: withEmail.filter(member => !!member.doNotEmail).length
  };
}

export function listPlans(lists: MoveBrevoNamedItem[], folderNameById: Map<number, string>, listFolderIdById: Map<number, number>, listSettings: MailConfig["listSettings"], members: Member[]): MoveBrevoListPlan[] {
  const settings = listSettings || [];
  const plans = lists.map(list => {
    const setting = settings.find(item => item.id === list.id);
    const name = setting?.name || list.name || `list-${list.id}`;
    const memberCount = members.filter(member => mailSubscriptions(member).some(sub => sub.id === list.id && sub.subscribed)).length;
    return {
      sourceId: list.id,
      name,
      folderName: folderNameById.get(listFolderIdById.get(list.id)) || "",
      memberCount
    };
  });
  const duplicateNames = plans
    .map(plan => plan.name)
    .filter((name, index, names) => names.indexOf(name) !== index)
    .filter((name, index, names) => names.indexOf(name) === index);
  if (duplicateNames.length > 0) {
    throw new Error(`Lists are matched by name on the destination account, but these names are used more than once on the current Brevo account: ${duplicateNames.join(", ")}. Rename them in Mail Settings before moving.`);
  } else {
    return plans;
  }
}

export function notificationUpdates(notifications: (NotificationConfig & { _id: ObjectId })[], listIdMap: Map<number, number>): MoveBrevoNotificationUpdate[] {
  return notifications
    .filter(notification => listIdMap.has(notification.defaultListId))
    .map(notification => ({
      notificationId: String(notification._id),
      defaultListId: listIdMap.get(notification.defaultListId) as number
    }));
}

export function mergeListSettings(original: MailConfig["listSettings"], lists: MoveBrevoListPlan[]): MailConfig["listSettings"] {
  const source = original || [];
  const merged = source.map(setting => {
    const match = lists.find(list => list.sourceId === setting.id);
    return match?.destinationId
      ? { ...setting, id: match.destinationId, name: setting.name || match.name }
      : setting;
  });
  const used = new Set(merged.map(setting => setting.id));
  const extras = lists
    .filter(list => list.destinationId !== undefined && !used.has(list.destinationId))
    .map(list => ({
      id: list.destinationId as number,
      name: list.name,
      memberSubscribable: false,
      autoSubscribeNewMembers: false,
      requiresMemberEmailMarketingConsent: false
    }));
  return merged.concat(extras);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function brevoClientForKey(apiKey: string): BrevoClient {
  return new BrevoClient({ apiKey });
}

function validatedRequest(request: MoveBrevoRequest): MoveBrevoRequest {
  if (request.confirmEnvironment !== request.environment) {
    throw new Error("Typed environment name does not match the selected environment");
  } else if (!request.destinationApiKey || !request.destinationApiKey.trim()) {
    throw new Error("Destination Brevo API key is required");
  } else {
    return { ...request, destinationApiKey: request.destinationApiKey.trim() };
  }
}

async function mongoUriForEnvironment(environmentName: string): Promise<string> {
  const environments = await configuredEnvironments();
  const environmentConfig = (environments.environments || []).find(item => item.environment === environmentName);
  const mongo = environmentConfig?.mongo;
  if (!mongo?.cluster || !mongo?.db || !mongo?.username || !mongo?.password) {
    throw new Error(`Environment "${environmentName}" has no complete Mongo config`);
  } else {
    return buildMongoUri({
      cluster: mongo.cluster,
      database: mongo.db,
      username: mongo.username,
      password: mongo.password
    });
  }
}

async function loadSite(environmentName: string): Promise<MoveBrevoSite> {
  const uri = await mongoUriForEnvironment(environmentName);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const configDocs = await db.collection("config").find({
    key: { $in: [ConfigKey.BREVO, ConfigKey.COMMITTEE, ConfigKey.SYSTEM] }
  }).toArray();
  const byKey = new Map(configDocs.map(doc => [doc.key, doc.value]));
  const mail = byKey.get(ConfigKey.BREVO) as MailConfig;
  const committee = byKey.get(ConfigKey.COMMITTEE) as CommitteeConfig;
  const system = byKey.get(ConfigKey.SYSTEM) as SystemConfig;
  if (!mail?.apiKey) {
    await client.close();
    throw new Error(`Environment "${environmentName}" has no Brevo API key in config`);
  } else {
    const notifications = await db.collection<NotificationConfig & { _id: ObjectId }>("notificationConfigs").find({}).toArray();
    const members = await db.collection<Member & { _id: ObjectId }>("members").find({}).toArray();
    return { mail, committee, system, notifications, members, db, client };
  }
}

function senderPlans(committee: CommitteeConfig, domain: string): MoveBrevoSenderPlan[] {
  const roles: CommitteeMember[] = committee?.roles || [];
  const seen = new Set<string>();
  return roles.reduce<MoveBrevoSenderPlan[]>((plans, role) => {
    const addresses = roleEmailAddresses(role, domain);
    addresses.forEach(email => {
      const key = email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        plans.push({
          email,
          name: role.fullName || role.description || email
        });
      }
    });
    return plans;
  }, []);
}

function sendingDomain(system: SystemConfig, committee: CommitteeConfig): string {
  const href = system?.group?.href || "";
  const fromHref = href.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  const fromEmail = committee?.roles?.map(role => emailDomain(role.email || "")).find(item => !!item);
  return fromHref || fromEmail || "";
}

async function snapshotLists(sourceClient: BrevoClient, mail: MailConfig, members: Member[]): Promise<MoveBrevoListPlan[]> {
  const lists = await fetchAllLists(sourceClient);
  const folders = await fetchAllFolders(sourceClient);
  const folderNameById = new Map(folders.map(folder => [Number(folder.id), folder.name || ""]));
  const listFolderIdById = new Map(lists.map(list => [list.id, Number(list.folderId)]));
  return listPlans(lists.map(list => ({ id: list.id, name: list.name })), folderNameById, listFolderIdById, mail.listSettings, members);
}

function eventsWebhookUrl(system: SystemConfig, mail: MailConfig): string {
  const secret = mail.brevoEventsWebhookSecret;
  const base = (system?.group?.href || "").replace(/\/+$/, "");
  if (!secret || !base) {
    return "";
  } else {
    return `${base}/api/mail/webhooks/brevo-events?token=${secret}`;
  }
}

async function cloudflareConfiguredFor(domain: string): Promise<boolean> {
  if (!domain) {
    return false;
  } else {
    try {
      const cloudflare = await configuredCloudflare();
      const zone = await zoneForHostname(cloudflare.apiToken, domain);
      return !!zone;
    } catch (error) {
      debugLog("Cloudflare not available for", domain, ":", errorText(error));
      return false;
    }
  }
}

function destinationFromClient(dest: BrevoClient): MoveBrevoDestination {
  return {
    ensureDomain: async name => {
      const result = await authenticateSendingDomain(name, { client: dest, stopWhenCloudflareUnavailable: true });
      return {
        authenticated: result.authenticated,
        authenticationRequested: result.authenticationRequested,
        dnsRecords: result.dnsRecords,
        message: result.message
      };
    },
    createSender: async (name, email) => {
      try {
        await scheduleBrevo(() => dest.senders.createSender({ email, name }));
      } catch (error) {
        if (!isAlreadyExistsError(error)) {
          throw error;
        }
      }
    },
    folders: async () => {
      const folders = await fetchAllFolders(dest);
      return folders.map(folder => ({ id: Number(folder.id), name: folder.name || "" }));
    },
    lists: async () => {
      const lists = await fetchAllLists(dest);
      return lists.map(list => ({ id: list.id, name: list.name }));
    },
    createFolder: async name => {
      const created = await scheduleBrevo(() => dest.contacts.createFolder({ name }));
      return created.id;
    },
    createList: async (name, folderId) => {
      const created = await scheduleBrevo(() => dest.contacts.createList({ name, folderId }));
      return created.id;
    },
    createContact: async (email, firstName, lastName, listIds) => {
      const created = await scheduleBrevo(() => dest.contacts.createContact({
        email,
        attributes: { FIRSTNAME: firstName, LASTNAME: lastName },
        listIds: listIds.length > 0 ? listIds : undefined
      }));
      return created?.id ?? null;
    },
    contactIdByEmail: async email => {
      const info = await scheduleBrevo(() => dest.contacts.getContactInfo({ identifier: email }));
      return Number(info.id);
    },
    addContactToLists: async (contactId, listIds) => {
      await scheduleBrevo(() => dest.contacts.updateContact({ identifier: contactId, listIds }));
    },
    webhookUrls: async () => {
      const response = await scheduleBrevo(() => dest.webhooks.getWebhooks({ type: "transactional" }));
      return (response.webhooks || []).map(webhook => webhook.url);
    },
    createWebhook: async url => {
      await scheduleBrevo(() => dest.webhooks.createWebhook({
        url,
        events: ["unsubscribed", "blocked", "hardBounce", "spam"],
        type: "transactional"
      }));
    }
  };
}

async function ensureDomain(destination: MoveBrevoDestination, domain: string): Promise<MoveBrevoDomainOutcome> {
  if (domain) {
    return destination.ensureDomain(domain);
  } else {
    return { authenticated: true, authenticationRequested: false, dnsRecords: null, message: "" };
  }
}

async function createSenders(destination: MoveBrevoDestination, senders: MoveBrevoSenderPlan[]): Promise<void> {
  await senders.reduce(async (previous, sender) => {
    await previous;
    await destination.createSender(sender.name, sender.email);
  }, Promise.resolve());
}

async function ensureLists(destination: MoveBrevoDestination, lists: MoveBrevoListPlan[]): Promise<MoveBrevoListPlan[]> {
  const folderIdByName = new Map((await destination.folders()).map(folder => [folder.name, folder.id]));
  const listIdByName = new Map((await destination.lists()).map(list => [list.name, list.id]));
  return lists.reduce(async (previous, list) => {
    const done = await previous;
    const folderName = list.folderName || DEFAULT_FOLDER_NAME;
    const knownFolderId = folderIdByName.get(folderName);
    const folderId = knownFolderId === undefined ? await destination.createFolder(folderName) : knownFolderId;
    folderIdByName.set(folderName, folderId);
    const knownListId = listIdByName.get(list.name);
    const destinationId = knownListId === undefined ? await destination.createList(list.name, folderId) : knownListId;
    listIdByName.set(list.name, destinationId);
    return done.concat({ ...list, destinationId, reused: knownListId !== undefined });
  }, Promise.resolve([] as MoveBrevoListPlan[]));
}

async function addToLists(destination: MoveBrevoDestination, contactId: number, listIds: number[]): Promise<number> {
  if (listIds.length > 0) {
    await destination.addContactToLists(contactId, listIds);
  }
  return contactId;
}

async function existingContact(destination: MoveBrevoDestination, email: string, listIds: number[]): Promise<number> {
  const contactId = await destination.contactIdByEmail(email);
  return addToLists(destination, contactId, listIds);
}

async function createOrFindContact(destination: MoveBrevoDestination, member: Member, listIds: number[]): Promise<number> {
  try {
    const created = await destination.createContact(member.email, member.firstName || "", member.lastName || "", listIds);
    return created === null ? existingContact(destination, member.email, listIds) : created;
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return existingContact(destination, member.email, listIds);
    } else {
      throw error;
    }
  }
}

async function contactIdFor(destination: MoveBrevoDestination, contactIdByEmail: Map<string, number>, member: Member, listIds: number[]): Promise<number> {
  const key = member.email.toLowerCase();
  const known = contactIdByEmail.get(key);
  if (known === undefined) {
    const contactId = await createOrFindContact(destination, member, listIds);
    contactIdByEmail.set(key, contactId);
    return contactId;
  } else {
    return addToLists(destination, known, listIds);
  }
}

async function createContacts(destination: MoveBrevoDestination, members: (Member & { _id: ObjectId })[], listIdMap: Map<number, number>): Promise<MoveBrevoMemberUpdate[]> {
  const contactIdByEmail = new Map<string, number>();
  return members.reduce(async (previous, member) => {
    const done = await previous;
    const existingSubs = mailSubscriptions(member);
    const mappedIds = existingSubs
      .filter(sub => sub.subscribed && listIdMap.has(sub.id))
      .map(sub => listIdMap.get(sub.id) as number);
    const mailId = await contactIdFor(destination, contactIdByEmail, member, mappedIds);
    return done.concat({
      memberId: String(member._id),
      email: member.email,
      mailId,
      subscriptions: remapSubscriptions(existingSubs, listIdMap)
    });
  }, Promise.resolve([] as MoveBrevoMemberUpdate[]));
}

async function ensureWebhook(destination: MoveBrevoDestination, url: string): Promise<MoveBrevoWebhookOutcome> {
  if (!url) {
    return { registered: false, reused: false };
  } else if ((await destination.webhookUrls()).includes(url)) {
    return { registered: true, reused: true };
  } else {
    await destination.createWebhook(url);
    return { registered: true, reused: false };
  }
}

async function writeToMongo(input: MoveBrevoPropagationInput, lists: MoveBrevoListPlan[], memberUpdates: MoveBrevoMemberUpdate[], notifications: MoveBrevoNotificationUpdate[], contactable: MoveBrevoContactableMembers, webhook: MoveBrevoWebhookOutcome): Promise<MoveBrevoPropagation> {
  const outcome: MoveBrevoPropagation = {
    status: MoveBrevoStatus.COMPLETED,
    lists,
    membersUpdated: [],
    contactCount: contactable.contactable.length,
    skippedDoNotEmail: contactable.skippedDoNotEmail,
    webhook,
    dnsRecords: null,
    message: null,
    error: null
  };
  try {
    await memberUpdates.reduce(async (previous, update) => {
      await previous;
      await input.persist.updateMember(update);
      outcome.membersUpdated.push({ memberId: update.memberId, email: update.email });
    }, Promise.resolve());
    await notifications.reduce(async (previous, update) => {
      await previous;
      await input.persist.updateNotificationList(update);
    }, Promise.resolve());
    await input.persist.updateMailConfig(input.destinationApiKey, mergeListSettings(input.originalListSettings, lists));
    return outcome;
  } catch (error) {
    return {
      ...outcome,
      status: MoveBrevoStatus.FAILED,
      error: `${errorText(error)}. ${outcome.membersUpdated.length} of ${memberUpdates.length} members were updated to point at the destination account before the failure (listed below); Mail Settings still hold the current API key and list ids.`
    };
  }
}

export async function propagateDestination(input: MoveBrevoPropagationInput): Promise<MoveBrevoPropagation> {
  const contactable = contactableMembers(input.members);
  const domainOutcome = await ensureDomain(input.destination, input.domain);
  if (!domainOutcome.authenticated && !domainOutcome.authenticationRequested) {
    return {
      status: MoveBrevoStatus.DNS_RECORDS_REQUIRED,
      lists: input.lists,
      membersUpdated: [],
      contactCount: contactable.contactable.length,
      skippedDoNotEmail: contactable.skippedDoNotEmail,
      webhook: { registered: false, reused: false },
      dnsRecords: domainOutcome.dnsRecords,
      message: domainOutcome.message,
      error: null
    };
  } else {
    await createSenders(input.destination, input.senders);
    const lists = await ensureLists(input.destination, input.lists);
    const listIdMap = new Map(lists.filter(list => list.destinationId !== undefined).map(list => [list.sourceId, list.destinationId as number]));
    const memberUpdates = await createContacts(input.destination, contactable.contactable, listIdMap);
    const webhook = await ensureWebhook(input.destination, input.webhookUrl);
    const notifications = notificationUpdates(input.notifications, listIdMap);
    return writeToMongo(input, lists, memberUpdates, notifications, contactable, webhook);
  }
}

function persistToSite(site: MoveBrevoSite) {
  return {
    updateMember: async (update: MoveBrevoMemberUpdate) => {
      await site.db.collection("members").updateOne(
        { _id: new ObjectId(update.memberId) },
        { $set: { "mail.id": update.mailId, "mail.subscriptions": update.subscriptions } }
      );
    },
    updateNotificationList: async (update: MoveBrevoNotificationUpdate) => {
      await site.db.collection("notificationConfigs").updateOne(
        { _id: new ObjectId(update.notificationId) },
        { $set: { defaultListId: update.defaultListId } }
      );
    },
    updateMailConfig: async (apiKey: string, listSettings: MailConfig["listSettings"]) => {
      await site.db.collection("config").updateOne(
        { key: ConfigKey.BREVO },
        { $set: { "value.apiKey": apiKey, "value.listSettings": listSettings } }
      );
    }
  };
}

function planSteps(plan: MoveBrevoResult): string[] {
  const domainStep = !plan.domain
    ? "Domain (none)"
    : plan.cloudflareConfigured
      ? `Domain ${plan.domain} (DNS records added through Cloudflare)`
      : `Domain ${plan.domain} (Cloudflare not configured: DNS records will be shown for you to add)`;
  const skipped = plan.skippedDoNotEmail > 0 ? ` (${plan.skippedDoNotEmail} skipped as do not email)` : "";
  return [
    domainStep,
    `${plan.senders.length} senders from Committee Settings`,
    `${plan.lists.length} lists from the current Brevo account`,
    `${plan.contactCount} member contacts${skipped}`,
    plan.webhookConfigured ? "Events webhook registered on the destination account" : "Events webhook not configured (no secret or site URL)"
  ];
}

function completedSteps(plan: MoveBrevoResult, propagation: MoveBrevoPropagation): string[] {
  const reused = propagation.lists.filter(list => list.reused).length;
  const webhookStep = !propagation.webhook.registered
    ? "Events webhook not configured (no secret or site URL)"
    : propagation.webhook.reused
      ? "Events webhook already registered on the destination account"
      : "Events webhook registered on the destination account";
  return [
    plan.domain ? `Domain ${plan.domain} authenticated or authentication requested` : "Domain (none)",
    `${plan.senders.length} senders created or already present`,
    `${propagation.lists.length} lists (${reused} reused, ${propagation.lists.length - reused} created)`,
    `${propagation.contactCount} member contacts created or matched by email${propagation.skippedDoNotEmail > 0 ? ` (${propagation.skippedDoNotEmail} skipped as do not email)` : ""}`,
    webhookStep,
    `${propagation.membersUpdated.length} members updated with new contact and list ids`
  ];
}

function resultFrom(plan: MoveBrevoResult, propagation: MoveBrevoPropagation): MoveBrevoResult {
  const steps = propagation.status === MoveBrevoStatus.DNS_RECORDS_REQUIRED ? plan.steps : completedSteps(plan, propagation);
  return {
    ...plan,
    status: propagation.status,
    lists: propagation.lists,
    membersUpdated: propagation.membersUpdated,
    dnsRecords: propagation.dnsRecords,
    message: propagation.message,
    error: propagation.error,
    steps
  };
}

async function executeAgainst(plan: MoveBrevoResult, site: MoveBrevoSite, destinationApiKey: string, webhookUrl: string): Promise<MoveBrevoResult> {
  try {
    const propagation = await propagateDestination({
      destination: destinationFromClient(brevoClientForKey(destinationApiKey)),
      persist: persistToSite(site),
      destinationApiKey,
      domain: plan.domain,
      senders: plan.senders,
      lists: plan.lists,
      members: site.members,
      notifications: site.notifications,
      webhookUrl,
      originalListSettings: site.mail.listSettings || []
    });
    return resultFrom(plan, propagation);
  } catch (error) {
    debugLog("Move Brevo failed before any Mongo write:", errorText(error));
    return { ...plan, status: MoveBrevoStatus.FAILED, error: `${errorText(error)}. Nothing was changed in the environment database.` };
  }
}

export async function moveBrevo(request: MoveBrevoRequest): Promise<MoveBrevoResult> {
  const validated = validatedRequest(request);
  const site = await loadSite(validated.environment);
  try {
    const domain = sendingDomain(site.system, site.committee);
    const lists = await snapshotLists(brevoClientForKey(site.mail.apiKey), site.mail, site.members);
    const webhookUrl = eventsWebhookUrl(site.system, site.mail);
    const contactable = contactableMembers(site.members);
    const withoutSteps: MoveBrevoResult = {
      jobId: null,
      status: MoveBrevoStatus.PLANNED,
      environment: validated.environment,
      dryRun: validated.dryRun === true,
      domain,
      cloudflareConfigured: await cloudflareConfiguredFor(domain),
      senders: senderPlans(site.committee, domain),
      lists,
      contactCount: contactable.contactable.length,
      skippedDoNotEmail: contactable.skippedDoNotEmail,
      webhookConfigured: !!webhookUrl,
      steps: [],
      membersUpdated: [],
      dnsRecords: null,
      message: null,
      error: null
    };
    const plan = { ...withoutSteps, steps: planSteps(withoutSteps) };
    if (validated.dryRun) {
      return plan;
    } else {
      return executeAgainst(plan, site, validated.destinationApiKey, webhookUrl);
    }
  } finally {
    await site.client.close();
  }
}

export function moveBrevoJob(jobId: string): MoveBrevoResult | null {
  return jobs.get(jobId) || null;
}

function runningJobFor(environment: string): MoveBrevoResult | null {
  return Array.from(jobs.values()).find(job => job.environment === environment && job.status === MoveBrevoStatus.RUNNING) || null;
}

export function startMoveBrevo(request: MoveBrevoRequest): MoveBrevoResult {
  const validated = validatedRequest(request);
  const running = runningJobFor(validated.environment);
  if (running) {
    throw new Error(`Move Brevo is already running for "${validated.environment}" (job ${running.jobId})`);
  } else {
    const jobId = `move-brevo-${dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP)}-${validated.environment}`;
    const started: MoveBrevoResult = {
      jobId,
      status: MoveBrevoStatus.RUNNING,
      environment: validated.environment,
      dryRun: false,
      domain: "",
      cloudflareConfigured: false,
      senders: [],
      lists: [],
      contactCount: 0,
      skippedDoNotEmail: 0,
      webhookConfigured: false,
      steps: ["Move Brevo started"],
      membersUpdated: [],
      dnsRecords: null,
      message: null,
      error: null
    };
    jobs.set(jobId, started);
    moveBrevo({ ...validated, dryRun: false })
      .then(result => jobs.set(jobId, { ...result, jobId }))
      .catch(error => {
        debugLog("Move Brevo job failed:", jobId, errorText(error));
        jobs.set(jobId, { ...started, status: MoveBrevoStatus.FAILED, error: errorText(error) });
      });
    return started;
  }
}
