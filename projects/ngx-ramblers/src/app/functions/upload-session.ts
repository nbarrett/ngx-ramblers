import { UIDateFormat } from "../models/date-format.model";
import { FileUploadSummary } from "../models/ramblers-upload-audit.model";
import {
  SERENITY_FEATURE_FILE_NAMES,
  serenityFeatureFileNamePattern,
  serenityFeatureFromFileName,
  serenityFeatures
} from "../models/serenity-feature.model";
import { DateUtilsService } from "../services/date-utils.service";

export function uploadSessionTime(fileName: string, dateUtils: DateUtilsService): number | null {
  const feature = serenityFeatureFromFileName(fileName);
  const match = fileName?.match(serenityFeatureFileNamePattern(feature));
  if (match) {
    return dateUtils.parseDisplayDateWithFormat(match[1], SERENITY_FEATURE_FILE_NAMES[feature].timestampFormat)?.toMillis() || null;
  } else {
    return null;
  }
}

export function uploadSessionName(fileName: string): string {
  if (!fileName) {
    return "";
  } else {
    const withoutExtension = serenityFeatures().reduce((name, feature) => {
      const fileNameFormat = SERENITY_FEATURE_FILE_NAMES[feature];
      return name.replace(new RegExp(`^${fileNameFormat.prefix}`), "").replace(new RegExp(`\\.${fileNameFormat.extension}$`), "");
    }, fileName);
    return withoutExtension.replace(/-/g, " ");
  }
}

export function uploadSessionLabel(session: FileUploadSummary, dateUtils: DateUtilsService, duration?: string): string {
  const sessionTime = uploadSessionTime(session?.fileName, dateUtils);
  if (sessionTime) {
    const sessionDuration = duration || uploadSessionDuration(session, dateUtils);
    const label = dateUtils.displayDateAndTime(sessionTime);
    return sessionDuration ? `${label} (${sessionDuration})` : label;
  } else {
    return uploadSessionName(session?.fileName);
  }
}

export function uploadSessionDuration(session: FileUploadSummary, dateUtils: DateUtilsService): string {
  if (session?.earliestAuditTime && session?.latestAuditTime) {
    return dateUtils.formatDuration(session.earliestAuditTime, session.latestAuditTime);
  } else {
    return "";
  }
}

export function uploadSessionUrlParam(fileName: string, dateUtils: DateUtilsService): string {
  const sessionTime = uploadSessionTime(fileName, dateUtils);
  if (sessionTime) {
    return dateUtils.asString(sessionTime, undefined, UIDateFormat.YEAR_MONTH_DAY_T_HHMM);
  } else {
    return uploadSessionName(fileName).replace(/[^a-z0-9]/gi, "-").toLowerCase();
  }
}
