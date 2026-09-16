import { Brevo, BrevoClient } from "@getbrevo/brevo";
import { scheduleBrevo } from "../common/rate-limiting";

const LIST_PAGE_LIMIT = 50;

export async function fetchAllLists(client: BrevoClient, offset = 0, accumulated: Brevo.GetListsResponse.Lists.Item[] = []): Promise<Brevo.GetListsResponse.Lists.Item[]> {
  const response = await scheduleBrevo(() => client.contacts.getLists({limit: LIST_PAGE_LIMIT, offset}));
  const lists = response?.lists ?? [];
  const combined = accumulated.concat(lists);
  return lists.length < LIST_PAGE_LIMIT ? combined : fetchAllLists(client, offset + LIST_PAGE_LIMIT, combined);
}

export async function fetchAllFolders(client: BrevoClient, offset = 0, accumulated: Brevo.GetFolder[] = []): Promise<Brevo.GetFolder[]> {
  const response = await scheduleBrevo(() => client.contacts.getFolders({limit: LIST_PAGE_LIMIT, offset}));
  const folders = response?.folders ?? [];
  const combined = accumulated.concat(folders);
  return folders.length < LIST_PAGE_LIMIT ? combined : fetchAllFolders(client, offset + LIST_PAGE_LIMIT, combined);
}

export async function fetchExistingListIds(client: BrevoClient): Promise<Set<number>> {
  const lists = await fetchAllLists(client);
  return new Set(lists.map(list => list.id));
}

export function filterToExistingListIds(listIds: number[], existingListIds: Set<number>): { valid: number[]; missing: number[] } {
  const ids = listIds ?? [];
  return {
    valid: ids.filter(id => existingListIds.has(id)),
    missing: ids.filter(id => !existingListIds.has(id))
  };
}
