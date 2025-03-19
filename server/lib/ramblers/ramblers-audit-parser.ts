import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { includes, isEmpty, isUndefined, some } from "lodash";
import { ParsedRamblersUploadAudit } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { momentNowAsValue } from "../shared/dates";

const errorIcons = ["⨯", "✗", "✖"];
const successIcons = ["✓", "✓", "✓"];
const ansiTokens = ["\u001b[35;1", "\x1B[0m", "\x1B[35;1m", "\x1B[35m", "\x1B[32m", "\x1B[39m", "[31m", "[39m", "[31m"];
const npmErrorTokens = ["ERR!", "Error:", "failed"];
const logNamespace: string = "ramblers:ramblers-audit-parser";
const debugLog = debug(envConfig.logNamespace(logNamespace));
const debugOff = debug(envConfig.logNamespace(logNamespace + "-off"));
debugOff.enabled = false;
debugLog.enabled = false;

export function anyMatch(value: string, tokens: string[]) {
  return some(tokens, (token => value.includes(token)));
}

export function trimTokensFrom(input: string, tokens: string[]) {
  debugOff("trimTokensFrom:input:", input, "tokens:", tokens);
  let returnValue = input.trim();
  tokens.forEach(token => {
    returnValue = returnValue.replace(token, "").trim();
    debugOff("trimTokensFrom:token:", token, "returnValue:", returnValue);
  });
  debugOff("trimTokensFrom:returnValue:", returnValue.trim());
  return returnValue.trim();
}

export function removeTokensFromMessage(auditMessage: string): string {
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

function splitIntoItems(auditMessage: string) {
  return auditMessage.split(/\[serenity-run-[^\]]*]/).map(item => item.trim());
}

export function parseStandardOut(auditMessage: string): ParsedRamblersUploadAudit[] {
  debugLog("parseStandardOut:auditMessage:", auditMessage);
  const auditMessageItems: string[] = splitIntoItems(auditMessage);
  return auditMessageItems.map(auditMessageItem => {
    const messageItemIgnored: boolean = auditMessageItem === "\n"
      || isEmpty(auditMessageItem)
      || isUndefined(auditMessageItem)
      || auditMessageItem.length <= 2
      || anyMatch(auditMessageItem, [envConfig.logNamespace(logNamespace), "SceneTagged", "ActivityStarts"]);
    debugLog("parseStandardOut:auditMessageItem:", auditMessageItems.indexOf(auditMessageItem) + 1, "of", auditMessageItems.length, "messageItemIgnored:", messageItemIgnored, "data:", auditMessageItem);
    if (messageItemIgnored) {
      return {audit: false};
    } else if (auditMessageItem.includes("ActivityFinished: ")) {
      const messageAndResult = auditMessageItem.split("ActivityFinished: ")[1].split("1");
      const status = messageAndResult[1].replace(")", "").toLowerCase().split("\n")[0].trim();
      const message = messageAndResult[0].trim();
      return {
        audit: true,
        auditTime: momentNowAsValue(),
        type: "step",
        status,
        message
      };
    } else if (anyMatch(auditMessageItem, successIcons.concat(errorIcons))) {
      return {
        audit: true,
        auditTime: momentNowAsValue(),
        type: "step",
        status: toStatusFromIcon(auditMessageItem),
        message: removeTokensFromMessage(auditMessageItem)
      };
    } else {
      return {
        audit: true,
        auditTime: momentNowAsValue(),
        type: "step",
        status: toStatusFromNpmMessage(auditMessageItem),
        message: removeTokensFromMessage(auditMessageItem)
      };
    }
  });
}

export function parseStandardError(auditMessage: string): ParsedRamblersUploadAudit[] {
  debugLog("parseStandardError:auditMessage", auditMessage);
  const auditMessageItems: string[] = splitIntoItems(auditMessage);
  return auditMessageItems.map(auditMessageItem => {
    const messageItemIgnored = isEmpty(auditMessageItem)
      || auditMessageItem.includes(envConfig.logNamespace(logNamespace))
      || includes(["\n", "", "npm"], auditMessageItem.trim());
    debugLog("parseStandardError:auditMessageItem:", auditMessageItems.indexOf(auditMessageItem) + 1, "of", auditMessageItems.length, "messageItemIgnored:", messageItemIgnored, "data:", auditMessageItem);
    if (messageItemIgnored) {
      return {
        audit: false
      };
    } else {
      if (anyMatch(auditMessageItem, errorIcons)) {
        return {
          audit: true,
          auditTime: momentNowAsValue(),
          type: "stderr",
          status: "error",
          message: removeTokensFromMessage(auditMessageItem)
        };
      } else if (auditMessageItem.includes("ActivityFinished: ")) {
        const messageAndResult = auditMessageItem.split("ActivityFinished: ")[1].split(" (result: ");
        const status = messageAndResult[1].replace(")", "").toLowerCase().split("\n")[0].trim();
        const message = removeTokensFromMessage(messageAndResult[0]);
        debugLog("messageAndResult ->", messageAndResult, "status ->", status, "message ->", message);
        return {
          audit: true,
          auditTime: momentNowAsValue(),
          type: "step",
          status,
          message
        };
      } else {
        return {
          audit: true,
          auditTime: momentNowAsValue(),
          type: "stderr",
          status: "info",
          message: removeTokensFromMessage(auditMessageItem)
        };
      }
    }
  });
}

export function parseExit(auditMessage: string): ParsedRamblersUploadAudit[] {
  debugLog("parseExit:auditMessage", auditMessage);
  return [{
    audit: true,
    auditTime: momentNowAsValue(),
    type: "step",
    status: "complete",
    message: removeTokensFromMessage(auditMessage)
  }];
}
