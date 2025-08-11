import expect from "expect";
import {describe, it} from "mocha";
import * as transforms from "./transforms";

describe("transforms.parseQueryStringParameters", () => {
  it("transforms request with criteria, select, sort included", done => {
    const contentMetaDataType = "imagesHome";
    const req = {
      query: {
        criteria: {committee: {$exists: true}},
        select: {criteria: {contentMetaDataType}},
        sort: {"userName": "nickek"}
      }
    } as any;
    expect(transforms.parseQueryStringParameters(req as any)).toEqual({
        "criteria": {
          "committee": {
            "$exists": true
          }
        },
        "limit": {},
        "select": {
          "criteria": {
            "contentMetaDataType": "imagesHome"
          }
        },
        "sort": {
          "userName": "nickek"
        }
      }
    );
    done();
  });

  it("transforms request with stringified values", done => {
    const contentMetaDataType = "imagesHome";
    const req = {
      query: {
        criteria: JSON.stringify({committee: {$exists: true}}),
        select: JSON.stringify({criteria: {contentMetaDataType}}),
        sort: JSON.stringify({"userName": "nickek"})
      }
    };
    expect(transforms.parseQueryStringParameters(req as any)).toEqual({
        "criteria": {
          "committee": {
            "$exists": true
          }
        },
        "limit": {},
        "select": {
          "criteria": {
            "contentMetaDataType": "imagesHome"
          }
        },
        "sort": {
          "userName": "nickek"
        }
      }
    );
    done();
  });

  it("transforms request with some values missing", done => {
    const contentMetaDataType = "imagesHome";
    const req = {
      query: {
        criteria: JSON.stringify({committee: {$exists: true}})
      }
    };
    expect(transforms.parseQueryStringParameters(req as any)).toEqual({
        "criteria": {
          "committee": {
            "$exists": true
          }
        },
        "limit": {},
        "select": {},
        "sort": {}
      }
    );
    done();
  });
});
