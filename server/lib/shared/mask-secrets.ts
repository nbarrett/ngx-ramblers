import { values } from "es-toolkit/compat";
import { OAuthWireParameter } from "../../../projects/ngx-ramblers/src/app/models/server-models";

const MASKED_VALUE = "***";
const SECRET_QUERY_PARAMETER_PATTERN = new RegExp(`([?&](?:${values(OAuthWireParameter).join("|")})=)[^&#]*`, "gi");

export function maskOAuthWireParameters(text: string): string {
  return text ? text.replace(SECRET_QUERY_PARAMETER_PATTERN, `$1${MASKED_VALUE}`) : text;
}

export function maskedApiRequest<T extends Record<string, any>>(apiRequest: T): T {
  const path: string = apiRequest?.path;
  return path ? {...apiRequest, path: maskOAuthWireParameters(path)} : apiRequest;
}
