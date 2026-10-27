import { dateTimeNow } from "../shared/dates";
import { MAIL_CLIENT_MAX_SENDS_PER_HOUR } from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";
import { mailClientSubmission } from "../mongo/models/mail-client-submission";

export async function mailClientSendAllowed(memberId: string): Promise<boolean> {
  const windowStart = dateTimeNow().toMillis() - 60 * 60 * 1000;
  const previous = await mailClientSubmission.countDocuments({memberId, createdAt: {$gte: windowStart}});
  return previous < MAIL_CLIENT_MAX_SENDS_PER_HOUR;
}
