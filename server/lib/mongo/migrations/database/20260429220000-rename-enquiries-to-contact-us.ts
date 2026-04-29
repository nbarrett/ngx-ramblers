import { Db } from "mongodb";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";
import { configuredBrevo } from "../../../brevo/brevo-config";

const debugLog = createMigrationLogger("rename-enquiries-to-contact-us");
const COMMITTEE_CONFIG_KEY = "committee";
const OLD_TYPE = "enquiries";
const NEW_TYPE = "contact-us";
const OLD_LABEL = "Enquiries";
const NEW_LABEL = "Contact Us";
const CONTACT_US_BUILT_IN_ROLE = "CONTACT_US";

function nameAndDescriptionFrom(description: string, fullName: string): string {
  const desc = (description || "").trim();
  const name = (fullName || "").trim();
  if (desc && name && desc.toLowerCase() !== name.toLowerCase()) {
    const bracketed = name.startsWith("(") && name.endsWith(")");
    return bracketed ? `${desc} ${name}` : `${desc} (${name})`;
  }
  return desc || name;
}

async function renameBrevoSender(oldEmail: string, newEmail: string, expectedName: string): Promise<void> {
  if (!newEmail || !expectedName) {
    debugLog("renameBrevoSender skipped: missing newEmail or expectedName");
    return;
  }
  try {
    const brevoConfig = await configuredBrevo();
    if (!brevoConfig?.apiKey) {
      debugLog("renameBrevoSender skipped: no Brevo apiKey configured");
      return;
    }
    const sendersApi = new SibApiV3Sdk.SendersApi();
    sendersApi.setApiKey(SibApiV3Sdk.SendersApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: any = await sendersApi.getSenders();
    const senders: any[] = response?.body?.senders || [];
    const newEmailLower = newEmail.toLowerCase();
    const oldEmailLower = (oldEmail || "").toLowerCase();
    const matched = senders.find(s => {
      const candidate = (s.email || "").toLowerCase();
      return candidate === newEmailLower || (oldEmailLower && candidate === oldEmailLower);
    });
    if (!matched) {
      debugLog("renameBrevoSender: no Brevo sender found for email %s or %s", oldEmail, newEmail);
      return;
    }
    if (matched.name === expectedName && (matched.email || "").toLowerCase() === newEmailLower) {
      debugLog("renameBrevoSender: sender %d already named %s with email %s — nothing to do", matched.id, expectedName, newEmail);
      return;
    }
    const opts = new SibApiV3Sdk.UpdateSender();
    opts.name = expectedName;
    opts.email = newEmail;
    await sendersApi.updateSender(matched.id, opts);
    debugLog(
      "renameBrevoSender: updated Brevo sender %d (name %s -> %s, email %s -> %s)",
      matched.id, matched.name, expectedName, matched.email, newEmail
    );
  } catch (error: any) {
    debugLog("renameBrevoSender: failed to update Brevo sender for %s: %s", newEmail, error?.message || error);
  }
}

function rewriteEnquiriesLocalPart(email: string): string {
  if (!email) {
    return email;
  }
  const at = email.indexOf("@");
  if (at <= 0) {
    return email;
  }
  const localPart = email.slice(0, at);
  if (localPart.toLowerCase() !== OLD_TYPE) {
    return email;
  }
  return `${NEW_TYPE}${email.slice(at)}`;
}

export async function up(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: COMMITTEE_CONFIG_KEY});

  if (!committeeConfig?.value?.roles?.length) {
    debugLog("No committee roles found — skipping");
    return;
  }

  const roles: any[] = committeeConfig.value.roles;
  const targetExists = roles.some(role => role.type === NEW_TYPE);
  const legacyExists = roles.some(role => role.type === OLD_TYPE);

  if (!legacyExists && !targetExists) {
    debugLog("Neither type=%s nor type=%s found in committee config — skipping", OLD_TYPE, NEW_TYPE);
    return;
  }

  let renamedCount = 0;
  let backfilledCount = 0;
  let emailRewrittenCount = 0;
  const renameLegacy = legacyExists && !targetExists;
  let oldRoleEmail: string = null;
  const updatedRoles = roles.map(role => {
    let next = role;
    const isLegacyRole = role.type === OLD_TYPE;
    const isContactUsRole = isLegacyRole || role.type === NEW_TYPE;
    if (renameLegacy && isLegacyRole) {
      renamedCount++;
      next = {
        ...next,
        type: NEW_TYPE,
        builtInRoleMapping: next.builtInRoleMapping || CONTACT_US_BUILT_IN_ROLE
      };
      if (next.description === OLD_LABEL) {
        next.description = NEW_LABEL;
      }
      if (next.fullName === OLD_LABEL) {
        next.fullName = NEW_LABEL;
      }
      if (next.nameAndDescription && next.nameAndDescription.includes(OLD_LABEL)) {
        next.nameAndDescription = next.nameAndDescription.split(OLD_LABEL).join(NEW_LABEL);
      }
    }
    if (isContactUsRole && next.email) {
      const rewritten = rewriteEnquiriesLocalPart(next.email);
      if (rewritten !== next.email) {
        emailRewrittenCount++;
        if (!oldRoleEmail) {
          oldRoleEmail = next.email;
        }
        next = {...next, email: rewritten};
      }
    }
    if (next.contactUsTarget === undefined && next.forwardEmailTarget !== undefined) {
      backfilledCount++;
      next = {
        ...next,
        contactUsTarget: next.forwardEmailTarget,
        contactUsCustom: next.forwardEmailCustom,
        contactUsRecipients: next.forwardEmailRecipients ? [...next.forwardEmailRecipients] : undefined
      };
    }
    return next;
  });

  await configCollection.updateOne(
    {key: COMMITTEE_CONFIG_KEY},
    {$set: {"value.roles": updatedRoles}}
  );
  debugLog(
    "Committee roles updated: renamed=%d, backfilledContactUsFromForwardEmail=%d, emailRewritten=%d",
    renamedCount,
    backfilledCount,
    emailRewrittenCount
  );

  const contactUsRole = updatedRoles.find(role => role.type === NEW_TYPE) || null;

  const notificationConfigCollection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const senderUpdate = await notificationConfigCollection.updateMany(
    {senderRole: OLD_TYPE},
    {$set: {senderRole: NEW_TYPE}}
  );
  const replyToUpdate = await notificationConfigCollection.updateMany(
    {replyToRole: OLD_TYPE},
    {$set: {replyToRole: NEW_TYPE}}
  );
  const signOffUpdate = await notificationConfigCollection.updateMany(
    {signOffRoles: OLD_TYPE},
    {$set: {"signOffRoles.$[elem]": NEW_TYPE}},
    {arrayFilters: [{elem: OLD_TYPE}]}
  );
  const bccUpdate = await notificationConfigCollection.updateMany(
    {bccRoles: OLD_TYPE},
    {$set: {"bccRoles.$[elem]": NEW_TYPE}},
    {arrayFilters: [{elem: OLD_TYPE}]}
  );
  debugLog(
    "Updated notification configs: senderRole=%d, replyToRole=%d, signOffRoles=%d, bccRoles=%d",
    senderUpdate.modifiedCount,
    replyToUpdate.modifiedCount,
    signOffUpdate.modifiedCount,
    bccUpdate.modifiedCount
  );

  if (contactUsRole?.email) {
    const expectedName = nameAndDescriptionFrom(contactUsRole.description, contactUsRole.fullName);
    await renameBrevoSender(oldRoleEmail, contactUsRole.email, expectedName);
  } else {
    debugLog("Contact Us role has no email set — skipping Brevo sender rename");
  }
}

