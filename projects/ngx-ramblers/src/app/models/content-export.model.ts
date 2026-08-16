export enum ContentExportFormat {
  JSON = "json",
  HTML = "html",
  MARKDOWN = "markdown"
}

export interface ContentExport {
  id: string;
  title: string;
  path: string;
  contentMarkdown: string;
  contentHtml: string;
}

export enum OpenGraphType {
  WEBSITE = "website",
  ARTICLE = "article",
  EVENT = "event"
}

export enum SchemaOrgEventStatus {
  SCHEDULED = "https://schema.org/EventScheduled",
  CANCELLED = "https://schema.org/EventCancelled"
}

export enum SchemaOrgOfferAvailability {
  IN_STOCK = "https://schema.org/InStock",
  SOLD_OUT = "https://schema.org/SoldOut",
  PRE_ORDER = "https://schema.org/PreOrder"
}

export enum SchemaOrgPerformerType {
  PERSON = "Person",
  PERFORMING_GROUP = "PerformingGroup"
}

export interface SchemaOrgPlace {
  "@type": string;
  name: string;
  address?: string;
  geo?: {
    "@type": string;
    latitude: number;
    longitude: number;
  };
}

export interface SchemaOrgOffer {
  "@type": string;
  url?: string;
  price: number;
  priceCurrency: string;
  availability?: SchemaOrgOfferAvailability;
  validFrom?: string;
}

export interface SchemaOrgPerformer {
  "@type": SchemaOrgPerformerType;
  name: string;
}

export interface SchemaOrgEvent {
  "@context": string;
  "@type": string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  eventStatus?: SchemaOrgEventStatus;
  eventAttendanceMode?: string;
  url?: string;
  image?: string[];
  location?: SchemaOrgPlace;
  organizer?: {
    "@type": string;
    name: string;
    url?: string;
  };
  offers?: SchemaOrgOffer;
  performer?: SchemaOrgPerformer;
}

export interface PageSeoDescriptor {
  title: string;
  description: string;
  contentHtml: string;
  exportablePath?: string;
  robots?: string;
  httpStatus?: number;
  redirectTo?: string;
  imageUrl?: string;
  openGraphType?: OpenGraphType;
  structuredData?: SchemaOrgEvent;
}
