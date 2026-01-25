import expect from "expect";
import {describe, it} from "mocha";
import * as transforms from "./transforms";
import mongoose from "mongoose";

describe("transforms.convertIdStringsToObjectId", () => {
  it("converts simple _id string to ObjectId", done => {
    const validId = "507f1f77bcf86cd799439011";
    const criteria = { _id: validId };
    const result = transforms.convertIdStringsToObjectId(criteria);
    expect(result._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(result._id.toString()).toEqual(validId);
    done();
  });

  it("converts _id in $or clause", done => {
    const validId = "507f1f77bcf86cd799439011";
    const criteria = {
      $or: [
        { _id: validId },
        { "groupEvent.id": validId },
        { "fields.migratedFromId": validId }
      ]
    };
    const result = transforms.convertIdStringsToObjectId(criteria);
    expect(result.$or[0]._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(result.$or[0]._id.toString()).toEqual(validId);
    expect(result.$or[1]["groupEvent.id"]).toEqual(validId);
    expect(result.$or[2]["fields.migratedFromId"]).toEqual(validId);
    done();
  });

  it("converts _id in $in clause", done => {
    const validId1 = "507f1f77bcf86cd799439011";
    const validId2 = "507f1f77bcf86cd799439012";
    const criteria = { _id: { $in: [validId1, validId2] } };
    const result = transforms.convertIdStringsToObjectId(criteria);
    expect(result._id.$in[0]).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(result._id.$in[1]).toBeInstanceOf(mongoose.Types.ObjectId);
    done();
  });

  it("leaves non-ObjectId strings unchanged", done => {
    const criteria = {
      $or: [
        { _id: "not-an-objectid" },
        { "groupEvent.id": "100356620" }
      ]
    };
    const result = transforms.convertIdStringsToObjectId(criteria);
    expect(result.$or[0]._id).toEqual("not-an-objectid");
    expect(result.$or[1]["groupEvent.id"]).toEqual("100356620");
    done();
  });

  it("handles null and undefined criteria", done => {
    expect(transforms.convertIdStringsToObjectId(null)).toBeNull();
    expect(transforms.convertIdStringsToObjectId(undefined)).toBeUndefined();
    done();
  });
});

describe("transforms.mongoIdCriteria", () => {
  it("transforms request with req.params.id", done => {
    const validId = "507f1f77bcf86cd799439011";
    expect(transforms.mongoIdCriteria({ params: { id: validId } } as any)).toEqual({
      "_id": new mongoose.Types.ObjectId(validId)
    });
    done();
  });

  it("transforms document with id", done => {
    const validId = "507f1f77bcf86cd799439011";
    expect(transforms.mongoIdCriteria({ id: validId })).toEqual({
      "_id": new mongoose.Types.ObjectId(validId)
    });
    done();
  });

  it("transforms request with body with id", done => {
    const validId = "507f1f77bcf86cd799439011";
    expect(transforms.mongoIdCriteria({ body: { id: validId } })).toEqual({
      "_id": new mongoose.Types.ObjectId(validId)
    });
    done();
  });

  it("transforms document with field-based criteria", done => {
    const refreshToken = "tXvumMGUAgoxgBwxaosFux0TLZVZiYncpQTovVuZqdIdSqSjoV2U";
    const json = { refreshToken };
    expect(transforms.mongoIdCriteria({ body: json })).toEqual(json);
    done();
  });
});
