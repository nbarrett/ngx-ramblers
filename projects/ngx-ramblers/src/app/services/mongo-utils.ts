import isString from "lodash-es/isString";

export function isMongoId(id: string): boolean {
  return isString(id) && /^[a-fA-F0-9]{24}$/.test(id);
}

export function toMongoId(id: string): string {
  return id;
}

export function toMongoIds(ids: string[]): string[] {
  return ids || [];
}
