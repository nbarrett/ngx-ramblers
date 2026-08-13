import { defaultCommitteeMeetingTypes } from "./committee.model";

describe("defaultCommitteeMeetingTypes", () => {

  it("links AGM and committee agenda file types and leaves Other unlinked", () => {
    expect(defaultCommitteeMeetingTypes([
      {description: "AGM Agenda", public: true},
      {description: "AGM Minutes", public: true},
      {description: "Committee Meeting Agenda", public: false},
      {description: "Committee Meeting Minutes", public: false}
    ])).toEqual([
      {description: "AGM", agendaFileType: "AGM Agenda"},
      {description: "Committee Meeting", agendaFileType: "Committee Meeting Agenda"},
      {description: "Other", agendaFileType: null}
    ]);
  });

  it("links Committee Agenda when that is the file type name", () => {
    expect(defaultCommitteeMeetingTypes([
      {description: "AGM Agenda", public: true},
      {description: "Committee Agenda", public: false}
    ])).toEqual([
      {description: "AGM", agendaFileType: "AGM Agenda"},
      {description: "Committee Meeting", agendaFileType: "Committee Agenda"},
      {description: "Other", agendaFileType: null}
    ]);
  });

  it("leaves agenda file types empty when none exist", () => {
    expect(defaultCommitteeMeetingTypes([])).toEqual([
      {description: "AGM", agendaFileType: null},
      {description: "Committee Meeting", agendaFileType: null},
      {description: "Other", agendaFileType: null}
    ]);
  });
});
