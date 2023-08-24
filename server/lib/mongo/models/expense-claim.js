const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const expenseType = {
  value: {type: String},
  name: {type: String},
  travel: {type: Boolean},
};

const expenseItem = {
  cost: {type: Number},
  description: {type: String},
  expenseType: expenseType,
  expenseDate: {type: Number},
  travel: {
    costPerMile: {type: Number},
    miles: {type: Number},
    from: {type: String},
    to: {type: String},
    returnJourney: {type: Boolean}
  },
  receipt: {
    awsFileName: {type: String},
    originalFileName: {type: String},
    title: {type: String},
    fileNameData: {type: Object}
  },
};

const expenseEventType = {
  description: {type: String},
  atEndpoint: {type: Boolean},
  actionable: {type: Boolean},
  editable: {type: Boolean},
  returned: {type: Boolean},
  notifyCreator: {type: Boolean},
  notifyApprover: {type: Boolean},
  notifyTreasurer: {type: Boolean},
};

const expenseEvent = {
  reason: {type: String},
  eventType: expenseEventType,
  date: {type: Number},
  memberId: {type: String},
};

const expenseClaimSchema = mongoose.Schema({
  expenseEvents: [expenseEvent],
  expenseItems: [expenseItem],
  cost: {type: Number},
  bankDetails: {
    accountName: {type: String},
    accountNumber: {type: String},
    sortCode: {type: String}
  }
}, {collection: "expenseClaims"});

expenseClaimSchema.plugin(uniqueValidator);

module.exports = mongoose.model("expense-claim", expenseClaimSchema);
