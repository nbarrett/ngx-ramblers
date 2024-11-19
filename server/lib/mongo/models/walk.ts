import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const riskAssessmentRecord = {
  confirmationText: {type: String},
  memberId: {type: String},
  confirmed: {type: Boolean},
  confirmationDate: {type: Number},
  riskAssessmentKey: {type: String},
};

const metaData = {
  code: {type: String},
  description: {type: String},
};

const locationDetails = {
  latitude: {type: Number},
  longitude: {type: Number},
  grid_reference_6: {type: String},
  grid_reference_8: {type: String},
  grid_reference_10: {type: String},
  postcode: {type: String},
  description: {type: String},
  w3w: {type: String},
};


const walkEvent = {
  data: {type: Object},
  eventType: {type: String},
  date: {type: Number},
  memberId: {type: String},
  notes: {type: String},
  description: {type: String},
  reason: {type: String}
};

const walkVenue = {
  venuePublish: {type: Boolean},
  type: {type: String},
  name: {type: String},
  address1: {type: String},
  address2: {type: String},
  postcode: {type: String},
  lat: {type: Number},
  lon: {type: Number},
  url: {type: String}
};

const mediaStyle = {
  style: {type: String},
  url: {type: String},
  width: {type: Number},
  height: {type: Number}
};

const media = {
  alt: {type: String},
  styles: [mediaStyle]
};

const walkSchema = new mongoose.Schema({
  contactName: {type: String},
  walkType: {type: String},
  briefDescriptionAndStartPoint: {type: String},
  contactEmail: {type: String},
  contactId: {type: String},
  contactPhone: {type: String},
  displayName: {type: String},
  distance: {type: String},
  finishTime: {type: String},
  milesPerHour: {type: Number},
  ascent: {type: String},
  events: [walkEvent],
  grade: {type: String},
  gridReference: {type: String},
  gridReferenceFinish: {type: String},
  location: {type: String},
  longerDescription: {type: String},
  config: {
    meetup: {
      defaultContent: {type: String},
      publishStatus: {type: String},
      guestLimit: {type: Number},
      announce: {type: Boolean}
    }
  },
  meetupEventTitle: {type: String},
  meetupEventDescription: {type: String},
  meetupEventUrl: {type: String},
  meetupPublish: {type: Boolean},
  nearestTown: {type: String},
  osMapsRoute: {type: String},
  osMapsTitle: {type: String},
  postcode: {type: String},
  postcodeFinish: {type: String},
  ramblersWalkId: {type: String},
  ramblersWalkUrl: {type: String},
  startLocationW3w: {type: String},
  ramblersPublish: {type: Boolean},
  startTime: {type: String},
  walkDate: {type: Number},
  walkLeaderMemberId: {type: String},
  venue: walkVenue,
  riskAssessment: [riskAssessmentRecord],
  media: [media],
  features: [metaData],
  start_location: locationDetails,
  meeting_location: locationDetails,
  end_location: locationDetails,
}, {collection: "walks"});

walkSchema.plugin(uniqueValidator);

export const walk: mongoose.Model<mongoose.Document> = mongoose.model("walks", walkSchema);
