const banner = require("../models/banner");
const controller = require("./crud-controller").create(banner);
exports.create = controller.create;
exports.all = controller.all;
exports.delete = controller.delete;
