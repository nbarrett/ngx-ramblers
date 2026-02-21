import mongoose, { Model, Schema } from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { media, metaData, riskAssessmentRecord, walkEvent, walkVenue } from "./walk";
import { notification } from "./social-event";
import { fileNameData } from "./banner";
import { EventSource, ExtendedGroupEvent } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { WalkStatus } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { EventType, GroupEventField, DocumentField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { isArray, values } from "es-toolkit/compat";

const groupEvent = new Schema({
  id: {type: String},
  item_type: {type: String},
  title: {type: String},
  group_code: {type: String},
  area_code: {type: String},
  group_name: {type: String},
  description: {type: String},
  additional_details: {type: String},
  start_date_time: {type: String},
  end_date_time: {type: String},
  meeting_date_time: {type: String},
  event_organiser: {type: Object},
  location: {type: Object},
  start_location: {type: Object},
  meeting_location: {type: Object},
  end_location: {type: Object},
  distance_km: {type: Number},
  distance_miles: {type: Number},
  ascent_feet: {type: Number},
  ascent_metres: {type: Number},
  difficulty: metaData,
  shape: {type: String},
  duration: {type: Number},
  walk_leader: {type: Object},
  url: {type: String},
  external_url: {type: String},
  status: {type: String},
  cancellation_reason: {type: String},
  accessibility: [metaData],
  facilities: [metaData],
  transport: [metaData],
  media: [media],
  linked_event: {type: String},
  date_created: {type: String},
  date_updated: {type: String}
}, {_id: false});

const contactDetailsSchema = new Schema({
  contactId: {type: String},
  memberId: {type: String},
  displayName: {type: String},
  email: {type: String},
  phone: {type: String}
}, {_id: false});

const publishing = new Schema({
  meetup: {
    contactName: {type: String},
    publish: {type: Boolean}
  },
  ramblers: {
    contactName: {type: String},
    publish: {type: Boolean}
  }
}, {_id: false});

const linkWithSourceSchema = new Schema({
  source: {type: String},
  href: {type: String},
  title: {type: String}
}, {_id: false});

const imageConfig = new Schema({
  source: {type: String},
  importFrom: {
    areaCode: {type: String},
    groupCode: {type: String},
    filterParameters: {
      selectType: {type: String},
      ascending: {type: Boolean}
    },
    walkId: {type: String}
  }
}, {_id: false});

const meetup = new Schema({
  defaultContent: {type: String},
  publishStatus: {type: String},
  guestLimit: {type: Number},
  announce: {type: Boolean}
}, {_id: false});

const fields = new Schema({
  migratedFromId: {type: String},
  attachment: fileNameData,
  attendees: [{type: Object}],
  contactDetails: contactDetailsSchema,
  imageConfig,
  links: [linkWithSourceSchema],
  meetup,
  milesPerHour: {type: Number},
  notifications: [notification],
  publishing,
  riskAssessment: [riskAssessmentRecord],
  venue: walkVenue,
  inputSource: {type: String},
  gpxFile: fileNameData
}, {_id: false});

const extendedGroupEventSchema = new Schema({
  groupEvent,
  fields,
  events: [walkEvent],
  source: {
    type: String,
    enum: values(EventSource),
    default: EventSource.LOCAL
  },
  lastSyncedAt: {type: Date},
  ramblersId: {type: String},
  syncedVersion: {type: Number, default: 1}
});
groupEvent.index({start_date_time: 1, item_type: 1, title: 1, group_code: 1}, {unique: true});
extendedGroupEventSchema.index({[DocumentField.SOURCE]: 1, [DocumentField.RAMBLERS_ID]: 1});
extendedGroupEventSchema.index({[DocumentField.RAMBLERS_ID]: 1}, {unique: true, sparse: true});
extendedGroupEventSchema.index({[DocumentField.LAST_SYNCED_AT]: 1});
extendedGroupEventSchema.index({[GroupEventField.START_DATE]: 1});
extendedGroupEventSchema.index({[GroupEventField.WALK_LEADER_ID]: 1});
extendedGroupEventSchema.index({[GroupEventField.START_LOCATION_COORDINATES]: "2dsphere"});
extendedGroupEventSchema.plugin(uniqueValidator);

extendedGroupEventSchema.pre("save", function(next) {
  deriveStatusFromEvents(this);
  next();
});

extendedGroupEventSchema.pre("findOneAndUpdate", function(next) {
  const update = this.getUpdate() as any;
  if (update?.events) {
    const doc = {events: update.events, groupEvent: update.groupEvent || {}};
    deriveStatusFromEvents(doc);
    update.groupEvent = doc.groupEvent;
  }
  next();
});

function deriveStatusFromEvents(doc: any) {
  if (!doc.events || !isArray(doc.events) || doc.events.length === 0) {
    return;
  }

  const statusChangeEventTypes = [
    EventType.APPROVED,
    EventType.DELETED,
    EventType.AWAITING_LEADER,
    EventType.AWAITING_WALK_DETAILS,
    EventType.AWAITING_APPROVAL
  ];
  const statusChangeEvents = doc.events.filter((event: any) =>
    statusChangeEventTypes.includes(event.eventType)
  );

  if (statusChangeEvents.length === 0) {
    return;
  }

  const latestEvent = statusChangeEvents[statusChangeEvents.length - 1];

  if (!doc.groupEvent) {
    doc.groupEvent = {};
  }

  switch (latestEvent.eventType) {
    case EventType.APPROVED:
      doc.groupEvent.status = WalkStatus.CONFIRMED;
      break;
    case EventType.DELETED:
      doc.groupEvent.status = "deleted";
      break;
    default:
      doc.groupEvent.status = WalkStatus.DRAFT;
  }
}

export const extendedGroupEvent: Model<ExtendedGroupEvent> = ensureModel<ExtendedGroupEvent>("extendedGroupEvents", extendedGroupEventSchema);
