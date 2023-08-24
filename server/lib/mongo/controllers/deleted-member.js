const deletedMember = require("../models/deleted-member");
const controller = require("./crud-controller").create(deletedMember);
exports.create = controller.create;
exports.all = controller.all;
exports.delete = controller.delete;
