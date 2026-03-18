import { ApiResponse, Identifiable } from "./api-response.model";
import { ContactDetails } from "./group-event.model";
import { RamblersEventType } from "./ramblers-walks-manager";

export enum BookingStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  WAITLISTED = "waitlisted"
}

export type BookingAttendee = Partial<ContactDetails> & Pick<ContactDetails, "displayName" | "email">;

export interface Booking extends Identifiable {
  eventIds: string[];
  attendees: BookingAttendee[];
  createdAt: number;
  status?: BookingStatus;
  cancelledAt?: number;
  waitlistedAt?: number;
  waitlistedReason?: string;
  restoredAt?: number;
  memberBooking?: boolean;
  reminderSentAt?: number;
}

export interface BookingApiResponse extends ApiResponse {
  request: any;
  response?: Booking | Booking[];
}

export interface BookingCreateRequest {
  booking: Booking;
  eventLink: string | null;
}

export interface BookingCancelRequest {
  email: string;
  eventLink: string | null;
}

export interface BookingCapacityResponse {
  eventIds: string[];
  totalBooked: number;
}

export interface BookingCapacity {
  eventIds: string[];
  totalBooked: number;
  maxCapacity: number;
  fullyBooked: boolean;
  remainingPlaces: number;
}

export interface BookingSummaryRow {
  eventId?: string;
  eventIds: string[];
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  totalBooked: number;
  maxCapacity: number;
  eventType?: RamblersEventType;
  eventSelectorLabel?: string;
  orphaned?: boolean;
}

export enum ContactInteractionStatus {
  NEW = "new",
  READ = "read",
  ARCHIVED = "archived"
}

export interface ContactInteraction extends Identifiable {
  eventId?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  anonymous: boolean;
  recipientRole: string;
  createdAt: number;
  status: ContactInteractionStatus;
}

export interface ContactInteractionApiResponse extends ApiResponse {
  request: any;
  response?: ContactInteraction | ContactInteraction[];
}

export interface BookingEligibility {
  memberPriorityActive: boolean;
  publicBookingOpensAt: number | null;
  memberPriorityDays: number | null;
  totalWaitlisted: number;
  capacity: BookingCapacity;
}

export interface BookingAttendeeListResponse {
  eventId: string;
  attendees: BookingAttendee[];
  totalBookings: number;
}

export const DEFAULT_MAX_GROUP_SIZE = 3;
