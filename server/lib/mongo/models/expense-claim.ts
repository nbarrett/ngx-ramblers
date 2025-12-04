import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { ExpenseClaim } from "../../../../projects/ngx-ramblers/src/app/notifications/expenses/expense.model";

const expenseType = {
  value: {type: String},
  name: {type: String},
  travel: {type: Boolean},
};

const expenseItem = {
  cost: {type: Number},
  description: {type: String},
  expenseType,
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

const expenseClaimSchema = new mongoose.Schema({
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

export const expenseClaim: mongoose.Model<ExpenseClaim> = ensureModel<ExpenseClaim>("expense-claim", expenseClaimSchema);
