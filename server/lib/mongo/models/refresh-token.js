const mongoose = require("mongoose");

const refreshTokenSchema = mongoose.Schema({
  refreshToken: {type: String, required: true},
  memberPayload: {type: Object, required: true}
}, {collection: "refreshTokens"});

module.exports = mongoose.model("refresh-token", refreshTokenSchema);
