import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { member } from "../mongo/models/member";
import { configuredSalesforce } from "./salesforce-config";

function missingAudiencePermission(sender: Member, recipients: Member[]): string | null {
  if (recipients.some(recipient => recipient.salesforceTeamStatus === "Member" || recipient.salesforceTeamStatus === "Affiliated")
    && sender.canEmailMembers !== true) {
    return "Ramblers has not granted permission to email members";
  } else if (recipients.some(recipient => recipient.salesforceTeamStatus === "Volunteer")
    && sender.canEmailVolunteers !== true) {
    return "Ramblers has not granted permission to email volunteers";
  } else if (recipients.some(recipient => recipient.salesforceTeamStatus === "Wellbeing Walker")
    && sender.canEmailWellbeingWalkers !== true) {
    return "Ramblers has not granted permission to email Wellbeing Walkers";
  }
  return null;
}

export function protectedEmailPermissionError(sender: Member | null, recipients: Member[]): string | null {
  const protectedRecipients = recipients.filter(recipient => !!recipient.salesforceMemberRef);
  if (protectedRecipients.length === 0) {
    return null;
  } else if (!sender?.salesforceMemberRef) {
    return "The signed-in account is not matched to a Ramblers supporter record";
  } else if (sender.canViewMemberData !== true) {
    return "Ramblers has not granted permission to view supporter data";
  }
  return missingAudiencePermission(sender, protectedRecipients);
}

export async function protectedEmailSendError(senderId: string | null, recipientIds: string[]): Promise<string | null> {
  const salesforceConfig = await configuredSalesforce();
  if (!salesforceConfig?.enabled || recipientIds.length === 0) {
    return null;
  }
  const [sender, recipients] = await Promise.all([
    senderId ? member.findById(senderId).lean().exec() as Promise<Member | null> : Promise.resolve(null),
    member.find({ _id: { $in: recipientIds } }).lean().exec() as Promise<Member[]>,
  ]);
  return protectedEmailPermissionError(sender, recipients);
}
