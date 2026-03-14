import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { MailchimpConfigService } from "../mailchimp-config.service";

import { MailchimpLinkService } from "./mailchimp-link.service";

describe("MailchimpLinkService", () => {

  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule],
    providers: [
      {
        provide: MailchimpConfigService, useValue: {
          getConfig: () => Promise.resolve({apiUrl: "https://us3.admin.mailchimp.com"}),
        }
      }]
  }));

  it("should return campaign preview url", async () => {
    const service: MailchimpLinkService = TestBed.inject(MailchimpLinkService);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(service.campaignPreview(123466)).toEqual("https://us3.admin.mailchimp.com/campaigns/preview-content-html?id=123466");
  });

  it("should return campaign edit url", async () => {
    const service: MailchimpLinkService = TestBed.inject(MailchimpLinkService);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(service.campaignEdit(123466)).toEqual("https://us3.admin.mailchimp.com/campaigns/edit?id=123466");
  });

  it("should return complete in mailchimp url", async () => {
    const service: MailchimpLinkService = TestBed.inject(MailchimpLinkService);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(service.completeInMailSystem(123466)).toEqual("https://us3.admin.mailchimp.com/campaigns/wizard/neapolitan?id=123466");
  });
});
