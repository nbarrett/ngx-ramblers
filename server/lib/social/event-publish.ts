import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { socialPublication } from "../mongo/models/social-publication";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { WalkStatus } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {
  EventPublishOutcome,
  EventPublishResult,
  FacebookPostStyle,
  PublishableEvent,
  ResolvedAlbumImage,
  SocialNetwork,
  SocialPublication,
  SocialPublishResult
} from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";
import { eventImages } from "../shared/event-images";
import { applyImageSourceTo } from "../../../projects/ngx-ramblers/src/app/functions/media";
import { publishToFacebookPage } from "../facebook/facebook-publish";
import { publishEventToInstagram } from "../instagram/instagram-publish";
import { buildEventCaption, captionFingerprint, eventCaptionInputFrom } from "./event-caption-builder";
import { eventUrlFor } from "../shared/event-url";
import { dateTimeFromMillis, dateTimeNowAsValue } from "../shared/dates";
import { GroupEventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { delay } from "./graph-api";

const debugLog = debug(envConfig.logNamespace("social:event-publish"));
debugLog.enabled = true;

const PUBLISH_DELAY_MILLIS = 2000;
const MAXIMUM_PUBLISHABLE_EVENTS = 200;
const PUBLISHABLE_EVENT_SELECT = [
  GroupEventField.TITLE,
  GroupEventField.DESCRIPTION,
  GroupEventField.STATUS,
  GroupEventField.URL,
  GroupEventField.ITEM_TYPE,
  GroupEventField.START_DATE,
  GroupEventField.START_LOCATION,
  GroupEventField.LOCATION,
  GroupEventField.MEDIA,
  GroupEventField.DISTANCE_MILES,
  GroupEventField.DIFFICULTY,
  "fields.contactDetails.displayName"
].join(" ");

export function effectivePostStyle(config: SystemConfig, imageCount: number): FacebookPostStyle {
  const configured = config?.externalSystems?.facebook?.eventPostStyle || FacebookPostStyle.PHOTO_WITH_LINK;
  return configured === FacebookPostStyle.LINK_PREVIEW || imageCount === 0
    ? FacebookPostStyle.LINK_PREVIEW
    : FacebookPostStyle.PHOTO_WITH_LINK;
}

function eventCancelled(event: ExtendedGroupEvent): boolean {
  return event?.groupEvent?.status === WalkStatus.CANCELLED;
}

async function publicationFor(eventId: string, network: SocialNetwork): Promise<SocialPublication> {
  return await socialPublication.findOne({eventId, network}).sort({publishedAt: -1}).lean().exec() as unknown as SocialPublication;
}

export async function captionFor(event: ExtendedGroupEvent, config: SystemConfig, baseUrl: string): Promise<string> {
  const eventUrl = eventUrlFor(event, config?.group, baseUrl);
  return buildEventCaption(eventCaptionInputFrom(event, eventUrl), config?.externalSystems?.facebook?.eventCaptionTemplate);
}

function assertEventPublishingConfigured(config: SystemConfig, network: SocialNetwork): void {
  const facebook = config?.externalSystems?.facebook;
  const instagram = config?.externalSystems?.instagram;
  if (network === SocialNetwork.FACEBOOK) {
    if (!facebook?.eventPublishingEnabled) {
      throw new Error("Publishing walks and social events to Facebook is switched off in System Settings");
    } else if (!facebook?.publishingEnabled) {
      throw new Error("Facebook publishing is disabled in System Settings");
    }
  } else if (!instagram?.eventPublishingEnabled) {
    throw new Error("Publishing walks and social events to Instagram is switched off in System Settings");
  } else if (!instagram?.publishingEnabled) {
    throw new Error("Instagram publishing is disabled in System Settings");
  }
}

async function publishToNetwork(
  network: SocialNetwork,
  config: SystemConfig,
  images: ResolvedAlbumImage[],
  caption: string,
  link: string
): Promise<SocialPublishResult> {
  if (network === SocialNetwork.FACEBOOK) {
    return publishToFacebookPage(config?.externalSystems?.facebook, {
      images,
      caption,
      link,
      postStyle: effectivePostStyle(config, images.length)
    });
  } else {
    return publishEventToInstagram(
      config?.externalSystems?.instagram,
      config?.externalSystems?.facebook?.pageAccessToken,
      images,
      caption
    );
  }
}

export async function publishEventToNetwork(
  eventId: string,
  network: SocialNetwork,
  config: SystemConfig,
  baseUrl: string,
  republishChanged: boolean
): Promise<EventPublishResult> {
  const event = await extendedGroupEvent.findById(eventId).lean().exec() as ExtendedGroupEvent;
  if (!event) {
    return {eventId, network, outcome: EventPublishOutcome.FAILED, error: `No event found with id ${eventId}`};
  } else {
    const caption = await captionFor(event, config, baseUrl);
    const fingerprint = captionFingerprint(caption);
    const existing = await publicationFor(eventId, network);
    const unchanged = existing?.captionFingerprint === fingerprint;
    if (existing && unchanged) {
      return {
        eventId,
        eventTitle: event.groupEvent?.title,
        network,
        outcome: EventPublishOutcome.UNCHANGED,
        postId: existing.postId,
        permalink: existing.permalink
      };
    } else if (existing && !republishChanged) {
      return {
        eventId,
        eventTitle: event.groupEvent?.title,
        network,
        outcome: EventPublishOutcome.ALREADY_PUBLISHED,
        postId: existing.postId,
        permalink: existing.permalink
      };
    } else {
      const images = eventImages(event, baseUrl);
      const link = eventUrlFor(event, config?.group, baseUrl);
      const result = await publishToNetwork(network, config, images, caption, link);
      await socialPublication.create({
        eventId,
        eventTitle: event.groupEvent?.title,
        captionFingerprint: fingerprint,
        network,
        postId: result.postId,
        permalink: result.permalink,
        imageCount: result.imageCount,
        caption,
        publishedAt: dateTimeNowAsValue()
      });
      debugLog("published event:", eventId, "to", network, "title:", event.groupEvent?.title, "postId:", result.postId);
      return {
        eventId,
        eventTitle: event.groupEvent?.title,
        network,
        outcome: existing ? EventPublishOutcome.REPUBLISHED : EventPublishOutcome.PUBLISHED,
        postId: result.postId,
        permalink: result.permalink,
        caption
      };
    }
  }
}

export async function publishEventsToNetworks(
  eventIds: string[],
  networks: SocialNetwork[],
  config: SystemConfig,
  baseUrl: string,
  republishChanged: boolean
): Promise<EventPublishResult[]> {
  networks.forEach(network => assertEventPublishingConfigured(config, network));
  const jobs = networks.flatMap(network => eventIds.map(eventId => ({eventId, network})));
  const results: EventPublishResult[] = [];
  for (const job of jobs) {
    if (results.length > 0) {
      await delay(PUBLISH_DELAY_MILLIS);
    }
    try {
      results.push(await publishEventToNetwork(job.eventId, job.network, config, baseUrl, republishChanged));
    } catch (error) {
      debugLog("publish failed for event:", job.eventId, "network:", job.network, "error:", error);
      results.push({
        eventId: job.eventId,
        network: job.network,
        outcome: EventPublishOutcome.FAILED,
        error: error?.message || String(error)
      });
    }
  }
  return results;
}

export async function attachImageToEvent(eventId: string, awsFileName: string): Promise<ExtendedGroupEvent> {
  const event = await extendedGroupEvent.findById(eventId).lean().exec() as ExtendedGroupEvent;
  if (!event) {
    throw new Error(`No event found with id ${eventId}`);
  } else {
    const groupEvent = {...event.groupEvent, media: event.groupEvent?.media || []};
    applyImageSourceTo(groupEvent, groupEvent.title, awsFileName);
    debugLog("attaching image", awsFileName, "to event", eventId, "media count now", groupEvent.media.length);
    return await extendedGroupEvent
      .findByIdAndUpdate(eventId, {$set: {[GroupEventField.MEDIA]: groupEvent.media}}, {new: true})
      .lean().exec() as ExtendedGroupEvent;
  }
}

export async function publishableEventById(
  eventId: string,
  config: SystemConfig,
  baseUrl: string,
  previewBaseUrl: string
): Promise<PublishableEvent> {
  const event = await extendedGroupEvent.findById(eventId).lean().exec() as ExtendedGroupEvent;
  if (event) {
    const publications = await socialPublication.find({eventId}).lean().exec() as unknown as SocialPublication[];
    return await publishableEventFrom(event, publications, config, baseUrl, previewBaseUrl);
  } else {
    return null;
  }
}

export async function publishableEventsBetween(
  fromDate: number,
  toDate: number,
  config: SystemConfig,
  baseUrl: string,
  previewBaseUrl: string
): Promise<PublishableEvent[]> {
  const events = await extendedGroupEvent
    .find({[GroupEventField.START_DATE]: {$gte: dateTimeFromMillis(fromDate).toISO(), $lte: dateTimeFromMillis(toDate).toISO()}})
    .select(PUBLISHABLE_EVENT_SELECT)
    .sort({[GroupEventField.START_DATE]: 1})
    .limit(MAXIMUM_PUBLISHABLE_EVENTS)
    .lean().exec() as ExtendedGroupEvent[];
  if (events.length === MAXIMUM_PUBLISHABLE_EVENTS) {
    debugLog("publishable events truncated at", MAXIMUM_PUBLISHABLE_EVENTS, "- narrow the date range to see the rest");
  }
  const publications = await socialPublication
    .find({eventId: {$in: events.map(event => event.id || (event as any)._id?.toString())}, network: SocialNetwork.FACEBOOK})
    .lean().exec() as unknown as SocialPublication[];
  return await Promise.all(events.map(event => publishableEventFrom(event, publications, config, baseUrl, previewBaseUrl)));
}

export async function publishableEventFrom(
  event: ExtendedGroupEvent,
  publications: SocialPublication[],
  config: SystemConfig,
  baseUrl: string,
  previewBaseUrl: string
): Promise<PublishableEvent> {
  const eventId = event.id || (event as any)._id?.toString();
  const publication = publications.find(candidate => candidate.eventId === eventId);
  const caption = await captionFor(event, config, baseUrl);
  const images = eventImages(event, baseUrl);
  const previewImages = eventImages(event, previewBaseUrl || baseUrl);
  return {
    eventId,
    title: event.groupEvent?.title,
    startDateTime: event.groupEvent?.start_date_time,
    itemType: event.groupEvent?.item_type,
    cancelled: eventCancelled(event),
    imageCount: images.length,
    imageUrl: previewImages[0]?.url,
    imageUrls: previewImages.map(image => image.url),
    url: eventUrlFor(event, config?.group, baseUrl),
    caption,
    postStyle: effectivePostStyle(config, images.length),
    publication,
    captionChanged: !!publication && publication.captionFingerprint !== captionFingerprint(caption)
  };
}
