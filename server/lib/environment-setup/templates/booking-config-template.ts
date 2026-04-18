import { BookingConfig, BookingScope, BOOKING_EVENT_TYPES } from "../../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import { DEFAULT_BOOKING_EMAIL_TEMPLATES } from "../../brevo/transactional-mail/booking-template-resolver";

export function createBookingConfig(): BookingConfig {
  return {
    enabled: false,
    scope: BookingScope.ALL_EVENTS,
    enabledForEventTypes: BOOKING_EVENT_TYPES,
    defaultMaxCapacity: 0,
    defaultMaxGroupSize: 3,
    defaultMemberPriorityDays: 0,
    emailTemplates: {...DEFAULT_BOOKING_EMAIL_TEMPLATES},
    reminderDaysBefore: 0
  };
}
