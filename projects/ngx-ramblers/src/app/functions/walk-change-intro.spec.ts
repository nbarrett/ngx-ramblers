import { WalkChangeIntroField } from "../models/walk-notification-field.model";
import { EventField, GroupEventField } from "../models/walk.model";
import {
  defaultWalkChangeIntroFields,
  walkChangeFieldsAfterToggle,
  walkChangeFieldsFrom,
  walkChangeIntroFieldChoices,
  walkChangeLocationFormat
} from "./walk-change-intro";

describe("walk-change-intro", () => {
  it("defaults walk-change fields to member-facing details such as start time and location", () => {
    const fields = defaultWalkChangeIntroFields();
    expect(fields).toContain(GroupEventField.START_DATE);
    expect(fields).toContain(GroupEventField.START_LOCATION);
    expect(fields).toContain(WalkChangeIntroField.POSTCODE);
    expect(fields).not.toContain(WalkChangeIntroField.GRID_REFERENCE);
    expect(fields).not.toContain(EventField.RISK_ASSESSMENT);
    expect(fields).not.toContain(GroupEventField.MEDIA);
    expect(fields).not.toContain(GroupEventField.DISTANCE_KM);
  });

  it("falls back to those defaults when none are saved", () => {
    expect(walkChangeFieldsFrom({offerDraftedIntro: true, onlyApprovedWalks: true})).toEqual(defaultWalkChangeIntroFields());
  });

  it("keeps a saved field selection", () => {
    expect(walkChangeFieldsFrom({
      offerDraftedIntro: true,
      onlyApprovedWalks: true,
      walkChangeFields: [GroupEventField.START_DATE]
    })).toEqual([GroupEventField.START_DATE]);
  });

  it("lists choosable fields with start details before images and risk assessment", () => {
    const labels = walkChangeIntroFieldChoices().map(choice => choice.label);
    expect(labels).toContain("Postcode");
    expect(labels).toContain("Grid reference");
    expect(labels.indexOf("Start date & time")).toBeLessThan(labels.indexOf("Risk assessment"));
    expect(labels.indexOf("Starting location")).toBeLessThan(labels.indexOf("Walk images"));
    expect(labels.indexOf("Postcode")).toBeLessThan(labels.indexOf("Grid reference"));
  });

  it("treats postcode and grid reference as optional extras on a location change", () => {
    expect(walkChangeLocationFormat([GroupEventField.START_LOCATION])).toEqual({
      description: true,
      postcode: false,
      gridReference: false
    });
    expect(walkChangeLocationFormat([
      GroupEventField.START_LOCATION,
      WalkChangeIntroField.POSTCODE,
      WalkChangeIntroField.GRID_REFERENCE
    ])).toEqual({
      description: true,
      postcode: true,
      gridReference: true
    });
  });

  it("keeps the last ticked field when it would otherwise be cleared", () => {
    expect(walkChangeFieldsAfterToggle([GroupEventField.START_DATE], GroupEventField.START_DATE, false))
      .toEqual([GroupEventField.START_DATE]);
  });

  it("adds and removes fields while others remain", () => {
    expect(walkChangeFieldsAfterToggle([GroupEventField.START_DATE], GroupEventField.START_LOCATION, true))
      .toEqual([GroupEventField.START_DATE, GroupEventField.START_LOCATION]);
    expect(walkChangeFieldsAfterToggle(
      [GroupEventField.START_DATE, GroupEventField.START_LOCATION],
      GroupEventField.START_LOCATION,
      false
    )).toEqual([GroupEventField.START_DATE]);
  });
});
