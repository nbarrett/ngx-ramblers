import { LogicError, Stage } from "@serenity-js/core";
import type { ActivityFinished, ActivityStarts, DomainEvent } from "@serenity-js/core/lib/events";
import {
  ActivityRelatedArtifactGenerated,
  AsyncOperationAttempted,
  AsyncOperationCompleted,
  AsyncOperationFailed,
  InteractionFinished
} from "@serenity-js/core/lib/events";
import { CorrelationId, Description, ImplementationPending, Name, Photo } from "@serenity-js/core/lib/model";
import type { PlaywrightPage } from "@serenity-js/playwright";
import { BrowseTheWeb, PhotoTakingStrategy } from "@serenity-js/web";
import { PhotoAttempt, PhotoAttemptOutcome } from "../../models/serenity-photo.model";

const SETTLING_WINDOW_MS = 8000;

export class TakePhotosOfFailuresWhenThePageSettles extends PhotoTakingStrategy {

  protected shouldTakeAPhotoOf(event: DomainEvent): boolean {
    return event instanceof InteractionFinished && event.outcome.isWorseThan(ImplementationPending);
  }

  protected photoNameFor(event: InteractionFinished): string {
    return event.details.name.value;
  }

  async considerTakingPhoto(event: ActivityStarts | ActivityFinished, stage: Stage): Promise<void> {
    const browseTheWeb = this.shouldTakeAPhotoOf(event) ? this.browserOf(stage) : null;
    if (browseTheWeb) {
      const id = CorrelationId.create();
      const photoName = this.photoNameFor(event as InteractionFinished);
      stage.announce(new AsyncOperationAttempted(
        new Name(`Photographer:${this.constructor.name}`),
        new Description(`Taking screenshot of '${photoName}' once the page settles...`),
        id, stage.currentTime()));
      const attempt = await this.photographOnceThePageSettles(browseTheWeb);
      if (attempt.outcome === PhotoAttemptOutcome.PHOTOGRAPHED) {
        const capabilities = await browseTheWeb.browserCapabilities();
        const name = new Name([capabilities.platformName, capabilities.browserName, capabilities.browserVersion, photoName]
          .filter(part => !!part).join("-"));
        stage.announce(new ActivityRelatedArtifactGenerated(
          event.sceneId, event.activityId, name, Photo.fromBase64(attempt.screenshot), stage.currentTime()));
        stage.announce(new AsyncOperationCompleted(id, stage.currentTime()));
      } else {
        stage.announce(new AsyncOperationFailed(
          new Error(`No page settled enough to be photographed for '${photoName}' within ${SETTLING_WINDOW_MS}ms: ${attempt.lastError}`),
          id, stage.currentTime()));
      }
    }
  }

  private browserOf(stage: Stage): BrowseTheWeb | null {
    try {
      return BrowseTheWeb.as(stage.theActorInTheSpotlight());
    } catch (error) {
      if (error instanceof LogicError || (error as Error)?.name === LogicError.name) {
        return null;
      } else {
        throw error;
      }
    }
  }

  private async photographOnceThePageSettles(browseTheWeb: BrowseTheWeb): Promise<PhotoAttempt> {
    try {
      const page = await browseTheWeb.currentPage();
      const native = await (page as unknown as PlaywrightPage).nativePage();
      await native.waitForLoadState("domcontentloaded", {timeout: SETTLING_WINDOW_MS});
      const screenshot = await page.takeScreenshot();
      return {outcome: PhotoAttemptOutcome.PHOTOGRAPHED, screenshot};
    } catch (error) {
      return {outcome: PhotoAttemptOutcome.NO_PAGE_TO_PHOTOGRAPH_YET, lastError: (error as Error).message};
    }
  }

}
