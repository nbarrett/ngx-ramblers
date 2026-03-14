import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { Booking, BookingStatus } from "../../../../projects/ngx-ramblers/src/app/models/booking.model";

const attendeeSchema = new mongoose.Schema({
  displayName: {type: String, required: true},
  email: {type: String, required: true},
  contactId: {type: String},
  memberId: {type: String},
  phone: {type: String}
}, {_id: false});

const bookingSchema = new mongoose.Schema({
  eventIds: [{type: String, required: true}],
  attendees: [attendeeSchema],
  createdAt: {type: Number, required: true},
  status: {type: String, default: BookingStatus.ACTIVE},
  cancelledAt: {type: Number},
  waitlistedAt: {type: Number},
  waitlistedReason: {type: String},
  restoredAt: {type: Number},
  memberBooking: {type: Boolean, default: false},
  reminderSentAt: {type: Number}
}, {collection: "bookings"});

bookingSchema.plugin(uniqueValidator);

export const booking: mongoose.Model<Booking> = ensureModel<Booking>("booking", bookingSchema);
