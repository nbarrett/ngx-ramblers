import expect from "expect";
import { describe, it } from "mocha";
import {
  BOOKING_EMAIL_BLOCK_KEYS,
  resolveBookingBody
} from "./booking-template-resolver";
import { BookingEmailType } from "../../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import {
  NotificationConfig,
  TemplateOverrideState,
  TemplateOverrideType
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

describe("booking-template-resolver resolveBookingBody", () => {

  const notifConfigWith = (content: string): NotificationConfig => ({
    templateOverrides: {
      [BOOKING_EMAIL_BLOCK_KEYS[BookingEmailType.CONFIRMATION]]: {
        type: TemplateOverrideType.CONTENT,
        state: TemplateOverrideState.CUSTOM,
        content
      }
    }
  } as unknown as NotificationConfig);

  it("returns the repo default content block rendered as HTML when there is no override", () => {
    const result = resolveBookingBody(BookingEmailType.CONFIRMATION, {}, null);
    expect(result).toContain("<p>");
    expect(result).toContain("{{params.bookingMergeFields.EVENT_TITLE}}");
  });

  it("preserves booking merge fields inside markdown link URLs", () => {
    const result = resolveBookingBody(BookingEmailType.CONFIRMATION, {}, null);
    expect(result).toContain(`href="{{params.bookingMergeFields.EVENT_LINK}}"`);
    expect(result).not.toContain("%7B%7Bparams.bookingMergeFields.EVENT_LINK%7D%7D");
  });

  it("renders the site-level markdown content block override as HTML", () => {
    const result = resolveBookingBody(BookingEmailType.CONFIRMATION, {}, notifConfigWith("our **site** wording"));
    expect(result).toContain("our <strong>site</strong> wording");
  });

  it("prefers the per-event override over the site override and the default", () => {
    const event = {fields: {bookingEmailOverrides: {confirmation: "this event only"}}};
    const result = resolveBookingBody(BookingEmailType.CONFIRMATION, event, notifConfigWith("our site wording"));
    expect(result).toContain("this event only");
    expect(result).not.toContain("site wording");
  });
});
