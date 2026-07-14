import { AnswersQuestions, Duration, PerformsActivities, Task, UsesAbilities, Wait } from "@serenity-js/core";
import { isGreaterThan, isPresent } from "@serenity-js/assertions";
import { Attribute } from "@serenity-js/web";
import debug from "debug";
import { envConfig } from "../../../../../env-config/env-config";
import { WalkImagesUpload } from "../../../../../models/walk-upload-metadata";
import { RamblersWalkSummary } from "../../../../models/ramblers-walk-summary";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblers-walks-summaries";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { NavigateWithDomLoaded } from "../../common/navigate-with-dom-loaded";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { normalizeWalkDate } from "./select-walks-by-date-and-title";
import { matchesAllowingTruncation } from "../../../../../../../projects/ngx-ramblers/src/app/functions/strings";
import { SynchroniseWalkImages } from "./synchronise-walk-images";
import { ApplyWalkFieldChanges } from "./apply-walk-field-changes";
import { changesForStep, EditWalkDetails, STEPS_EDITED_BEFORE_IMAGES } from "./edit-walk-details";
import { WalkEditStep } from "../../../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { ClickWhenReady } from "../../common/click-when-ready";
import { WalkFilters } from "./select-walks";
import { Accept } from "../common/accept-cookie-prompt";

const debugLog = debug(envConfig.logNamespace("UploadImagesForWalks"));
debugLog.enabled = true;

const WALKS_MANAGER_BASE_URL = "https://walks-manager.ramblers.org.uk";
const WALK_LOOKUP_ATTEMPTS = 5;

export class UploadImagesForWalks extends Task {

  static requested(): UploadImagesForWalks {
    return new UploadImagesForWalks(RequestParameterExtractor.extract().walkImageUploads);
  }

  constructor(private readonly uploads: WalkImagesUpload[]) {
    super(`#actor synchronises ${uploads.length} walks with Ramblers`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const walksListUrl = listUrlFor(this.uploads);
    await this.uploads.reduce(async (previousUploads: Promise<void>, upload: WalkImagesUpload) => {
      await previousUploads;
      await openWalkForEditing(actor, upload, walksListUrl);
      await STEPS_EDITED_BEFORE_IMAGES.reduce(async (previousSteps: Promise<void>, step: WalkEditStep) => {
        await previousSteps;
        await actor.attemptsTo(EditWalkDetails.forStep(step, upload.fieldChanges));
      }, Promise.resolve());
      await actor.attemptsTo(
        ClickWhenReady.on(WalksPageElements.descriptionStepLink),
        Accept.dismissCookieBanners(),
        ApplyWalkFieldChanges.to(changesForStep(upload.fieldChanges, WalkEditStep.DESCRIPTION)),
        SynchroniseWalkImages.to(upload.images, !!upload.walkId));
    }, Promise.resolve());

    await actor.attemptsTo(NavigateWithDomLoaded.to(walksListUrl));
  }
}

async function openWalkForEditing(actor: PerformsActivities & AnswersQuestions & UsesAbilities, upload: WalkImagesUpload, walksListUrl: string): Promise<void> {
  const walk: RamblersWalkSummary = await findWalk(actor, upload, walksListUrl);
  await actor.attemptsTo(
    ClickWhenReady.on(WalksPageElements.hrefForRow(walk.tableRow)),
    Accept.dismissCookieBanners());
  const editWalkHref = await actor.answer(Attribute.called("href").of(WalksPageElements.editWalkLink));
  debugLog(`opening walk "${upload.title}" on ${upload.date} for editing at ${editWalkHref}`);
  await actor.attemptsTo(
    NavigateWithDomLoaded.to(new URL(editWalkHref, WALKS_MANAGER_BASE_URL).toString()),
    Accept.dismissCookieBanners());
}

async function findWalk(actor: PerformsActivities & AnswersQuestions & UsesAbilities, upload: WalkImagesUpload, walksListUrl: string): Promise<RamblersWalkSummary> {
  const attempts: number[] = Array.from({length: WALK_LOOKUP_ATTEMPTS}, (value, index) => index);
  const matchedWalk: RamblersWalkSummary = await attempts.reduce(async (previousAttempt: Promise<RamblersWalkSummary>, attempt: number) => {
    const alreadyMatched = await previousAttempt;
    if (alreadyMatched) {
      return alreadyMatched;
    }
    await actor.attemptsTo(
      NavigateWithDomLoaded.to(walksListUrl),
      Wait.until(WalksPageElements.walkListTable, isPresent()),
      Wait.until(WalksPageElements.walkListTableRows.count(), isGreaterThan(0)));
    const displayedWalks: RamblersWalkSummary[] = await RamblersWalkSummaries.displayed().answeredBy(actor);
    const walk: RamblersWalkSummary = matchingWalk(displayedWalks, upload);
    if (!walk && attempt < WALK_LOOKUP_ATTEMPTS - 1) {
      debugLog(`walk "${upload.title}" on ${upload.date} not listed on attempt ${attempt + 1} of ${WALK_LOOKUP_ATTEMPTS}: retrying`);
      await actor.attemptsTo(Wait.for(Duration.ofSeconds(5)));
    }
    return walk;
  }, Promise.resolve<RamblersWalkSummary>(null));

  if (!matchedWalk) {
    const displayedWalks: RamblersWalkSummary[] = await RamblersWalkSummaries.displayed().answeredBy(actor);
    const titlesOnSameDate: string[] = displayedWalks
      .filter(walk => normalizeWalkDate(walk.walkDate) === normalizeWalkDate(upload.date))
      .map(walk => `"${walk.title}"`);
    const candidates = titlesOnSameDate.length > 0
      ? `Walks listed on that date: ${titlesOnSameDate.join(", ")}`
      : "No walks are listed on that date";
    throw new Error(`Could not find Ramblers walk "${upload.title}" on ${upload.date} in Walks Manager after ${WALK_LOOKUP_ATTEMPTS} attempts. ${candidates}`);
  }
  return matchedWalk;
}

function matchingWalk(displayedWalks: RamblersWalkSummary[], upload: WalkImagesUpload): RamblersWalkSummary {
  const walksOnDate: RamblersWalkSummary[] = displayedWalks.filter(walk => normalizeWalkDate(walk.walkDate) === normalizeWalkDate(upload.date));
  const matchedById: RamblersWalkSummary = upload.walkId ? displayedWalks.find(walk => WalkFilters.withIds(walk, upload.walkId)) : null;
  const matchedByTitle: RamblersWalkSummary = matchedById || walksOnDate.find(walk => matchesAllowingTruncation(walk.title, upload.title));
  const matched: RamblersWalkSummary = matchedByTitle || (walksOnDate.length === 1 ? walksOnDate[0] : null);
  if (matched) {
    debugLog(`matched Ramblers walk "${matched.title}" on ${matched.walkDate} for local walk "${upload.title}" on ${upload.date}`);
  }
  return matched || null;
}

function listUrlFor(uploads: WalkImagesUpload[]): string {
  const earliestDate = uploads.map(upload => normalizeWalkDate(upload.date)).filter(date => !!date).sort()[0] || "";
  return `${WALKS_MANAGER_BASE_URL}/walks-manager/all-walks-events?search=&items_per_page=All&d[min]=${earliestDate}&d[max]=&rauid=all`;
}
