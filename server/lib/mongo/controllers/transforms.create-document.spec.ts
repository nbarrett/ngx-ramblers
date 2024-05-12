import { expect } from "chai";
import * as transforms from "./transforms";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

describe("transforms.createDocument", () => {

  it("transforms basic json", done => {

    const json = {
      $set: {"userName": "nickek"}
    };
    expect(transforms.createDocument<Member>(json)).to.eql({
        "userName": "nickek"
      }
    );
    done();
  });

  it("transforms nested json", done => {

    const json = {
      $set: {
        "userName": "nickek",
        "mailchimpLists.socialEvents.lastUpdated": 1578250718042,
        "mailchimpLists.socialEvents.leid": "321760737",
        "mailchimpLists.socialEvents.subscribed": true,
        "mailchimpLists.socialEvents.updated": false,
        "mailchimpLists.walks.email": "nick.barrett@example.co.ukss",
        "mailchimpLists.walks.lastUpdated": 1578250663257,
        "mailchimpLists.walks.leid": "321760733",
        "mailchimpLists.walks.subscribed": true,
        "mailchimpLists.walks.updated": false
      }
    };
    expect(transforms.createDocument<Member>(json)).to.eql({
      "userName": "nickek",
      "mailchimpLists": {
        "walks": {
          "subscribed": true,
          "updated": false,
          "leid": "321760733",
          "lastUpdated": 1578250663257,
          "email": "nick.barrett@example.co.ukss"
        },
        "socialEvents": {
          "subscribed": true,
          "updated": false,
          "leid": "321760737",
          "lastUpdated": 1578250718042
        }
      }
    });
    done();
  });

  it("transforms whole json", done => {

    const json = {
      $set: {
        "committee": true,
        "contactId": "87654321",
        "contentAdmin": true,
        "createdDate": 1512604800000,
        "displayName": "Nick EK",
        "financeAdmin": false,
        "firstName": "Nick EK",
        "groupMember": true,
        "id": "56410469e4b039fe9dc75388",
        "lastName": "Barrett EK",
        "mailchimpLists.general.email": "nick.barrett@example.co.uk",
        "mailchimpLists.general.lastUpdated": 1578250719650,
        "mailchimpLists.general.leid": "321760741",
        "mailchimpLists.general.subscribed": true,
        "mailchimpLists.general.updated": false,
        "mailchimpLists.socialEvents.email": "nick.barrett@example.co.uk",
        "mailchimpLists.socialEvents.leid": "321760737",
        "mailchimpLists.socialEvents.subscribed": true,
        "mailchimpLists.socialEvents.updated": false,
        "mailchimpLists.walks.email": "nick.barrett@example.co.uk",
        "mailchimpLists.walks.lastUpdated": 1578250663257,
        "mailchimpLists.walks.leid": "321760733",
        "mailchimpLists.walks.updated": false,
        "mailchimpSegmentIds.directMail": 43809,
        "mailchimpSegmentIds.walkCoordinator": 66261,
        "mailchimpSegmentIds.walkLeader": 66257,
        "memberAdmin": true,
        "memberId": "533dae09e4b06994571391ae",
        "membershipNumber": "NICKA1234",
        "mobileNumber": "07887 444 5972",
        "nameAlias": "ekwg",
        "password": "p",
        "passwordExpired": true,
        "postcode": "SS9 3AF",
        "profileSettingsConfirmedAt": 1465572590559,
        "profileSettingsConfirmedBy": "Nick-approver2 Barrett (sky)",
        "socialAdmin": true,
        "socialMember": true,
        "subscribeGeneralEmails": true,
        "subscribeSocialEventsEmails": true,
        "subscribeWalksEmails": true,
        "updatedBy": "533dae09e4b06994571391ae",
        "updatedDate": 1579738985159,
        "userName": "nickek",
        "walkAdmin": true,
        "walkChangeNotifications": true,
      }
    };
    expect(transforms.createDocument<Member>(json)).to.eql({
      "id": "56410469e4b039fe9dc75388",
      "mailchimpLists": {
        "walks": {
          "updated": false,
          "leid": "321760733",
          "lastUpdated": 1578250663257,
          "email": "nick.barrett@example.co.uk"
        },
        "socialEvents": {
          "subscribed": true,
          "updated": false,
          "leid": "321760737",
          "email": "nick.barrett@example.co.uk"
        },
        "general": {
          "subscribed": true,
          "updated": false,
          "leid": "321760741",
          "lastUpdated": 1578250719650,
          "email": "nick.barrett@example.co.uk"
        }
      },
      "mailchimpSegmentIds": {
        "directMail": 43809,
        "walkLeader": 66257,
        "walkCoordinator": 66261
      },
      "lastName": "Barrett EK",
      "postcode": "SS9 3AF",
      "password": "p",
      "walkAdmin": true,
      "socialAdmin": true,
      "memberAdmin": true,
      "groupMember": true,
      "socialMember": true,
      "subscribeWalksEmails": true,
      "subscribeSocialEventsEmails": true,
      "subscribeGeneralEmails": true,
      "contentAdmin": true,
      "passwordExpired": true,
      "mobileNumber": "07887 444 5972",
      "membershipNumber": "NICKA1234",
      "memberId": "533dae09e4b06994571391ae",
      "financeAdmin": false,
      "profileSettingsConfirmedAt": 1465572590559,
      "profileSettingsConfirmedBy": "Nick-approver2 Barrett (sky)",
      "committee": true,
      "updatedDate": 1579738985159,
      "updatedBy": "533dae09e4b06994571391ae",
      "walkChangeNotifications": true,
      "displayName": "Nick EK",
      "nameAlias": "ekwg",
      "contactId": "87654321",
      "createdDate": 1512604800000,
      "firstName": "Nick EK",
      "userName": "nickek"
    });
    done();
  });
});
