import { BookingConfig, BOOKING_EVENT_TYPES } from "../../../../projects/ngx-ramblers/src/app/models/booking-config.model";

export function createBookingConfig(): BookingConfig {
  return {
    enabled: false,
    enabledForEventTypes: BOOKING_EVENT_TYPES,
    defaultMaxCapacity: 0,
    defaultMaxGroupSize: 3,
    defaultMemberPriorityDays: 0
  };
}
