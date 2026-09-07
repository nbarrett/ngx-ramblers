import { values } from "es-toolkit/compat";
import { SecretQueryParameter } from "../../../projects/ngx-ramblers/src/app/models/server-models";

const MASKED_VALUE = "***";
const SECRET_QUERY_PARAMETER_PATTERN = new RegExp(`([?&](?:${values(SecretQueryParameter).join("|")})=)[^&#]*`, "gi");

export function maskSecretQueryParameters(text: string): string {
  return text ? text.replace(SECRET_QUERY_PARAMETER_PATTERN, `$1${MASKED_VALUE}`) : text;
}

export function maskedApiRequest<T extends Record<string, any>>(apiRequest: T): T {
  const path: string = apiRequest?.path;
  return path ? {...apiRequest, path: maskSecretQueryParameters(path)} : apiRequest;
}
