import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const riskAssessmentRecord = new mongoose.Schema({
  confirmationText: {type: String},
  memberId: {type: String},
  confirmed: {type: Boolean},
  confirmationDate: {type: Number},
  riskAssessmentKey: {type: String}
}, {_id: false});

const metaData = new mongoose.Schema({
  code: {type: String},
  description: {type: String}
}, {_id: false});

const locationDetails = new mongoose.Schema({
  latitude: {type: Number},
  longitude: {type: Number},
  grid_reference_6: {type: String},
  grid_reference_8: {type: String},
  grid_reference_10: {type: String},
  postcode: {type: String},
  description: {type: String},
  w3w: {type: String}
}, {_id: false});


const walkEvent = new mongoose.Schema({
  data: {type: Object},
  eventType: {type: String},
  date: {type: Number},
  memberId: {type: String},
  notes: {type: String},
  description: {type: String},
  reason: {type: String}
}, {_id: false});

const walkVenue = new mongoose.Schema({
  venuePublish: {type: Boolean},
  type: {type: String},
  name: {type: String},
  address1: {type: String},
  address2: {type: String},
  postcode: {type: String},
  lat: {type: Number},
  lon: {type: Number},
  url: {type: String}
}, {_id: false});

const mediaStyle = new mongoose.Schema({
  style: {type: String},
  url: {type: String},
  width: {type: Number},
  height: {type: Number}
}, {_id: false});

const media = new mongoose.Schema({
  alt: {type: String},
  title: {type: String},
  credit: {type: String},
  caption: {type: String},
  styles: [mediaStyle]
}, {_id: false});

const filterParameters = {
  selectType: {type: Number},
  ascending: {type: Boolean},
};

const imageConfig = {
  source: {type: String},
  importFrom: {
    areaCode: {type: String},
    groupCode: {type: String},
    filterParameters,
    walkId: {type: String}
  }
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
  ramblersWalkId: {type: String},
  ramblersWalkUrl: {type: String},
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
  imageConfig
}, {collection: "walks"});

walkSchema.plugin(uniqueValidator);

export const walk: mongoose.Model<mongoose.Document> = mongoose.model("walks", walkSchema);
