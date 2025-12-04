import mongoose, { Model } from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const MailchimpSubscription = {
  subscribed: {type: Boolean},
  updated: {type: Boolean},
  leid: {type: String},
  web_id: {type: Number},
  unique_email_id: {type: String},
  lastUpdated: {type: Number},
  email: {type: String}
}

const MailSubscription = new mongoose.Schema({
  subscribed: {type: Boolean},
  id: {type: Number}
}, {_id: false});

const memberSchema = new mongoose.Schema({
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
  mail: {
    subscriptions: [MailSubscription],
    email: {type: String},
    id: {type: Number},
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
  createdDate: {type: Number},
  createdBy: {type: String},
  updatedDate: {type: Number},
  updatedBy: {type: String},
  assembleId: {type: Number},
  jointWith: {type: String},
  title: {type: String},
  type: {type: String},
  memberStatus: {type: String},
  memberTerm: {type: String},
  landlineTelephone: {type: String},
  emailMarketingConsent: {type: Boolean},
  emailPermissionLastUpdated: {type: Number},
}, {collection: "members"});

memberSchema.plugin(uniqueValidator);
export const member: Model<Member> = ensureModel<Member>("member", memberSchema);
