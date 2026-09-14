import mongoose from "mongoose";
import { values } from "es-toolkit/compat";
import { ConfigDocument, ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { SetupStepStatus } from "../../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import {
  RegistrationPageType,
  RegistrationPlan,
  RegistrationSiteFlavour,
  RegistrationState,
  RegistrationStep,
  StoredSiteRegistration
} from "../../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { ensureModel } from "../utils/model-utils";

const reviewerSchema = new mongoose.Schema({
  firstName: {type: String, required: true},
  lastName: {type: String, required: true},
  email: {type: String, required: true}
}, {_id: false});

const registrationEmailApprovalSchema = new mongoose.Schema({
  groupCode: {type: String, required: true},
  emails: {type: [String], required: true, default: []}
}, {_id: false});

const registrationSettingsValueSchema = new mongoose.Schema({
  enabled: {type: Boolean, required: true, default: false},
  committeeEmailValidationEnabled: {type: Boolean, required: true, default: true},
  sourceFidelityValidationEnabled: {type: Boolean, required: true, default: true},
  publicUrl: {type: String, required: true},
  senderEmail: {type: String, required: true},
  reviewer: {type: reviewerSchema, required: true},
  sourceEnvironmentName: {type: String, required: true},
  approvedEmails: {type: [registrationEmailApprovalSchema], required: true, default: []}
}, {_id: false});

const siteRegistrationSettingsSchema = new mongoose.Schema({
  key: {type: String, required: true, unique: true, enum: [ConfigKey.SITE_REGISTRATION], default: ConfigKey.SITE_REGISTRATION},
  value: {type: registrationSettingsValueSchema, required: true}
}, {collection: "config"});

const ramblersGroupSchema = new mongoose.Schema({
  scope: {type: String, required: true},
  group_code: {type: String, required: true},
  area_code: {type: String, required: true},
  groups_in_area: {type: [String], required: true, default: []},
  name: {type: String, required: true},
  url: {type: String, required: true},
  external_url: {type: String, required: true},
  description: {type: String, required: true},
  latitude: {type: Number, required: true},
  longitude: {type: Number, required: true},
  date_updated: {type: String, required: true},
  date_walks_events_updated: {type: String, required: true}
}, {_id: false});

const registrationPageSchema = new mongoose.Schema({
  url: {type: String, required: true},
  path: {type: String, required: true},
  title: {type: String, required: true},
  type: {type: String, required: true, enum: values(RegistrationPageType)},
  selected: {type: Boolean, required: true},
  parentPath: {type: String, default: null},
  proposed: {type: Boolean, required: true}
}, {_id: false});

const registrationNavigationSchema = new mongoose.Schema({
  path: {type: String, required: true},
  title: {type: String, required: true}
}, {_id: false});

const registrationProgressSchema = new mongoose.Schema({
  step: {type: String, required: true},
  status: {type: String, required: true, enum: values(SetupStepStatus)},
  message: {type: String},
  timestamp: {type: Number}
}, {_id: false});

const siteRegistrationSchema = new mongoose.Schema({
  id: {type: String, required: true, unique: true},
  group: {type: ramblersGroupSchema, required: true},
  email: {type: String, required: true},
  plan: {type: String, required: true, enum: values(RegistrationPlan)},
  currentStep: {type: String, required: true, enum: values(RegistrationStep)},
  website: {type: String, required: true},
  pages: {type: [registrationPageSchema], required: true, default: []},
  proposedNavigation: {type: [registrationNavigationSchema], required: true, default: []},
  state: {type: String, required: true, enum: values(RegistrationState)},
  verifiedAt: {type: Number, default: null},
  createdAt: {type: Number, required: true},
  updatedAt: {type: Number, required: true},
  environmentName: {type: String, required: true},
  siteUrl: {type: String, default: null},
  flavour: {type: String, required: true, enum: values(RegistrationSiteFlavour)},
  progress: {type: [registrationProgressSchema], required: true, default: []},
  error: {type: String, default: null},
  resumeTokenHash: {type: String, required: true, unique: true},
  verificationTokenHash: {type: String, required: true},
  verificationExpiresAt: {type: Number, required: true},
  lastEmailAt: {type: Number, required: true},
  migrationConfig: {type: mongoose.Schema.Types.Mixed, default: null},
  provisionedAt: {type: Number, default: null},
  importedAt: {type: Number, default: null},
  walksLoadedAt: {type: Number, default: null},
  reviewedAt: {type: Number, default: null},
  reviewNotifiedAt: {type: Number, default: null},
  invitedAt: {type: Number, default: null},
  leaseUntil: {type: Number, required: true},
  leaseOwner: {type: String, default: null}
}, {collection: "siteRegistrations"});

export const siteRegistrationConfig = ensureModel<ConfigDocument>("site-registration-config", siteRegistrationSettingsSchema);
export const siteRegistration = ensureModel<StoredSiteRegistration>("site-registration", siteRegistrationSchema);
