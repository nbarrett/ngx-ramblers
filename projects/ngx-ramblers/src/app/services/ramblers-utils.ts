import { isString } from "es-toolkit/compat";

export function isRamblersContactId(id: string): boolean {
  return isString(id) && /^[a-zA-Z0-9]{15,18}$/.test(id);
}
