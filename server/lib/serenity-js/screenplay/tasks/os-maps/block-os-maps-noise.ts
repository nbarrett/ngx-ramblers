import { Interaction, UsesAbilities } from "@serenity-js/core/lib/screenplay";
import { BrowseTheWeb } from "@serenity-js/web";
import type { PlaywrightPage } from "@serenity-js/playwright";
import type { Page as NativePage } from "playwright-core";

const OS_MAPS_NOISE = /amplitude\.com|qualtrics\.com|weather\.oscpdata\.com|google-analytics\.com|googletagmanager\.com|doubleclick\.net|hotjar\.com|facebook\.net|cdn\.cookielaw\.org/i;

export class BlockOsMapsNoise extends Interaction {

  static now() {
    return new BlockOsMapsNoise();
  }

  constructor() {
    super("#actor blocks OS Maps analytics, survey and weather requests");
  }

  async performAs(actor: UsesAbilities): Promise<void> {
    const currentPage = await BrowseTheWeb.as(actor).currentPage() as unknown as PlaywrightPage;
    const native: NativePage = await currentPage.nativePage();
    await native.context().route(OS_MAPS_NOISE, route => route.abort());
  }

}
