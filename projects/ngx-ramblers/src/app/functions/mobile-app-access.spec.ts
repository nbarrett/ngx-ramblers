import { mobileAppAccessPermitted } from "./mobile-app-access";
import { AccessLevel } from "../models/member-resource.model";
import { DEFAULT_MOBILE_APP_CONFIG, MobileAppAction, WalksConfig } from "../models/walks-config.model";

const config = (change = {}): WalksConfig => ({mobileApp: {...DEFAULT_MOBILE_APP_CONFIG, ...change}} as WalksConfig);

describe("mobile app permissions", () => {
  it("allows public following but requires a member for recording and imports", () => {
    expect(mobileAppAccessPermitted(config(), MobileAppAction.FOLLOW, null)).toBe(true);
    expect(mobileAppAccessPermitted(config(), MobileAppAction.RECORD, null)).toBe(false);
    expect(mobileAppAccessPermitted(config(), MobileAppAction.RECORD, {memberId: "fictional-member"})).toBe(true);
  });
  it("applies committee restrictions to recording", () => {
    expect(mobileAppAccessPermitted(config({record: AccessLevel.COMMITTEE}), MobileAppAction.RECORD, {memberId: "fictional-member"})).toBe(false);
    expect(mobileAppAccessPermitted(config({record: AccessLevel.COMMITTEE}), MobileAppAction.RECORD, {memberId: "fictional-member", committee: true})).toBe(true);
  });
  it("blocks every action when app access is disabled", () => {
    expect(mobileAppAccessPermitted(config({access: AccessLevel.HIDDEN}), MobileAppAction.RECORD, {memberId: "fictional-member", walkAdmin: true})).toBe(false);
  });
});
