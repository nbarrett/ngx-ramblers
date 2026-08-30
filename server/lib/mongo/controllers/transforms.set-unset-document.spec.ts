import expect from "expect";
import {describe, it} from "mocha";
import * as transforms from "./transforms";

describe("transforms.setUnSetDocument", () => {
  it("transforms basic json", done => {

    const json = {
      "userName": "nickek"
    };
    expect(transforms.setUnSetDocument(json)).toEqual({
        $set: {"userName": "nickek"}
      }
    );
    done();
  });

  it("removes fields containing only whitespace", done => {

    const json = {
      "userName": "nickek",
      "displayName": "   "
    };
    expect(transforms.setUnSetDocument(json)).toEqual({
        $set: {"userName": "nickek"},
        $unset: {
          "displayName": 1
        }
      }
    );
    done();
  });

  it("removes fields containing undefined", done => {

    const json = {
      "userName": "nickek",
      "displayName": undefined
    };
    expect(transforms.setUnSetDocument(json)).toEqual({
        $set: {"userName": "nickek"},
        $unset: {
          "displayName": 1
        }
      }
    );
    done();
  });

  it("trims fields", done => {

    const json = {
      "userName": " nickek ",
    };
    expect(transforms.setUnSetDocument(json)).toEqual({
        $set: {"userName": "nickek"}
      }
    );
    done();
  });

  it("transforms nested json", done => {

    const json = {
      "userName": "nickek",
      "mailchimpLists": {
        "walks": {
          "subscribed": true,
          "updated": false,
          "leid": "321760733",
          "lastUpdated": 1578250663257,
          "email": "member.one@example.co.ukss"
        },
        "socialEvents": {
          "subscribed": true,
          "updated": false,
          "leid": "321760737",
          "lastUpdated": 1578250718042,
          "email": ""
        }
      }
    };
    expect(transforms.setUnSetDocument(json)).toEqual({
      $set: {
        "userName": "nickek",
        "mailchimpLists.socialEvents.lastUpdated": 1578250718042,
        "mailchimpLists.socialEvents.leid": "321760737",
        "mailchimpLists.socialEvents.subscribed": true,
        "mailchimpLists.socialEvents.updated": false,
        "mailchimpLists.walks.email": "member.one@example.co.ukss",
        "mailchimpLists.walks.lastUpdated": 1578250663257,
        "mailchimpLists.walks.leid": "321760733",
        "mailchimpLists.walks.subscribed": true,
        "mailchimpLists.walks.updated": false
      },
      $unset: {
        "mailchimpLists.socialEvents.email": 1
      }
    });
    done();
  });


  it("transforms arrays correctly in json", done => {

    const json = {
      "id": "5aa8666ac2ef1639d44610e4",
      "cost": 100,
      "expenseItems": [{
        "expenseType": {"_id": "5e6035a4d723f575af56a4c1", "value": "other", "name": "Other"},
        "expenseDate": 1519862400000,
        "description": "Properss",
        "cost": 100
      }],
      "expenseEvents": [{
        "date": 1520985691493,
        "memberId": "535954f3e4b0ddd860afdc72",
        "eventType": {"_id": "5e6035a4d723f575af56a4c4", "description": "Created", "editable": true}
      }, {
        "date": 1520985737798,
        "memberId": "535954f3e4b0ddd860afdc72",
        "eventType": {
          "_id": "5e6035a4d723f575af56a4c3",
          "description": "Submitted",
          "actionable": true,
          "notifyCreator": true,
          "notifyApprover": true
        }
      }, {
        "date": 1520985869770,
        "memberId": "533dae09e4b06994571391ae",
        "eventType": {
          "_id": "5e6035a4d723f575af56a4c2",
          "description": "Returned",
          "atEndpoint": false,
          "editable": true,
          "notifyCreator": true,
          "notifyApprover": true
        },
        "reason": "dont be silly"
      }]
    };
    expect(transforms.setUnSetDocument(json)).toEqual({
      $set: {
        "cost": 100,
        "expenseEvents": [{
          "date": 1520985691493,
          "memberId": "535954f3e4b0ddd860afdc72",
          "eventType": {"_id": "5e6035a4d723f575af56a4c4", "description": "Created", "editable": true}
        }, {
          "date": 1520985737798,
          "memberId": "535954f3e4b0ddd860afdc72",
          "eventType": {
            "_id": "5e6035a4d723f575af56a4c3",
            "description": "Submitted",
            "actionable": true,
            "notifyCreator": true,
            "notifyApprover": true
          }
        }, {
          "date": 1520985869770,
          "memberId": "533dae09e4b06994571391ae",
          "eventType": {
            "_id": "5e6035a4d723f575af56a4c2",
            "description": "Returned",
            "atEndpoint": false,
            "editable": true,
            "notifyCreator": true,
            "notifyApprover": true
          },
          "reason": "dont be silly"
        }],
        "expenseItems": [{
          "expenseType": {"_id": "5e6035a4d723f575af56a4c1", "value": "other", "name": "Other"},
          "expenseDate": 1519862400000,
          "description": "Properss",
          "cost": 100
        }],
        "id": "5aa8666ac2ef1639d44610e4"
      }
    });
    done();
  });

  it("transforms whole json", done => {

    const json = {
      "id": "56410469e4b039fe9dc75388",
      "mailchimpLists": {
        "walks": {
          "subscribed": null,
          "updated": false,
          "leid": "321760733",
          "lastUpdated": 1578250663257,
          "email": "member.one@example.co.uk"
        },
        "socialEvents": {
          "subscribed": true,
          "updated": false,
          "leid": "321760737",
          "lastUpdated": "",
          "email": "member.one@example.co.uk"
        },
        "general": {
          "subscribed": true,
          "updated": false,
          "leid": "321760741",
          "lastUpdated": 1578250719650,
          "email": "member.one@example.co.uk"
        }
      },
      "mailchimpSegmentIds": {
        "directMail": 43809,
        "expenseApprover": null,
        "walkLeader": 66257,
        "walkCoordinator": 66261
      },
      "lastName": "Barrett EK",
      "email": "",
      "postcode": "SS9 3AF",
      "password": "p",
      "walkAdmin": true,
      "socialAdmin": true,
      "memberAdmin": true,
      "groupMember": true,
      "socialMember": true,
      "subscribeWalksEmails": true,
      "subscribeSocialEventsEmails": true,
      "profileSettingsConfirmed": null,
      "subscribeGeneralEmails": true,
      "contentAdmin": true,
      "passwordExpired": true,
      "membershipExpiryDate": null,
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
      "nameAlias": "group",
      "contactId": "87654321",
      "createdDate": 1512604800000,
      "firstName": "Nick EK",
      "userName": "nickek"
    };
    expect(transforms.setUnSetDocument(json)).toEqual({
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
        "mailchimpLists.general.email": "member.one@example.co.uk",
        "mailchimpLists.general.lastUpdated": 1578250719650,
        "mailchimpLists.general.leid": "321760741",
        "mailchimpLists.general.subscribed": true,
        "mailchimpLists.general.updated": false,
        "mailchimpLists.socialEvents.email": "member.one@example.co.uk",
        "mailchimpLists.socialEvents.leid": "321760737",
        "mailchimpLists.socialEvents.subscribed": true,
        "mailchimpLists.socialEvents.updated": false,
        "mailchimpLists.walks.email": "member.one@example.co.uk",
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
        "nameAlias": "group",
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
      },
      $unset: {
        "email": 1,
        "mailchimpLists.socialEvents.lastUpdated": 1,
        "mailchimpLists.walks.subscribed": 1,
        "mailchimpSegmentIds.expenseApprover": 1,
        "membershipExpiryDate": 1,
        "profileSettingsConfirmed": 1,
      }
    })
    ;
    done();
  });

  it("sets an atomic object path as a whole object rather than dotted sub-paths", done => {
    const json = {
      groupEvent: {
        title: "Kingsclere and Watership Down",
        walk_leader: {
          is_overridden: false,
          id: "5aa8666ac2ef1639d44610e4",
          name: "Pauline Lax; Alistair Lax",
          telephone: "07123 456789",
          has_email: true
        }
      }
    };
    expect(transforms.setUnSetDocument(json, undefined, undefined, ["groupEvent.walk_leader"])).toEqual({
      $set: {
        "groupEvent.title": "Kingsclere and Watership Down",
        "groupEvent.walk_leader": {
          is_overridden: false,
          id: "5aa8666ac2ef1639d44610e4",
          name: "Pauline Lax; Alistair Lax",
          telephone: "07123 456789",
          has_email: true
        }
      }
    });
    done();
  });

  it("strips empty values from an atomic object path", done => {
    const json = {
      groupEvent: {
        walk_leader: {
          is_overridden: false,
          id: "",
          name: "Diana Lincoln",
          telephone: null,
          email_form: "   ",
          has_email: false
        }
      }
    };
    expect(transforms.setUnSetDocument(json, undefined, undefined, ["groupEvent.walk_leader"])).toEqual({
      $set: {
        "groupEvent.walk_leader": {
          is_overridden: false,
          name: "Diana Lincoln",
          has_email: false
        }
      }
    });
    done();
  });

  it("still recurses into object paths that are not declared atomic", done => {
    const json = {
      groupEvent: {
        walk_leader: {
          name: "Diana Lincoln",
          has_email: true
        }
      }
    };
    expect(transforms.setUnSetDocument(json)).toEqual({
      $set: {
        "groupEvent.walk_leader.name": "Diana Lincoln",
        "groupEvent.walk_leader.has_email": true
      }
    });
    done();
  });
});
