import expect from "expect";
import {describe, it} from "mocha";
import * as transforms from "./transforms";

describe("transforms.createDocumentRequest", () => {
  describe("when document passed directly", () => {
    it("removes id from document", done => {

      expect(transforms.createDocumentRequest({
        "id": "52c59599e4b003b51a33dabf",
        "expiredPassword": false,
        "firstName": "Bob",
        "lastName": "Smith",
        "membershipExpiryDate": 1742860800000
      })).toEqual({
        "expiredPassword": false,
        "firstName": "Bob",
        "lastName": "Smith",
        "membershipExpiryDate": 1742860800000
      });
      done();
    });

    it("removes _id from document", done => {

      expect(transforms.createDocumentRequest({
        "_id": "52c59599e4b003b51a33dabf",
        "expiredPassword": false,
        "firstName": "Bob",
        "lastName": "Smith",
        "membershipExpiryDate": 1742860800000
      })).toEqual({
        "expiredPassword": false,
        "firstName": "Bob",
        "lastName": "Smith",
        "membershipExpiryDate": 1742860800000
      });
      done();
    });

    it("removes __v from document", done => {

      expect(transforms.createDocumentRequest({
        "__v": "52c59599e4b003b51a33dabf",
        "expiredPassword": false,
        "firstName": "Bob",
        "lastName": "Smith",
        "membershipExpiryDate": 1742860800000
      })).toEqual({
        "expiredPassword": false,
        "firstName": "Bob",
        "lastName": "Smith",
        "membershipExpiryDate": 1742860800000
      });
      done();
    });
  });

  describe("when request passed with document in body", () => {
    it("removes id from document", done => {

      expect(transforms.createDocumentRequest({
        body: {
          "id": "52c59599e4b003b51a33dabf",
          "expiredPassword": false,
          "firstName": "Bob",
          "lastName": "Smith",
          "membershipExpiryDate": 1742860800000
        }
      })).toEqual({
        "expiredPassword": false,
        "firstName": "Bob",
        "lastName": "Smith",
        "membershipExpiryDate": 1742860800000
      });
      done();
    });

    it("removes _id from document", done => {

      expect(transforms.createDocumentRequest({
        body: {
          "_id": "52c59599e4b003b51a33dabf",
          "expiredPassword": false,
          "firstName": "Bob",
          "lastName": "Smith",
          "membershipExpiryDate": 1742860800000
        }
      })).toEqual({
        "expiredPassword": false,
        "firstName": "Bob",
        "lastName": "Smith",
        "membershipExpiryDate": 1742860800000
      });
      done();
    });

    it("removes __v from document", done => {

      expect(transforms.createDocumentRequest({
        body: {
          "__v": "52c59599e4b003b51a33dabf",
          "expiredPassword": false,
          "firstName": "Bob",
          "lastName": "Smith",
          "membershipExpiryDate": 1742860800000
        }
      })).toEqual({
        "expiredPassword": false,
        "firstName": "Bob",
        "lastName": "Smith",
        "membershipExpiryDate": 1742860800000
      });
      done();
    });
  });
});
