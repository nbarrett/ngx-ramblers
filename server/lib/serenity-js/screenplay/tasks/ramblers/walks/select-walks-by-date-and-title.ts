import { AnswersQuestions, PerformsActivities, Task, UsesAbilities } from "@serenity-js/core";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblers-walks-summaries";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { SelectCheckbox } from "../../common/select-checkbox";
import { SelectWalks, WalkFilters } from "./select-walks";
import { WalkUploadInfo } from "../../../../../models/walk-upload-metadata";
import { RamblersWalkSummary } from "../../../../models/ramblers-walk-summary";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";
import { DateTime } from "luxon";
import { UIDateFormat } from "../../../../../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { matchesAllowingTruncation, normalisedForComparison } from "../../../../../../../projects/ngx-ramblers/src/app/functions/strings";
import { dateTimeFromIso, dateTimeInTimezone } from "../../../../../shared/dates";

const debugLog = debug(envConfig.logNamespace("SelectWalksByDateAndTitle"));
debugLog.enabled = true;

export const normalizeWalkDate = (dateStr: string): string => {
  if (!dateStr) {
    return "";
  }
  const candidates: DateTime[] = [
    dateTimeInTimezone(dateStr, UIDateFormat.WEEKDAY_DAY_MONTH_YEAR),
    dateTimeInTimezone(dateStr, UIDateFormat.WEEKDAY_DAY_MONTH_YEAR_APOSTROPHE),
    dateTimeInTimezone(dateStr, UIDateFormat.WEEKDAY_DAY_MONTH_YEAR_ABBREVIATED),
    dateTimeInTimezone(dateStr, UIDateFormat.DAY_MONTH_YEAR_WITH_SLASHES),
    dateTimeFromIso(dateStr)
  ];
  const parsed = candidates.find(candidate => candidate?.isValid);
  if (parsed) {
    return parsed.toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES);
  }
  debugLog(`Warning: Could not parse date "${dateStr}"`);
  return "";
};

export class SelectWalksByDateAndTitle extends Task {

  constructor(private walks: WalkUploadInfo[]) {
    super(`#actor selects walks matching ${walks.length} date/title combinations`);
  }

  performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<any> {
    const walkIds = this.walks.map(w => w.walkId);
    debugLog("Looking for walks with IDs:", walkIds);
    debugLog("Upload metadata:", this.walks.map(w => ({
      walkId: w.walkId,
      date: w.date,
      title: w.title,
      normalizedTitle: normalisedForComparison(w.title),
      normalizedDate: normalizeWalkDate(w.date)
    })));

    return RamblersWalkSummaries.displayed().answeredBy(actor)
      .then(displayedWalks => {
        debugLog(`Checking ${displayedWalks.length} displayed walks`);

        const matchedWalks = displayedWalks.filter((walk: RamblersWalkSummary) => {
          const idMatch = WalkFilters.withIds(walk, ...walkIds);

          if (idMatch) {
            debugLog(`✓ ID match for walk ${walk.walkId}: "${walk.title}" on ${walk.walkDate}`);
            return true;
          }

          const dateAndTitleMatch = this.walks.some(w => {
            const normalizedWalkDate = normalizeWalkDate(walk.walkDate);
            const normalizedUploadDate = normalizeWalkDate(w.date);
            const dateMatches = normalizedWalkDate === normalizedUploadDate;
            const normalizedWalkTitle = normalisedForComparison(walk.title);
            const normalizedUploadTitle = normalisedForComparison(w.title);
            const titleMatches = matchesAllowingTruncation(walk.title, w.title);

            if (dateMatches && titleMatches) {
              debugLog(`✓ Date/Title match for walk ${walk.walkId}:`, {
                displayedDate: walk.walkDate,
                uploadDate: w.date,
                normalizedDisplayedDate: normalizedWalkDate,
                normalizedUploadDate: normalizedUploadDate,
                displayedTitle: walk.title,
                uploadTitle: w.title,
                normalizedDisplayed: normalizedWalkTitle,
                normalizedUpload: normalizedUploadTitle
              });
              return true;
            }

            if (dateMatches && !titleMatches) {
              debugLog(`✗ Date matches but title differs for walk ${walk.walkId}:`, {
                displayedDate: walk.walkDate,
                uploadDate: w.date,
                normalizedDisplayedDate: normalizedWalkDate,
                normalizedUploadDate: normalizedUploadDate,
                displayedTitle: walk.title,
                uploadTitle: w.title,
                normalizedDisplayed: normalizedWalkTitle,
                normalizedUpload: normalizedUploadTitle
              });
            }

            return false;
          });

          return dateAndTitleMatch;
        });

        debugLog(`Matched ${matchedWalks.length} walks total`);
        matchedWalks.forEach(w => debugLog(`  - ${w.walkId}: "${w.title}" on ${w.walkDate}`));

        return actor.attemptsTo(
          SelectWalks.none(),
          ...matchedWalks.map(walk =>
            SelectCheckbox.checked().from(WalksPageElements.checkboxSelector(walk.tableRow, walk.walkDate))
          )
        );
      });
  }
}
