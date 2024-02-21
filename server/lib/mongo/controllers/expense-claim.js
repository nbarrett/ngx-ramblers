const expenseclaim = require("../models/expense-claim");
const controller = require("./crud-controller").create(expenseclaim);
exports.create = controller.create;
exports.all = controller.all;
exports.deleteOne = controller.deleteOne;
