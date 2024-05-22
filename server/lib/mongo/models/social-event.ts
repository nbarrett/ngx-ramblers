import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const attendee = new mongoose.Schema({
  id: {type: String}
}, {_id: false});

const notificationContent = new mongoose.Schema({
  notificationConfig: {type: Object},
  addresseeType: {type: String},
  attachment: {include: {type: Boolean}, value: {type: String}},
  campaignId: {type: String},
  customCampaignType: {type: String},
  description: {include: {type: Boolean}, value: {type: String}},
  eventDetails: {include: {type: Boolean}, value: {type: String}},
  destinationType: {type: String},
  includeDownloadInformation: {type: Boolean},
  list: {type: String},
  attendees: {include: {type: Boolean}},
  recipients: {include: {type: Boolean}, value: [{type: String}]},
  replyTo: {include: {type: Boolean}, value: {type: String}},
  selectedMemberIds: [{type: String}],
  signoffAs: {include: {type: Boolean}, value: {type: String}},
  signoffText: {include: {type: Boolean}, value: {type: String}},
  text: {include: {type: Boolean}, value: {type: String}},
  title: {include: {type: Boolean}, value: {type: String}},
}, {_id: false});

const notification = {
  cancelled: {type: Boolean},
  content: notificationContent,
  groupEventsFilter: {type: Object},
  groupEvents: [{type: Object}]
}

const socialEventSchema = new mongoose.Schema({
  eventDate: {type: Number},
  attendees: [attendee],
  location: {type: String},
  briefDescription: {type: String},
  postcode: {type: String},
  eventTimeStart: {type: String},
  eventTimeEnd: {type: String},
  link: {type: String},
  linkTitle: {type: String},
  thumbnail: {type: String},
  notification,
  mailchimp: {
    segmentId: {type: Number},
    members: {
      success_count: {type: Number},
      error_count: {type: Number},
      errors: {type: Object},
    }
  },
  longerDescription: {type: String},
  eventContactMemberId: {type: String},
  displayName: {type: String},
  contactPhone: {type: String},
  contactEmail: {type: String},
  attachment: {
    originalFileName: {type: String},
    awsFileName: {type: String},
    title: {type: String},
  }
}, {collection: "socialEvents"});

socialEventSchema.plugin(uniqueValidator);

export const socialEvent: mongoose.Model<mongoose.Document> = mongoose.model("social-event", socialEventSchema);

