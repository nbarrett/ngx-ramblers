import expect from "expect";
import { describe, it } from "mocha";
import { becameFullyUnsubscribed } from "./member-consent-writeback";

describe("becameFullyUnsubscribed", () => {

  it("fires when the last active subscription is removed", () => {
    expect(becameFullyUnsubscribed([{id: 1, subscribed: true}], [{id: 1, subscribed: false}])).toEqual(true);
  });

  it("fires when every subscribed list is unticked at once", () => {
    const prior = [{id: 1, subscribed: true}, {id: 2, subscribed: true}];
    const next = [{id: 1, subscribed: false}, {id: 2, subscribed: false}];
    expect(becameFullyUnsubscribed(prior, next)).toEqual(true);
  });

  it("does not fire when one of several subscriptions remains", () => {
    const prior = [{id: 1, subscribed: true}, {id: 2, subscribed: true}];
    const next = [{id: 1, subscribed: false}, {id: 2, subscribed: true}];
    expect(becameFullyUnsubscribed(prior, next)).toEqual(false);
  });

  it("does not fire when the member was already fully unsubscribed", () => {
    expect(becameFullyUnsubscribed([{id: 1, subscribed: false}], [{id: 1, subscribed: false}])).toEqual(false);
  });

  it("does not fire for a brand new member who starts with no subscriptions", () => {
    expect(becameFullyUnsubscribed(undefined, [{id: 1, subscribed: false}])).toEqual(false);
  });
});
