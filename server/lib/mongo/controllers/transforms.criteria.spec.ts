import { expect } from "chai";
import * as transforms from "./transforms";

describe("transforms.mongoIdCriteria", () => {
  it("transforms request with req.params.id", done => {

    expect(transforms.mongoIdCriteria({params: {id: "qaz123-params"}} as any)).to.eql({"_id": "qaz123-params"});
    done();
  });

  it("transforms document with id", done => {

    const json = {id: "qaz123-id"};
    expect(transforms.mongoIdCriteria(json)).to.eql({"_id": "qaz123-id"});
    done();
  });


  it("transforms document with field-based criteria", done => {
    const refreshToken = "tXvumMGUAgoxgBwxaosFux0TLZVZiYncpQTovVuZqdIdSqSjoV2U";
    const json = {refreshToken};
    // const expected = {"_id": undefined};
    expect(transforms.mongoIdCriteria({body: json})).to.eql(json);
    done();
  });


  it("transforms request with body with id", done => {

    const json = {body: {id: "qaz123-body"}};
    expect(transforms.mongoIdCriteria(json)).to.eql({"_id": "qaz123-body"});
    done();
  });
});
