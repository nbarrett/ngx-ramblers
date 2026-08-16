import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { RequestParameterExtractor } from "./screenplay/tasks/ramblers/common/request-parameter-extractor";

export function resolveSerenityActorName(fallback = "Walks Admin"): string {
  const fromEnv = (process.env[Environment.SERENITY_ACTOR] || "").trim();
  if (fromEnv) {
    return fromEnv;
  } else {
    try {
      return RequestParameterExtractor.extract().ramblersUser?.trim() || fallback;
    } catch {
      return fallback;
    }
  }
}