export async function down(db: Db) {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: COMMITTEE_CONFIG_KEY});

  if (!committeeConfig?.value?.roles?.length) {
    debugLog("No committee roles found — skipping down");
    return;
  }

  const roles: any[] = committeeConfig.value.roles;
  const oldTargetExists = roles.some(role => role.type === OLD_TYPE);
  if (oldTargetExists) {
    debugLog("A role with type=%s already exists; not reverting", OLD_TYPE);
    return;
  }

  let reverted = 0;
  let revertedRole: any = null;
  const updatedRoles = roles.map(role => {
    if (role.type !== NEW_TYPE) {
      return role;
    }
    reverted++;
    const next = {...role, type: OLD_TYPE};
    if (role.description === NEW_LABEL) {
      next.description = OLD_LABEL;
    }
    if (role.fullName === NEW_LABEL) {
      next.fullName = OLD_LABEL;
    }
    if (role.nameAndDescription && role.nameAndDescription.includes(NEW_LABEL)) {
      next.nameAndDescription = role.nameAndDescription.split(NEW_LABEL).join(OLD_LABEL);
    }
    revertedRole = next;
    return next;
  });

  if (reverted === 0) {
    debugLog("No role with type=%s found in committee config — skipping down", NEW_TYPE);
    return;
  }

  await configCollection.updateOne(
    {key: COMMITTEE_CONFIG_KEY},
    {$set: {"value.roles": updatedRoles}}
  );
  debugLog("Reverted %d Contact Us role(s) back to Enquiries", reverted);

  const notificationConfigCollection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  await notificationConfigCollection.updateMany(
    {senderRole: NEW_TYPE},
    {$set: {senderRole: OLD_TYPE}}
  );
  await notificationConfigCollection.updateMany(
    {replyToRole: NEW_TYPE},
    {$set: {replyToRole: OLD_TYPE}}
  );
  await notificationConfigCollection.updateMany(
    {signOffRoles: NEW_TYPE},
    {$set: {"signOffRoles.$[elem]": OLD_TYPE}},
    {arrayFilters: [{elem: NEW_TYPE}]}
  );
  await notificationConfigCollection.updateMany(
    {bccRoles: NEW_TYPE},
    {$set: {"bccRoles.$[elem]": OLD_TYPE}},
    {arrayFilters: [{elem: NEW_TYPE}]}
  );

  if (revertedRole?.email) {
    const expectedName = nameAndDescriptionFrom(revertedRole.description, revertedRole.fullName);
    await renameBrevoSender(null, revertedRole.email, expectedName);
  }
}
