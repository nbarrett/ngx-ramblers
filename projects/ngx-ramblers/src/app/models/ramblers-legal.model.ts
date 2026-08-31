import { Account, AccountMergeFields } from "./mail.model";

export const RAMBLERS_CHARITY_ENGLAND_WALES_NUMBER = "1093577";
export const RAMBLERS_CHARITY_SCOTLAND_NUMBER = "SC039799";
export const RAMBLERS_COMPANY_NUMBER = "4458492";

export const RAMBLERS_REGISTERED_OFFICE_STREET = "The Ramblers, Stone King LLP, Boundary House, 91 Charterhouse Street";
export const RAMBLERS_REGISTERED_OFFICE_TOWN = "London";
export const RAMBLERS_REGISTERED_OFFICE_POSTCODE = "EC1M 6HR";

export const RAMBLERS_REGISTERED_OFFICE_LINE = `${RAMBLERS_REGISTERED_OFFICE_STREET}, ${RAMBLERS_REGISTERED_OFFICE_TOWN}, ${RAMBLERS_REGISTERED_OFFICE_POSTCODE}`;

export function ramblersRegisteredOfficeLine(): string {
  return `Registered office: ${RAMBLERS_REGISTERED_OFFICE_LINE}`;
}

export function ramblersCharityLine(): string {
  return `Ramblers Charity England & Wales No: ${RAMBLERS_CHARITY_ENGLAND_WALES_NUMBER} Scotland No: ${RAMBLERS_CHARITY_SCOTLAND_NUMBER}`;
}

export function ramblersCharityLineHtml(): string {
  return ramblersCharityLine().replace(/&/g, "&amp;");
}

export function ramblersLegalBoilerplate(): string {
  return `The Ramblers' Association is a registered charity (England & Wales no ${RAMBLERS_CHARITY_ENGLAND_WALES_NUMBER}, Scotland no ${RAMBLERS_CHARITY_SCOTLAND_NUMBER}) and a company limited by guarantee, registered in England & Wales (no ${RAMBLERS_COMPANY_NUMBER}). ${ramblersRegisteredOfficeLine()}`;
}

export function ramblersAccountMergeFields(): AccountMergeFields {
  return {
    STREET: RAMBLERS_REGISTERED_OFFICE_STREET,
    TOWN: RAMBLERS_REGISTERED_OFFICE_TOWN,
    POSTCODE: RAMBLERS_REGISTERED_OFFICE_POSTCODE,
    REGISTERED_OFFICE: RAMBLERS_REGISTERED_OFFICE_LINE
  };
}

export function ramblersRegisteredOfficeAddress(): NonNullable<Account["address"]> {
  return {
    street: RAMBLERS_REGISTERED_OFFICE_STREET,
    city: RAMBLERS_REGISTERED_OFFICE_TOWN,
    zipCode: RAMBLERS_REGISTERED_OFFICE_POSTCODE,
    country: "United Kingdom"
  };
}

export function withRamblersRegisteredOffice(account: Account): Account {
  return {
    ...account,
    address: ramblersRegisteredOfficeAddress()
  };
}
