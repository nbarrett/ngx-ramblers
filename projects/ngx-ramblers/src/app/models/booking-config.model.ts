import { RamblersEventType } from "./ramblers-walks-manager";

export interface BookingConfig {
  enabled: boolean;
  enabledForEventTypes?: RamblersEventType[];
  defaultMaxCapacity: number;
  defaultMaxGroupSize: number;
  defaultMemberPriorityDays: number;
}

export const BOOKING_EVENT_TYPES: RamblersEventType[] = [
  RamblersEventType.GROUP_WALK,
  RamblersEventType.GROUP_EVENT,
  RamblersEventType.WELLBEING_WALK
];

export function enabledBookingEventTypes(booking?: BookingConfig): RamblersEventType[] {
  return booking?.enabledForEventTypes?.length > 0 ? booking.enabledForEventTypes : BOOKING_EVENT_TYPES;
}

export function bookingEnabledForEventType(booking: BookingConfig, eventType: RamblersEventType): boolean {
  return !!booking?.enabled && enabledBookingEventTypes(booking).includes(eventType || RamblersEventType.GROUP_WALK);
}
