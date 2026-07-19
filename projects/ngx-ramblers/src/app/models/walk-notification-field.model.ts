export enum WalkNotificationValueFormat {
  ATTENDEES = "attendees",
  BOOLEAN = "boolean",
  CONTACT = "contact",
  CONTACT_DETAILS = "contact-details",
  DATE_TIME = "date-time",
  FILE = "file",
  IMAGE_CONFIG = "image-config",
  LINKS = "links",
  LOCATION = "location",
  MARKDOWN = "markdown",
  MEDIA = "media",
  MEETUP = "meetup",
  METADATA = "metadata",
  PUBLISHING = "publishing",
  RISK_ASSESSMENT = "risk-assessment",
  SPEED = "speed",
  TEXT = "text",
  VENUE = "venue"
}

export interface WalkNotificationFieldDescriptor {
  label: string;
  notify: boolean;
  format: WalkNotificationValueFormat;
}
