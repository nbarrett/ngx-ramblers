import { Db, MongoClient, ObjectId } from "mongodb";
import { BrevoDomainDnsRecords, MailConfig, MailSubscription, NotificationConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { CommitteeConfig } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  MoveBrevoListPlan,
  MoveBrevoMemberRef,
  MoveBrevoSenderPlan,
  MoveBrevoStatus
} from "../../../../projects/ngx-ramblers/src/app/models/move-brevo.model";

export interface MoveBrevoNamedItem {
  id: number;
  name: string;
}

export interface MoveBrevoDomainOutcome {
  authenticated: boolean;
  authenticationRequested: boolean;
  dnsRecords: BrevoDomainDnsRecords | null;
  message: string;
}

export interface MoveBrevoWebhookOutcome {
  registered: boolean;
  reused: boolean;
}

export interface MoveBrevoDestination {
  ensureDomain(name: string): Promise<MoveBrevoDomainOutcome>;
  createSender(name: string, email: string): Promise<void>;
  folders(): Promise<MoveBrevoNamedItem[]>;
  lists(): Promise<MoveBrevoNamedItem[]>;
  createFolder(name: string): Promise<number>;
  createList(name: string, folderId: number): Promise<number>;
  createContact(email: string, firstName: string, lastName: string, listIds: number[]): Promise<number | null>;
  contactIdByEmail(email: string): Promise<number>;
  addContactToLists(contactId: number, listIds: number[]): Promise<void>;
  webhookUrls(): Promise<string[]>;
  createWebhook(url: string): Promise<void>;
}

export interface MoveBrevoMemberUpdate {
  memberId: string;
  email: string;
  mailId: number;
  subscriptions: MailSubscription[];
}

export interface MoveBrevoNotificationUpdate {
  notificationId: string;
  defaultListId: number;
}

export interface MoveBrevoPersist {
  updateMember(update: MoveBrevoMemberUpdate): Promise<void>;
  updateNotificationList(update: MoveBrevoNotificationUpdate): Promise<void>;
  updateMailConfig(apiKey: string, listSettings: MailConfig["listSettings"]): Promise<void>;
}

export interface MoveBrevoContactableMembers {
  contactable: (Member & { _id: ObjectId })[];
  skippedDoNotEmail: number;
}

export interface MoveBrevoPropagationInput {
  destination: MoveBrevoDestination;
  persist: MoveBrevoPersist;
  destinationApiKey: string;
  domain: string;
  senders: MoveBrevoSenderPlan[];
  lists: MoveBrevoListPlan[];
  members: (Member & { _id: ObjectId })[];
  notifications: (NotificationConfig & { _id: ObjectId })[];
  webhookUrl: string;
  originalListSettings: MailConfig["listSettings"];
}

export interface MoveBrevoPropagation {
  status: MoveBrevoStatus;
  lists: MoveBrevoListPlan[];
  membersUpdated: MoveBrevoMemberRef[];
  contactCount: number;
  skippedDoNotEmail: number;
  webhook: MoveBrevoWebhookOutcome;
  dnsRecords: BrevoDomainDnsRecords | null;
  message: string | null;
  error: string | null;
}

export interface MoveBrevoSite {
  mail: MailConfig;
  committee: CommitteeConfig;
  system: SystemConfig;
  notifications: (NotificationConfig & { _id: ObjectId })[];
  members: (Member & { _id: ObjectId })[];
  db: Db;
  client: MongoClient;
}
