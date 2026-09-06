import expect from "expect";
import { describe, it } from "mocha";
import { mentionsPoliceForceArea, postcodeDescription, withoutPoliceForceAreas } from "./location-description";

describe("postcodeDescription", () => {

  it("uses the ward and district for an unparished London postcode instead of the police force area", () => {
    expect(postcodeDescription({parish: "Bromley, unparished area", admin_ward: "Farnborough and Crofton", admin_district: "Bromley"})).toEqual("Farnborough and Crofton, Bromley");
  });

  it("prefers the parish to the ward for a rural postcode", () => {
    expect(postcodeDescription({parish: "Frittenden", admin_ward: "Frittenden and Sissinghurst", admin_district: "Tunbridge Wells"})).toEqual("Frittenden, Tunbridge Wells");
  });

  it("does not repeat a segment when the ward and district share a name", () => {
    expect(postcodeDescription({parish: "", admin_ward: "Canterbury", admin_district: "Canterbury"})).toEqual("Canterbury");
  });

  it("copes with missing fields", () => {
    expect(postcodeDescription({parish: null, admin_ward: null, admin_district: "Islington"})).toEqual("Islington");
    expect(postcodeDescription({parish: null, admin_ward: null, admin_district: null})).toEqual("");
  });

});

describe("withoutPoliceForceAreas", () => {

  it("drops the police force area segment from an existing description", () => {
    expect(withoutPoliceForceAreas("Bromley, Metropolitan Police")).toEqual("Bromley");
    expect(withoutPoliceForceAreas("Frittenden, Kent, Kent")).toEqual("Frittenden, Kent");
    expect(withoutPoliceForceAreas("Islington, Metropolitan Police")).toEqual("Islington");
  });

  it("leaves descriptions without a police force area alone", () => {
    expect(withoutPoliceForceAreas("Farnborough, Bromley")).toEqual("Farnborough, Bromley");
  });

});

describe("mentionsPoliceForceArea", () => {

  it("matches Police and Constabulary as whole words only", () => {
    expect(mentionsPoliceForceArea("Bromley, Metropolitan Police")).toEqual(true);
    expect(mentionsPoliceForceArea("Ashford, Kent, Kent Constabulary")).toEqual(true);
    expect(mentionsPoliceForceArea("Policeman's Lane, Ashford")).toEqual(false);
    expect(mentionsPoliceForceArea(null)).toEqual(false);
  });

});
