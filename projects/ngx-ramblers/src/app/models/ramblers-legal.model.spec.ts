import {
  RAMBLERS_CHARITY_ENGLAND_WALES_NUMBER,
  RAMBLERS_CHARITY_SCOTLAND_NUMBER,
  RAMBLERS_COMPANY_NUMBER,
  RAMBLERS_REGISTERED_OFFICE_LINE,
  ramblersAccountMergeFields,
  ramblersCharityLine,
  ramblersCharityLineHtml,
  ramblersLegalBoilerplate,
  ramblersRegisteredOfficeAddress,
  ramblersRegisteredOfficeLine,
  withRamblersRegisteredOffice
} from "./ramblers-legal.model";

describe("ramblers legal identity", () => {

  it("uses the Stone King registered office for every site", () => {
    expect(ramblersRegisteredOfficeLine()).toBe(
      "Registered office: The Ramblers, Stone King LLP, Boundary House, 91 Charterhouse Street, London, EC1M 6HR"
    );
    expect(RAMBLERS_REGISTERED_OFFICE_LINE).toBe(
      "The Ramblers, Stone King LLP, Boundary House, 91 Charterhouse Street, London, EC1M 6HR"
    );
  });

  it("keeps the charity and company numbers in one place", () => {
    expect(ramblersCharityLine()).toBe(
      `Ramblers Charity England & Wales No: ${RAMBLERS_CHARITY_ENGLAND_WALES_NUMBER} Scotland No: ${RAMBLERS_CHARITY_SCOTLAND_NUMBER}`
    );
    expect(ramblersCharityLineHtml()).toContain("England &amp; Wales");
    expect(ramblersLegalBoilerplate()).toContain(`no ${RAMBLERS_COMPANY_NUMBER}`);
    expect(ramblersLegalBoilerplate()).toContain(ramblersRegisteredOfficeLine());
  });

  it("fills account merge fields from the same registered office", () => {
    expect(ramblersAccountMergeFields()).toEqual({
      STREET: "The Ramblers, Stone King LLP, Boundary House, 91 Charterhouse Street",
      TOWN: "London",
      POSTCODE: "EC1M 6HR",
      REGISTERED_OFFICE: RAMBLERS_REGISTERED_OFFICE_LINE
    });
  });

  it("replaces a stale Brevo account address with the registered office", () => {
    const synced = withRamblersRegisteredOffice({
      email: "brevo@example.org.uk",
      companyName: "Pang Valley Ramblers",
      address: {street: "10 Queen Street Place", city: "London", zipCode: "EC4R 1BE", country: "United Kingdom"}
    });
    expect(synced.companyName).toBe("Pang Valley Ramblers");
    expect(synced.address).toEqual(ramblersRegisteredOfficeAddress());
    expect(synced.address?.street).not.toContain("Queen Street");
    expect(synced.address?.street).not.toContain("Dirty Lane");
  });
});
