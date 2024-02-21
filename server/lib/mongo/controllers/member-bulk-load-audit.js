const memberBulkLoadAudit = require("../models/member-bulk-load-audit");
const controller = require("./crud-controller").create(memberBulkLoadAudit);
exports.create = controller.create
exports.all = controller.all
exports.deleteOne = controller.deleteOne
