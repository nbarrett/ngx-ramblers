import {InboxAliasConfig, InboxMessage} from "./inbox.model";
import {SendSmtpEmailRequest} from "./mail.model";

export enum MailClientSubmissionStatus {
  PREPARING = "preparing",
  FAILED = "failed",
  SENDING = "sending",
  UNCERTAIN = "uncertain",
  DELIVERED = "delivered",
  RECORDING = "recording",
  COMPLETED = "completed"
}

export interface MailClientSubmission {
  id: string;
  memberId: string;
  messageId: string;
  payloadHash: string;
  status: MailClientSubmissionStatus;
  createdAt: number;
  updatedAt: number;
  providerKey: string;
  request?: SendSmtpEmailRequest;
  alias?: InboxAliasConfig;
  outbound?: InboxMessage;
  internalEmails?: string[];
  error?: string | null;
}
