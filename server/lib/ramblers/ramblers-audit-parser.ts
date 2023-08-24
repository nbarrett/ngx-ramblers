import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { some, isEmpty, isUndefined, includes } from "lodash";

const errorIcons = ["⨯", "✗"];
const successIcons = ["✓"];
const ansiTokens = ["\x1B[32m", "\x1B[39m", "[31m", "[39m", "[31m"];
const npmErrorTokens = ["ERR!", "Error:", "failed"];
const logNamespace: string = "ramblers:ramblers-audit-parser";
const debugLog = debug(envConfig.logNamespace(logNamespace));
debugLog.enabled = false;

export function anyMatch(value: string, tokens: string[]) {
  return some(tokens, (token => value.includes(token)));
}

export function trimTokensFrom(input: string, tokens: string[]) {
  debug("trimTokensFrom:input:", input, "tokens:", tokens);
  let returnValue = input.trim();
  tokens.forEach(token => {
    returnValue = returnValue.replace(token, "").trim();
    debug("trimTokensFrom:token:", token, "returnValue:", returnValue);
  });
  debug("trimTokensFrom:returnValue:", returnValue.trim());
  return returnValue.trim();
}

export function extractMessage(auditMessage): string {
  return trimTokensFrom(auditMessage, successIcons.concat(errorIcons).concat(ansiTokens));
}

export function toStatusFromNpmMessage(auditMessageItem: string): string {
  return anyMatch(auditMessageItem, npmErrorTokens) ? "error" : "info";
}

export function toStatusFromIcon(auditMessageItem: string): string {
  if (anyMatch(auditMessageItem, successIcons)) {
    return "success";
  } else if (anyMatch(auditMessageItem, errorIcons)) {
    return "error";
  } else {
    return "info";
  }
}

export function parseStandardOut(auditMessage: string) {
  debug("parseStandardOut:auditMessage:", auditMessage);
  return auditMessage.split(") ").map(auditMessageItem => {
    debug("parseStandardOut:auditMessageItem:", auditMessageItem);
    if (auditMessageItem === "\n"
      || isEmpty(auditMessageItem)
      || isUndefined(auditMessageItem)
      || auditMessageItem.length <= 2
      || anyMatch(auditMessageItem, [envConfig.logNamespace(logNamespace), "SceneTagged", "ActivityStarts"])) {
      return {audit: false};
    } else if (auditMessageItem.includes("ActivityFinished: ")) {
      const messageAndResult = auditMessageItem.split("ActivityFinished: ")[1].split("1");
      const status = messageAndResult[1].replace(")", "").toLowerCase().split("\n")[0].trim();
      const message = messageAndResult[0].trim();
      return {
        audit: true,
        type: "step",
        status,
        message
      };
    } else if (anyMatch(auditMessage, successIcons.concat(errorIcons))) {
      return {
        audit: true,
        type: "step",
        status: toStatusFromIcon(auditMessage),
        message: extractMessage(auditMessage)
      };
    } else {
      return {
        audit: true,
        type: "step",
        status: toStatusFromNpmMessage(auditMessageItem),
        message: extractMessage(auditMessageItem)
      };
    }
  });
}

export function parseStandardError(auditMessage: string) {
  debug("parseStandardError:auditMessage", auditMessage);
  if (isEmpty(auditMessage)
    || auditMessage.includes(envConfig.logNamespace(logNamespace))
    || includes(["\n", "", "npm"], auditMessage.trim())) {
    return [{
      audit: false
    }];
  } else {
    if (anyMatch(auditMessage, errorIcons)) {
      return [{
        audit: true,
        type: "stderr",
        status: "error",
        message: extractMessage(auditMessage)
      }];
    } else if (auditMessage.includes("ActivityFinished: ")) {
      const messageAndResult = auditMessage.split("ActivityFinished: ")[1].split(" (result: ");
      const status = messageAndResult[1].replace(")", "").toLowerCase().split("\n")[0].trim();
      const message = extractMessage(messageAndResult[0]);
      debug("messageAndResult ->", messageAndResult, "status ->", status, "message ->", message);
      return [{
        audit: true,
        type: "step",
        status,
        message
      }];
    } else {
      return [{
        audit: true,
        type: "stderr",
        status: "info",
        message: extractMessage(auditMessage)
      }];
    }
  }
}

export function parseExit(auditMessage: string) {
  debug("parseExit:auditMessage", auditMessage);
  return [{
    audit: true,
    type: "step",
    status: "complete",
    message: extractMessage(auditMessage)
  }];
}
