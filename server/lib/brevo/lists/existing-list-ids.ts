import { scheduleBrevo } from "../common/rate-limiting";

const LIST_PAGE_LIMIT = 50;

export async function fetchExistingListIds(client: any, offset = 0, accumulated: Set<number> = new Set<number>()): Promise<Set<number>> {
  const response: any = await scheduleBrevo(() => client.contacts.getLists({limit: LIST_PAGE_LIMIT, offset}));
  const lists: any[] = response?.lists ?? [];
  lists.forEach(list => accumulated.add(list.id));
  return lists.length < LIST_PAGE_LIMIT ? accumulated : fetchExistingListIds(client, offset + LIST_PAGE_LIMIT, accumulated);
}

export function filterToExistingListIds(listIds: number[], existingListIds: Set<number>): { valid: number[]; missing: number[] } {
  const ids = listIds ?? [];
  return {
    valid: ids.filter(id => existingListIds.has(id)),
    missing: ids.filter(id => !existingListIds.has(id))
  };
}
