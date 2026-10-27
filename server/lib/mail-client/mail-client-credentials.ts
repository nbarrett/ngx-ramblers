import { randomBytes } from "crypto";
import { compareValue, hashValue } from "../auth/auth-config";
import { dateTimeNow } from "../shared/dates";
import { mailClientCredential as mailClientCredentialModel } from "../mongo/models/mail-client-credential";
import { MailClientCredential, MailClientCredentialCreated, MailClientCredentialView } from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { member as memberModel } from "../mongo/models/member";
import { isString } from "es-toolkit/compat";
import * as transforms from "../mongo/controllers/transforms";
import * as config from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, committeeRoleMatchingEmail, roleRecipientMemberIds } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { assignedMemberId } from "../../../projects/ngx-ramblers/src/app/functions/committee-members";

const SECRET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SECRET_GROUPS = 4;
const SECRET_GROUP_LENGTH = 4;

export function normaliseMailClientSecret(secret: string): string {
  return (secret || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function generateMailClientSecret(): string {
  const bytes = randomBytes(SECRET_GROUPS * SECRET_GROUP_LENGTH);
  const chars = Array.from(bytes).map(byte => SECRET_ALPHABET[byte % SECRET_ALPHABET.length]);
  return Array.from({length: SECRET_GROUPS}, (_unused, group) => chars.slice(group * SECRET_GROUP_LENGTH, (group + 1) * SECRET_GROUP_LENGTH).join("")).join("-");
}

export function credentialView(credential: MailClientCredential): MailClientCredentialView {
  return {
    id: credential.id ?? (credential as unknown as {_id: {toString(): string}})._id?.toString() ?? "",
    label: credential.label,
    createdAt: credential.createdAt,
    lastUsedAt: credential.lastUsedAt ?? null
  };
}

export async function listActiveCredentials(memberId: string): Promise<MailClientCredentialView[]> {
  const documents = await mailClientCredentialModel.find({memberId, revokedAt: null}).sort({createdAt: -1}).lean() as MailClientCredential[];
  return documents.map(document => credentialView({...document, id: (document as unknown as {_id: {toString(): string}})._id?.toString()}));
}

export async function createCredential(memberId: string, label: string | null): Promise<MailClientCredentialCreated> {
  const secret = generateMailClientSecret();
  const createdAt = dateTimeNow().toMillis();
  const document = await mailClientCredentialModel.create({
    memberId,
    label: (label || "").trim() || "Mail application",
    secretHash: await hashValue(normaliseMailClientSecret(secret)),
    createdAt,
    lastUsedAt: null,
    revokedAt: null
  });
  return {credential: credentialView(transforms.toObjectWithId(document)), secret};
}

export async function revokeCredential(memberId: string, credentialId: string): Promise<boolean> {
  const result = await mailClientCredentialModel.updateOne(
    {_id: credentialId, memberId, revokedAt: null},
    {$set: {revokedAt: dateTimeNow().toMillis()}}
  );
  return result.modifiedCount > 0;
}

export async function authenticateMailClient(username: string, secret: string): Promise<Member | null> {
  const wantedSecret = normaliseMailClientSecret(secret);
  if (!username?.trim() || !wantedSecret) {
    return null;
  } else {
    const members = await membersForUsername(username);
    const authenticated = await members.reduce<Promise<Member | null>>(async (previous, memberRecord) => {
      const already = await previous;
      if (already || !memberRecord.id) {
        return already;
      } else {
        const credentials = await mailClientCredentialModel.find({memberId: memberRecord.id, revokedAt: null}).lean() as MailClientCredential[];
        const matches = await Promise.all(credentials.map(async credential => ({
          credential,
          ok: await compareValue(wantedSecret, credential.secretHash)
        })));
        const matched = matches.find(entry => entry.ok)?.credential ?? null;
        if (!matched) {
          return null;
        } else {
          await mailClientCredentialModel.updateOne({_id: matched.id ?? (matched as unknown as {_id: unknown})._id}, {$set: {lastUsedAt: dateTimeNow().toMillis()}});
          return memberRecord;
        }
      }
    }, Promise.resolve(null));
    return authenticated;
  }
}

async function membersForUsername(username: string): Promise<Member[]> {
  const trimmed = username.trim();
  const lowered = trimmed.toLowerCase();
  const byLogin = await memberModel.findOne({
    $or: [
      {userName: trimmed},
      {userName: lowered},
      {email: lowered}
    ]
  }).lean();
  if (byLogin) {
    return [transforms.toObjectWithId(byLogin) as Member];
  } else {
    const committeeConfig = (await config.queryKey(ConfigKey.COMMITTEE))?.value as CommitteeConfig | null;
    const role = committeeRoleMatchingEmail(committeeConfig?.roles ?? [], lowered);
    const primaryId = role ? assignedMemberId(role.memberId) : null;
    const memberIds = role ? Array.from(new Set(roleRecipientMemberIds(role).concat(primaryId ? [primaryId] : []))) : [];
    if (memberIds.length === 0) {
      return [];
    } else {
      const documents = await memberModel.find({_id: {$in: memberIds}}).lean();
      return documents.map(document => transforms.toObjectWithId(document) as Member);
    }
  }
}

export function isMailClientUsername(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}
