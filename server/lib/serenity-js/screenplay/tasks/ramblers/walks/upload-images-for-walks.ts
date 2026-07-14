import { AnswersQuestions, PerformsActivities, Task, UsesAbilities, Wait } from "@serenity-js/core";
import { equals, isGreaterThan, isPresent } from "@serenity-js/assertions";
import { Attribute } from "@serenity-js/web";
import { WalkImagesUpload } from "../../../../../models/walk-upload-metadata";
import { RamblersWalkSummaries } from "../../../questions/ramblers/ramblers-walks-summaries";
import { WalksPageElements } from "../../../ui/ramblers/walks-page-elements";
import { NavigateWithDomLoaded } from "../../common/navigate-with-dom-loaded";
import { RequestParameterExtractor } from "../common/request-parameter-extractor";
import { normalizeWalkDate } from "./select-walks-by-date-and-title";
import { UploadWalkImages } from "./upload-walk-images";
import { ClickWhenReady } from "../../common/click-when-ready";
import { SelectWalks } from "./select-walks";
import { Accept } from "../common/accept-cookie-prompt";
import { Publish } from "./publish";

export class UploadImagesForWalks extends Task {

  static requested(): UploadImagesForWalks {
    return new UploadImagesForWalks(RequestParameterExtractor.extract().walkImageUploads);
  }

  constructor(private readonly uploads: WalkImagesUpload[]) {
    super(`#actor uploads images for ${uploads.length} walks`);
  }

  async performAs(actor: PerformsActivities & UsesAbilities & AnswersQuestions): Promise<void> {
    const walksListUrl = listUrlFor(this.uploads);
    for (const upload of this.uploads) {
      await actor.attemptsTo(
        NavigateWithDomLoaded.to(walksListUrl),
        Wait.until(WalksPageElements.walkListTable, isPresent()),
        Wait.until(WalksPageElements.walkListTableRows.count(), isGreaterThan(0))
      );
      await openDescriptionFor(actor, upload);
      await actor.attemptsTo(
        UploadWalkImages.from(upload.images),
        Accept.dismissCookieBanners(),
        ClickWhenReady.on(WalksPageElements.descriptionStepLink),
        Wait.until(WalksPageElements.walkImageAlternativeTextFields.count(), equals(upload.images.length))
      );
      if (upload.walkId) {
        await actor.attemptsTo(
          NavigateWithDomLoaded.to(walksListUrl),
          SelectWalks.byDateAndTitle([{
            date: upload.date,
            title: upload.title,
            walkId: upload.walkId
          }]),
          Publish.selectedWalks()
        );
      }
    }

    await actor.attemptsTo(NavigateWithDomLoaded.to(walksListUrl));
  }
}

async function openDescriptionFor(actor: PerformsActivities & AnswersQuestions & UsesAbilities, upload: WalkImagesUpload): Promise<void> {
  await actor.attemptsTo(SelectWalks.byDateAndTitle([{
    date: upload.date,
    title: upload.title,
    walkId: upload.walkId || ""
  }]));
  const displayedWalks = await RamblersWalkSummaries.displayed().answeredBy(actor);
  const selectedWalks = displayedWalks.filter(walk => walk.currentlySelected);
  if (selectedWalks.length !== 1) {
    throw new Error(`Expected the established walk selection to identify one Ramblers walk for "${upload.title}" on ${upload.date} but selected ${selectedWalks.length}`);
  }
  await actor.attemptsTo(
    ClickWhenReady.on(WalksPageElements.hrefForRow(selectedWalks[0].tableRow)),
    Accept.dismissCookieBanners()
  );
  const editWalkHref = await actor.answer(Attribute.called("href").of(WalksPageElements.editWalkLink));
  await actor.attemptsTo(
    NavigateWithDomLoaded.to(new URL(editWalkHref, "https://walks-manager.ramblers.org.uk").toString()),
    ClickWhenReady.on(WalksPageElements.descriptionStepLink)
  );
}

function listUrlFor(uploads: WalkImagesUpload[]): string {
  const earliestDate = uploads.map(upload => normalizeWalkDate(upload.date)).filter(date => !!date).sort()[0] || "";
  return `https://walks-manager.ramblers.org.uk/walks-manager/all-walks-events?search=&items_per_page=All&d[min]=${earliestDate}&d[max]=&rauid=all`;
}
