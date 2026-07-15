import { AnswersQuestions, Duration, PerformsActivities, Task, UsesAbilities, Wait } from "@serenity-js/core";
import { isGreaterThan, isPresent, not } from "@serenity-js/assertions";
import { Attribute, BrowseTheWeb } from "@serenity-js/web";
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
import { changesForStep } from "./edit-walk-details";
import { WalkEditStep, WalkFieldChange } from "../../../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { ClickWhenReady } from "../../common/click-when-ready";
import { WalkFilters } from "./select-walks";
import { Accept } from "../common/accept-cookie-prompt";
import { AllowNavigationAwayFromEdit } from "./allow-navigation-away-from-edit";
import { ClickViaScript } from "./click-via-script";
import { SaveAndContinue } from "./save-and-continue";
import { pluraliseWithCount } from "../../../../../shared/string-utils";

const WIZARD_STEPS: WalkEditStep[] = [WalkEditStep.BASIC_INFORMATION, WalkEditStep.DESCRIPTION, WalkEditStep.LOCATION, WalkEditStep.GRADING];

const debugLog = debug(envConfig.logNamespace("UploadImagesForWalks"));
debugLog.enabled = true;

const WALKS_MANAGER_BASE_URL = "https://walks-manager.ramblers.org.uk";
const WALK_LOOKUP_ATTEMPTS = 5;

export class UploadImagesForWalks extends Task {

  static requested(): UploadImagesForWalks {
    return new UploadImagesForWalks(RequestParameterExtractor.extract().walkImageUploads);
  }

  constructor(private readonly uploads: WalkImagesUpload[]) {
    super(`#actor synchronises ${pluraliseWithCount(uploads.length, "walk")} with Ramblers`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const walksListUrl = listUrlFor(this.uploads);
    await this.uploads.reduce(async (previousUploads: Promise<void>, upload: WalkImagesUpload) => {
      await previousUploads;
      await editWalkInPlace(actor, upload, walksListUrl);
    }, Promise.resolve());

    await actor.attemptsTo(NavigateWithDomLoaded.to(walksListUrl));
  }
}

async function editWalkInPlace(actor: PerformsActivities & UsesAbilities & AnswersQuestions, upload: WalkImagesUpload, walksListUrl: string): Promise<void> {
  const fieldSteps: WalkEditStep[] = WIZARD_STEPS.filter(step => changesForStep(upload.fieldChanges, step).length > 0);
  const includeImages: boolean = !!upload.imagesChanged;
  const stepsToVisit: WalkEditStep[] = WIZARD_STEPS.filter(step => fieldSteps.includes(step) || (step === WalkEditStep.DESCRIPTION && includeImages));
  const shouldPublish: boolean = !!upload.walkId;
  debugLog(`editing "${upload.title}": field steps ${fieldSteps.join(", ") || "none"}, imagesChanged=${includeImages}, publish=${shouldPublish}, visiting ${stepsToVisit.join(", ") || "nothing"}`);

  if (stepsToVisit.length === 0) {
    debugLog(`no changes to apply for "${upload.title}", skipping`);
    return;
  }

  await openWalkForEditing(actor, upload, walksListUrl);

  await stepsToVisit.reduce(async (previousStep: Promise<void>, step: WalkEditStep, stepIndex: number) => {
    await previousStep;
    await ensureOnStep(actor, step);
    const changes: WalkFieldChange[] = changesForStep(upload.fieldChanges, step);
    if (changes.length > 0) {
      debugLog(`applying ${pluraliseWithCount(changes.length, "field change")} on the ${step} step`);
      await actor.attemptsTo(ApplyWalkFieldChanges.to(changes));
    }
    if (step === WalkEditStep.DESCRIPTION && includeImages) {
      debugLog(`synchronising images on the ${step} step`);
      await actor.attemptsTo(SynchroniseWalkImages.to(upload.images));
    }
    const lastStep: boolean = stepIndex === stepsToVisit.length - 1;
    if (lastStep) {
      await publishEditedWalk(actor, shouldPublish, step);
    } else {
      await saveAndContinue(actor, step);
    }
  }, Promise.resolve());
}

async function ensureOnStep(actor: PerformsActivities & UsesAbilities & AnswersQuestions, step: WalkEditStep): Promise<void> {
  const currentPage = await BrowseTheWeb.as(actor).currentPage();
  const currentUrl: string = (await currentPage.url()).toString();
  if (!currentUrl.includes(`/walks-manager/walk/${step}/`)) {
    await actor.attemptsTo(
      ClickWhenReady.on(WalksPageElements.walkStepLink(step)),
      Accept.dismissCookieBanners());
  }
}

async function saveAndContinue(actor: PerformsActivities & UsesAbilities & AnswersQuestions, step: WalkEditStep): Promise<void> {
  debugLog(`saving the ${step} step before moving on`);
  await actor.attemptsTo(SaveAndContinue.awayFromPath(`/walks-manager/walk/${step}/`));
}

async function publishEditedWalk(actor: PerformsActivities & UsesAbilities & AnswersQuestions, shouldPublish: boolean, step: WalkEditStep): Promise<void> {
  if (shouldPublish) {
    await actor.attemptsTo(
      ClickViaScript.on("label[for='save_publish_action']", "publishes the walk"),
      Wait.upTo(Duration.ofMinutes(2)).until(WalksPageElements.saveAndContinueButton, not(isPresent())));
  } else {
    await actor.attemptsTo(SaveAndContinue.awayFromPath(`/walks-manager/walk/${step}/`));
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
    Accept.dismissCookieBanners(),
    AllowNavigationAwayFromEdit.now());
}

async function findWalk(actor: PerformsActivities & AnswersQuestions & UsesAbilities, upload: WalkImagesUpload, walksListUrl: string): Promise<RamblersWalkSummary> {
  const attempts: number[] = Array.from({length: WALK_LOOKUP_ATTEMPTS}, (_value, index) => index);
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
      debugLog(`walk "${upload.title}" on ${upload.date} not listed on attempt ${attempt + 1} of ${WALK_LOOKUP_ATTEMPTS}: reloading the walks list`);
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
