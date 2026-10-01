import { InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { isInboxThreadMongoId } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";

export async function inboxThreadByIdOrSlug(tenantSlug: string, idOrSlug: string, roleTypes: string[], includeJunk: boolean, roleType: string | null = null): Promise<InboxThread | null> {
  const roleFilter = {roleType: {$in: roleType ? roleTypes.filter(allowed => allowed === roleType) : roleTypes}};
  const visibilityFilter = includeJunk && !roleType ? {$or: [roleFilter, {folder: InboxThreadFolder.JUNK}]} : roleFilter;
  const found = {thread: null as InboxThread | null};
  if (isInboxThreadMongoId(idOrSlug)) {
    found.thread = await inboxThreadModel.findOne({_id: idOrSlug, tenantSlug}).lean() as InboxThread | null;
  }
  if (!found.thread && idOrSlug) {
    found.thread = await inboxThreadModel.findOne({tenantSlug, ...visibilityFilter, slug: idOrSlug}).sort({lastSeenAt: -1}).lean() as InboxThread | null;
  }
  if (!found.thread && idOrSlug) {
    found.thread = await inboxThreadModel.findOne({
      tenantSlug,
      ...visibilityFilter,
      normalisedSubject: idOrSlug.replace(/-/g, " ")
    }).sort({lastSeenAt: -1}).lean() as InboxThread | null;
  }
  return found.thread;
}
