import { KeyValue } from "../services/enums";
import { keys, map } from "lodash";
import { NotificationConfig, ProcessToTemplateMappings, SendSmtpEmailParams } from "../models/mail.model";

export function extractParametersFrom(params: SendSmtpEmailParams, wrapInParams: boolean): KeyValue<any>[] {
  return keys(params).map(outerKey => {
    return map(params[outerKey], (value, subKey) => {
      const key = wrapInParams ? `{{params.${outerKey}.${subKey}}}` : `${outerKey}.${subKey}`;
      return {key, value};
    });
  }).flat(2);
}

export function notificationMappings(processToTemplateMappings: ProcessToTemplateMappings): NotificationConfig[] {
  return keys(processToTemplateMappings).map(key => processToTemplateMappings[key]);
}
