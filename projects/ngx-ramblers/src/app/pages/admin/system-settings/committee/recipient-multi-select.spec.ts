import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";
import { NgxLoggerLevel } from "ngx-logger";
import { RecipientMultiSelect } from "./recipient-multi-select";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { FullNamePipe } from "../../../../pipes/full-name.pipe";
import { Member } from "../../../../models/member.model";

function member(firstName: string, lastName: string, email: string): Member {
  return {firstName, lastName, email} as Member;
}

describe("RecipientMultiSelect notify routing addresses", () => {

  function createSelect(members: Member[], excludedEmails: string[], groupDomain: string | null = null): RecipientMultiSelect {
    TestBed.configureTestingModule({
      providers: [
        FullNamePipe,
        {provide: LoggerFactory, useValue: {createLogger: () => ({debug: () => null, info: () => null, error: () => null, warn: () => null})}},
        {provide: CommitteeQueryService, useValue: {committeeMembers: members}},
        {provide: NgxLoggerLevel, useValue: NgxLoggerLevel.OFF}
      ]
    });
    const select = TestBed.runInInjectionContext(() => new RecipientMultiSelect());
    select.excludedEmails = excludedEmails;
    select.groupDomain = groupDomain;
    select.includeMemberOptions = true;
    return select;
  }

  it("does not list a committee member whose email is a role mailbox", () => {
    const select = createSelect([
      member("NGX", "Chairman", "chairman@ngx-ramblers.org.uk"),
      member("Nick", "Barrett", "nick.barrett36@me.com")
    ], ["chairman@ngx-ramblers.org.uk", "treasury@ngx-ramblers.org.uk"]);
    select.refresh();
    expect(select.options.map(option => option.email)).toEqual(["nick.barrett36@me.com"]);
  });

  it("does not treat a role mailbox as addable even when it matches a committee member", () => {
    const select = createSelect([
      member("NGX", "Chairman", "chairman@ngx-ramblers.org.uk")
    ], ["chairman@ngx-ramblers.org.uk"]);
    expect(select.tagRecipientEmail("chairman@ngx-ramblers.org.uk")).toBeNull();
  });

  it("still shows an already chosen routing address so it can be removed", () => {
    const select = createSelect([
      member("NGX", "Chairman", "chairman@ngx-ramblers.org.uk")
    ], ["chairman@ngx-ramblers.org.uk"]);
    select.recipients = ["chairman@ngx-ramblers.org.uk"];
    select.ngOnInit();
    expect(select.options.map(option => option.email)).toEqual(["chairman@ngx-ramblers.org.uk"]);
  });

  it("treats a complete typed address as addable with Enter", () => {
    const select = createSelect([], []);
    select.onSearch({term: "nick.barrett36@me.com"});
    expect(select.typedAddressOption()?.email).toEqual("nick.barrett36@me.com");
    expect(select.tagRecipientEmail("nick.barrett36@me.com")?.email).toEqual("nick.barrett36@me.com");
  });

  it("puts a typed address into the dropdown once it is selected", () => {
    const select = createSelect([], []);
    const added: string[][] = [];
    select.recipientsChange.subscribe(emails => added.push(emails));
    select.onChange(["nick.barrett36@me.com"]);
    expect(select.selectedEmails).toEqual(["nick.barrett36@me.com"]);
    expect(select.options.map(option => option.email)).toEqual(["nick.barrett36@me.com"]);
    expect(added).toEqual([["nick.barrett36@me.com"]]);
  });

  it("clears the typed search after an address is added", () => {
    const select = createSelect([], []);
    select.onSearch({term: "nick.barrett36@me.com"});
    select.onChange(["nick.barrett36@me.com"]);
    expect(select.typedAddressOption()).toBeNull();
  });

  it("keeps the previous address when a second one is added", () => {
    const select = createSelect([], []);
    select.onChange(["nick.barrett36@me.com"]);
    select.onChange(["nick.barrett36@gmail.com"]);
    expect(select.selectedEmails).toEqual([
      "nick.barrett36@me.com",
      "nick.barrett36@gmail.com"
    ]);
  });

  it("removes only the address that was cleared", () => {
    const select = createSelect([], []);
    select.onChange(["a@example.com", "b@example.com"]);
    select.onChange(["b@example.com"]);
    expect(select.selectedEmails).toEqual(["b@example.com"]);
  });

  it("does not list a committee member whose email is on the group domain", () => {
    const select = createSelect([
      member("Secretary", "NGX", "secretary@ngx-ramblers.org.uk"),
      member("Nick", "Barrett", "nick.barrett36@me.com")
    ], [], "ngx-ramblers.org.uk");
    select.refresh();
    expect(select.options.map(option => option.email)).toEqual(["nick.barrett36@me.com"]);
  });

  it("does not allow typing an address on the group domain", () => {
    const select = createSelect([], [], "ngx-ramblers.org.uk");
    expect(select.tagRecipientEmail("secretary@ngx-ramblers.org.uk")).toBeNull();
    expect(select.tagRecipientEmail("nick.barrett36@gmail.com")?.email).toEqual("nick.barrett36@gmail.com");
  });

  it("does not offer Enter-to-add until the typed value is a complete address", () => {
    const select = createSelect([], []);
    select.onSearch({term: "nick"});
    expect(select.typedAddressOption()).toBeNull();
    expect(select.tagRecipientEmail("nick")).toBeNull();
  });
});
