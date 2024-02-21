const memberUpdateAudit = require("../models/member-update-audit");
const controller = require("./crud-controller").create(memberUpdateAudit);
exports.create = controller.create
exports.all = controller.all
exports.deleteOne = controller.deleteOne
