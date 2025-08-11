import expect from "expect";
import {describe, it} from "mocha";
import * as transforms from "./transforms";
import mongoose from "mongoose";

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
