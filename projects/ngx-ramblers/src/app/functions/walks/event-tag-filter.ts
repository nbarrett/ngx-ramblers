import { EventField } from "../../models/walk.model";

export function tagCriteriaClauses(tagsAny?: number[], tagsExclude?: number[]): any[] {
  const clauses: any[] = [];
  if (tagsAny?.length) clauses.push({[EventField.TAGS]: {$in: tagsAny}});
  if (tagsExclude?.length) clauses.push({[EventField.TAGS]: {$nin: tagsExclude}});
  return clauses;
}

export function eventMatchesTagCriteria(eventTags: number[] | undefined, tagsAny?: number[], tagsExclude?: number[]): boolean {
  if (tagsAny?.length) {
    if (!eventTags?.length) return false;
    if (!eventTags.some(tag => tagsAny.includes(tag))) return false;
  }
  if (tagsExclude?.length && eventTags?.length) {
    if (eventTags.some(tag => tagsExclude.includes(tag))) return false;
  }
  return true;
}
