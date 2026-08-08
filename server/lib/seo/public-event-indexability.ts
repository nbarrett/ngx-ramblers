import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { WalkStatus } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { lastItemFrom } from "../shared/string-utils";

const NON_INDEXABLE_STATUSES = new Set<string>([
  WalkStatus.CANCELLED,
  WalkStatus.DRAFT,
  "deleted"
]);

const NON_INDEXABLE_TITLE_OR_SLUG = /\bcancelled\b|fully[- ]?booked|fully[- ]?subscribed|we[- ]regret/i;

export function eventHasNonIndexableStatus(status: string): boolean {
  return NON_INDEXABLE_STATUSES.has((status || "").toLowerCase());
}

export function eventHasNonIndexableTitleOrSlug(title: string, slug: string): boolean {
  return NON_INDEXABLE_TITLE_OR_SLUG.test(`${title || ""} ${slug || ""}`);
}

export function eventIsPubliclyIndexable(event: ExtendedGroupEvent): boolean {
  const groupEvent = event?.groupEvent;
  if (!groupEvent?.title) {
    return false;
  } else {
    const status = groupEvent.status || "";
    const slug = lastItemFrom(groupEvent.url) || "";
    if (eventHasNonIndexableStatus(status)) {
      return false;
    } else if (eventHasNonIndexableTitleOrSlug(groupEvent.title, slug)) {
      return false;
    } else {
      return true;
    }
  }
}

export function eventShouldNoindex(event: ExtendedGroupEvent): boolean {
  const groupEvent = event?.groupEvent;
  if (!groupEvent) {
    return false;
  } else {
    const status = (groupEvent.status || "").toLowerCase();
    const slug = lastItemFrom(groupEvent.url) || "";
    if (status === WalkStatus.CANCELLED) {
      return true;
    } else if (eventHasNonIndexableTitleOrSlug(groupEvent.title || "", slug) && /\bcancelled\b|we[- ]regret/i.test(`${groupEvent.title || ""} ${slug}`)) {
      return true;
    } else {
      return false;
    }
  }
}
