import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { ContactInteraction } from "../../../../projects/ngx-ramblers/src/app/models/booking.model";

const contactInteractionSchema = new mongoose.Schema({
  eventId: {type: String},
  name: {type: String, required: true},
  email: {type: String},
  subject: {type: String, required: true},
  message: {type: String, required: true},
  anonymous: {type: Boolean, default: false},
  recipientRole: {type: String},
  createdAt: {type: Number, required: true},
  status: {type: String, default: "new"}
}, {collection: "contactInteractions"});

contactInteractionSchema.plugin(uniqueValidator);

export const contactInteraction: mongoose.Model<ContactInteraction> = ensureModel<ContactInteraction>("contact-interaction", contactInteractionSchema);
