const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const MailchimpSubscription = {
  subscribed: {type: Boolean},
  updated: {type: Boolean},
  leid: {type: String},
  web_id: {type: Number},
  unique_email_id: {type: String},
  lastUpdated: {type: Number},
  email: {type: String}
}

const memberSchema = mongoose.Schema({
  userName: {type: String, required: true, unique: true},
  expiredPassword: {type: Boolean},
  groupMember: {type: Boolean},
  password: {type: String},
  nameAlias: {type: String},
  email: {type: String},
  mobileNumber: {type: String},
  displayName: {type: String, required: true},
  contactId: {type: String},
  firstName: {type: String, required: true},
  lastName: {type: String, required: true},
  memberAdmin: {type: Boolean},
  membershipExpiryDate: {type: Number},
  membershipNumber: {type: String},
  postcode: {type: String},
  socialAdmin: {type: Boolean},
  socialMember: {type: Boolean},
  userAdmin: {type: Boolean},
  walkAdmin: {type: Boolean},
  mailchimpLists: {
    walks: MailchimpSubscription,
    socialEvents: MailchimpSubscription,
    general: MailchimpSubscription,
  },
  contentAdmin: {type: Boolean},
  passwordResetId: {type: String},
  financeAdmin: {type: Boolean},
  mailchimpSegmentIds: {
    directMail: {type: Number},
    expenseApprover: {type: Number},
    expenseTreasurer: {type: Number},
    walkLeader: {type: Number},
    walkCoordinator: {type: Number},
    walks: {type: Number},
    general: {type: Number},
    socialEvents: {type: Number},
  },
  treasuryAdmin: {type: Boolean},
  fileAdmin: {type: Boolean},
  committee: {type: Boolean},
  profileSettingsConfirmed: {type: Boolean},
  profileSettingsConfirmedAt: {type: Number},
  profileSettingsConfirmedBy: {type: String},
  walkChangeNotifications: {type: Boolean},
  receivedInLastBulkLoad: {type: Boolean},
  lastBulkLoadDate: {type: Number},
  createdDate: {type: Number},
  createdBy: {type: String},
  updatedDate: {type: Number},
  updatedBy: {type: String},
  assembleId: {type: Number},
}, {collection: "members"});

memberSchema.plugin(uniqueValidator);

module.exports = mongoose.model("member", memberSchema);

