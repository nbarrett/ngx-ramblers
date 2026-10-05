import {Db, ObjectId} from "mongodb";
import expect from "expect";
import {describe, it} from "mocha";
import sinon from "sinon";
import {up} from "./20261005090000-default-null-reply-to-to-sender";
import {CONFIG_COLLECTION, NOTIFICATION_CONFIG_COLLECTION} from "../shared/collection-names";
import {ConfigKey} from "../../../../../projects/ngx-ramblers/src/app/models/config.model";

describe("unset reply-to defaults migration", () => {
  it("recognises built-in processes and normalises unset or matching reply-to roles to the Same as sender option", async () => {
    const configId = "000000000000000000000001";
    const findOne = sinon.stub();
    findOne.withArgs({key: ConfigKey.BREVO}).resolves({value: {forgotPasswordNotificationConfigId: configId}});
    findOne.withArgs({key: ConfigKey.COMMITTEE}).resolves({value: {roles: [
      {type: "support", email: "support@group.example.org.uk"},
      {type: "vacant", email: ""}
    ]}});
    const updateMany = sinon.stub().resolves({modifiedCount: 2});
    const countDocuments = sinon.stub().resolves(1);
    const collection = sinon.stub();
    collection.withArgs(CONFIG_COLLECTION).returns({findOne});
    collection.withArgs(NOTIFICATION_CONFIG_COLLECTION).returns({updateMany, countDocuments});
    await up({collection} as unknown as Db, null);
    expect(countDocuments.firstCall.args).toEqual([{_id: {$in: [new ObjectId(configId)]}, senderRole: {$nin: ["support"]}}]);
    expect(updateMany.firstCall.args).toEqual([
      {$or: [{replyToRole: null}, {replyToRole: /^\s*$/}, {$expr: {$eq: ["$replyToRole", "$senderRole"]}}], senderRole: {$in: ["support"]}},
      {$set: {replyToRole: ""}}
    ]);
  });
});
