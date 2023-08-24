const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const authSchema = mongoose.Schema({
  groupMember: {type: Boolean},
  expiredPassword: {type: Boolean},
  userName: {type: String, required: true, unique: true},
  password: {type: String},
  walkAdmin: {type: Boolean},
  socialAdmin: {type: Boolean},
  socialMember: {type: Boolean},
  contentAdmin: {type: Boolean},
  memberAdmin: {type: Boolean},
  financeAdmin: {type: Boolean},
  committee: {type: Boolean},
  treasuryAdmin: {type: Boolean},
  fileAdmin: {type: Boolean},
  firstName: {type: String, required: true},
  postcode: {type: String},
  lastName: {type: String, required: true},
  profileSettingsConfirmed: {type: Boolean},
  email: {type: String},
  passwordResetId: {type: String}
}, {collection: "members"});

authSchema.plugin(uniqueValidator);

module.exports = mongoose.model("member-auth", authSchema);

