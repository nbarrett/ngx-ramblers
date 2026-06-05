import expect from "expect";
import { describe, it } from "mocha";
import {
  BOOKING_EMAIL_BLOCK_KEYS,
  DEFAULT_BOOKING_EMAIL_BLOCKS,
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

  it("returns the repo default content block when there is no override", () => {
    const result = resolveBookingBody(BookingEmailType.CONFIRMATION, {}, null);
    expect(result).toBe(DEFAULT_BOOKING_EMAIL_BLOCKS[BookingEmailType.CONFIRMATION]);
    expect(result).toContain("{{params.bookingMergeFields.EVENT_TITLE}}");
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
