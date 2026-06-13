import expect from "expect";
import { describe, it } from "mocha";
import { subscriptionTransitions } from "./member-subscription-audit";

describe("subscriptionTransitions", () => {

  it("returns no transitions when nothing changed", () => {
    const subscriptions = [{id: 1, subscribed: true}, {id: 2, subscribed: false}];
    expect(subscriptionTransitions(subscriptions, subscriptions)).toEqual([]);
  });

  it("treats a new member's subscribed lists as initial subscribes", () => {
    expect(subscriptionTransitions(undefined, [{id: 1, subscribed: true}, {id: 2, subscribed: false}]))
      .toEqual([{listId: 1, subscribed: true}]);
  });

  it("records a subscribe when a list flips false to true", () => {
    expect(subscriptionTransitions([{id: 1, subscribed: false}], [{id: 1, subscribed: true}]))
      .toEqual([{listId: 1, subscribed: true}]);
  });

  it("records an unsubscribe when a list flips true to false", () => {
    expect(subscriptionTransitions([{id: 1, subscribed: true}], [{id: 1, subscribed: false}]))
      .toEqual([{listId: 1, subscribed: false}]);
  });

  it("records an unsubscribe when a previously subscribed list is removed entirely", () => {
    expect(subscriptionTransitions([{id: 1, subscribed: true}], []))
      .toEqual([{listId: 1, subscribed: false}]);
  });

  it("does not record anything when a previously unsubscribed list is removed", () => {
    expect(subscriptionTransitions([{id: 1, subscribed: false}], []))
      .toEqual([]);
  });

  it("handles multiple lists changing at once", () => {
    const prior = [{id: 1, subscribed: true}, {id: 2, subscribed: false}, {id: 3, subscribed: true}];
    const next = [{id: 1, subscribed: false}, {id: 2, subscribed: true}, {id: 3, subscribed: true}];
    expect(subscriptionTransitions(prior, next)).toEqual([
      {listId: 1, subscribed: false},
      {listId: 2, subscribed: true}
    ]);
  });

  it("ignores subscription entries without a numeric list id", () => {
    expect(subscriptionTransitions(undefined, [{subscribed: true}, {id: 5, subscribed: true}]))
      .toEqual([{listId: 5, subscribed: true}]);
  });
});
