import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { includes, isEmpty, isUndefined, some } from "es-toolkit/compat";
import {
  AuditType,
  ParsedRamblersUploadAudit,
  Status,
  DomainEventData
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { dateTimeInTimezone, dateTimeNowAsValue } from "../shared/dates";

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

function removeTokensFromMessage(auditMessage: string): string {
  return trimTokensFrom(auditMessage, successIcons.concat(errorIcons).concat(ansiTokens));
}

function toStatusFromNpmMessage(auditMessageItem: string): Status {
  return anyMatch(auditMessageItem, npmErrorTokens) ? Status.ERROR : Status.INFO;
}

function toStatusFromIcon(auditMessageItem: string): Status {
  if (anyMatch(auditMessageItem, successIcons)) {
    return Status.SUCCESS;
  } else if (anyMatch(auditMessageItem, errorIcons)) {
    const isRetry = auditMessageItem.toLowerCase().includes("retrying");
    return isRetry ? Status.WARNING : Status.ERROR;
  } else {
    return Status.INFO;
  }
}

function splitIntoItems(auditMessage: string) {
  return auditMessage.split(/\[(?:serenity-run-[^\]]*|0-0)]/).map(item => item.trim());
}

export function parseStandardOut(auditMessage: string): ParsedRamblersUploadAudit[] {
  debugLog("parseStandardOut:auditMessage:", auditMessage);
  const auditMessageItems: string[] = splitIntoItems(auditMessage);
  return auditMessageItems.map(auditMessageItem => {
    const messageItemIgnored: boolean = auditMessageItem === "\n"
      || isEmpty(auditMessageItem)
      || isUndefined(auditMessageItem)
      || auditMessageItem.length <= 2
      || anyMatch(auditMessageItem, [envConfig.logNamespace(logNamespace), "SceneTagged", "ActivityStarts", "[report]"]);
    debugLog("parseStandardOut:auditMessageItem:", auditMessageItems.indexOf(auditMessageItem) + 1, "of", auditMessageItems.length, "messageItemIgnored:", messageItemIgnored, "data:", auditMessageItem);
    if (messageItemIgnored) {
      return {audit: false};
    } else if (auditMessageItem.includes("ActivityFinished: ")) {
      const messageAndResult = auditMessageItem.split("ActivityFinished: ")[1].split("1");
      const status = messageAndResult[1].replace(")", "").toLowerCase().split("\n")[0].trim() as Status;
      const message = messageAndResult[0].trim();
      debugLog("parseStandardOut:messageAndResult ->", messageAndResult, "status ->", status, "message ->", message);
      return {
        audit: true,
        data: {
        auditTime: dateTimeNowAsValue(),
        type: AuditType.STEP,
        status,
        message
        }
      };
    } else if (anyMatch(auditMessageItem, successIcons.concat(errorIcons))) {
      return {
        audit: true,
        data: {
        auditTime: dateTimeNowAsValue(),
        type: AuditType.STEP,
        status: toStatusFromIcon(auditMessageItem),
        message: removeTokensFromMessage(auditMessageItem)
        }
      };
    } else {
      return {
        audit: true,
        data: {
        auditTime: dateTimeNowAsValue(),
        type: AuditType.STEP,
        status: toStatusFromNpmMessage(auditMessageItem),
        message: removeTokensFromMessage(auditMessageItem)
        }
      };
    }
  });
}

export function parseTestStepEvent(testStepEvent: DomainEventData): ParsedRamblersUploadAudit[] {
  debugLog("parseStandardOut:testStepEvent:", testStepEvent);
  let status: Status;
  const isRetry = testStepEvent.details.name.toLowerCase().includes("retry");

  if (testStepEvent.outcome.code === 64) {
    status = Status.SUCCESS;
  } else if (isRetry) {
    status = Status.WARNING;
  } else {
    status = Status.ERROR;
  }

  const parsedRamblersUploadAudit: ParsedRamblersUploadAudit = {
    audit: true,
    data: {
      auditTime: dateTimeInTimezone(testStepEvent.timestamp).toMillis(),
      type: AuditType.STEP,
      status,
      message: testStepEvent.details.name,
      errorResponse: testStepEvent.outcome.error
    }
  };
  debugLog("parseTestStepEvent:testStepEvent ->", testStepEvent, "status ->", status, "message ->", parsedRamblersUploadAudit);
  return [parsedRamblersUploadAudit];
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
          data: {
          auditTime: dateTimeNowAsValue(),
          type: AuditType.STDERR,
          status: Status.ERROR,
          message: removeTokensFromMessage(auditMessageItem)
          }
        };
      } else if (auditMessageItem.includes("ActivityFinished: ")) {
        const messageAndResult = auditMessageItem.split("ActivityFinished: ")[1].split(" (result: ");
        const status = messageAndResult[1].replace(")", "").toLowerCase().split("\n")[0].trim() as Status;
        const message = removeTokensFromMessage(messageAndResult[0]);
        debugLog("parseStandardError:messageAndResult ->", messageAndResult, "status ->", status, "message ->", message);
        return {
          audit: true,
          data: {
          auditTime: dateTimeNowAsValue(),
          type: AuditType.STEP,
          status,
          message
          }
        };
      } else {
        const isRetry = auditMessageItem.toLowerCase().includes("retrying");
        return {
          audit: true,
          data: {
          auditTime: dateTimeNowAsValue(),
          type: AuditType.STDERR,
          status: isRetry ? Status.WARNING : Status.INFO,
          message: removeTokensFromMessage(auditMessageItem)
          }
        };
      }
    }
  });
}

export function parseExit(auditMessage: string, status: Status): ParsedRamblersUploadAudit[] {
  debugLog("parseExit:auditMessage:", auditMessage, "status:", status);
  return [{
    audit: true,
    data: {
      auditTime: dateTimeNowAsValue(),
      type: AuditType.SUMMARY,
      status,
      message: removeTokensFromMessage(auditMessage)
    }
  }];
}
