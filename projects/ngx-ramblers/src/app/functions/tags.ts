import { kebabCase, max } from "es-toolkit/compat";
import { Tag } from "../models/tag.model";
import { sortBy } from "./arrays";

export function nextTagKey(tags: Tag[]): number {
  const maxKey = max((tags || []).map(item => item.key));
  return (isNaN(maxKey) ? 0 : maxKey) + 1;
}

export function tagsSorted<T extends Tag>(tags: T[]): T[] {
  return tags ? [...tags].sort(sortBy("sortIndex", "subject")) : [];
}

export function findTag<T extends Tag>(tags: T[], value: number | string | null | undefined): T | undefined {
  if (value == null) {
    return undefined;
  }
  return (tags || []).find(item => item.key === +value || kebabCase(item.subject) === kebabCase(String(value)));
}

export function addTag<T extends Tag>(tags: T[], subject: string, factory: (key: number, subject: string) => T): T {
  const existing = (tags || []).find(item => item.subject?.toLowerCase() === subject?.toLowerCase());
  if (existing) {
    return existing;
  }
  const newTag = factory(nextTagKey(tags), subject);
  tags.push(newTag);
  return newTag;
}
