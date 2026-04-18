import { ApiResponse, Identifiable } from "./api-response.model";
import { ContactDetails } from "./group-event.model";
import { EmailAddress, NotificationConfig } from "./mail.model";
import { RamblersEventType } from "./ramblers-walks-manager";

export enum BookingStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  WAITLISTED = "waitlisted"
}

export enum BookingFormMode {
  BOOK = "book",
  CANCEL = "cancel"
}

export enum ContactDetailField {
  DISPLAY_NAME = "displayName",
  EMAIL = "email",
  PHONE = "phone"
}

export type BookingAttendee = Omit<Partial<ContactDetails>, ContactDetailField> & {
  displayName: string;
  email?: string | null;
  phone?: string | null;
};

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
  eventSlug?: string;
  eventStartDateTime?: string;
  groupName?: string;
  groupCode?: string;
  bookable?: boolean;
  upcoming?: boolean;
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

export interface BookingReminderDispatch {
  eventId: string;
  eventTitle: string;
  sentCount: number;
  alreadySentCount: number;
  skippedCount: number;
}

export interface BookingEmailBuild {
  notifConfig: NotificationConfig;
  sender: EmailAddress;
  replyTo: EmailAddress;
  to: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  bodyContent: string;
  params: any;
  templateId: number;
}

export const DEFAULT_MAX_GROUP_SIZE = 3;
