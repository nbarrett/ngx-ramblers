import {TestBed} from "@angular/core/testing";
import {LoggerTestingModule} from "ngx-logger/testing";
import {describe, expect, it} from "vitest";
import {EventTemplateRenderingService} from "./event-template-rendering.service";
import {EmailComposerRenderingService} from "../email-composer/email-composer-rendering.service";
import {MailMessagingService} from "./mail-messaging.service";
import {DateUtilsService} from "../date-utils.service";
import {UrlService} from "../url.service";

describe("event listing email fragment", () => {
  it("renders the event block with email body styles and without campaign chrome", () => {
    TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [
      {provide: DateUtilsService, useValue: {displayDate: () => "Sunday"}},
      {provide: UrlService, useValue: {absoluteUrlFor: path => path}},
      {provide: MailMessagingService, useValue: {currentConfig: () => ({notificationConfigs: []}), createSendSmtpEmailParams: () => ({})}},
      {provide: EmailComposerRenderingService, useValue: {
        markdownToHtml: value => value,
        tableSection: value => `<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px">${value}</div>`
      }}
    ]});
    const rendering = TestBed.inject(EventTemplateRenderingService);
    const html = rendering.embeddedEmailHtml("## Hillside Park\n\nDetails of the walk.");
    expect(html).toContain("Hillside Park");
    expect(html).toContain("font-family:Helvetica,Arial,sans-serif");
    expect(html).toContain("font-size:16px");
    expect(html).toContain("background:#ffffff");
    expect(html).not.toContain("View this email in your browser");
    expect(html).not.toContain("BANNER");
  });
});
