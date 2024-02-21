const mailchimpListAudit = require("../models/mailchimp-list-audit");
const controller = require("./crud-controller").create(mailchimpListAudit);
exports.create = controller.create;
exports.all = controller.all;
exports.deleteOne = controller.deleteOne;
