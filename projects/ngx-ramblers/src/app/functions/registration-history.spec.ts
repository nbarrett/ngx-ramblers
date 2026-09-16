import { latestBuildSpan, registrationHistoryRows, registrationStages } from "./registration-history";
import { RegistrationHistoryAction, RegistrationPlan, RegistrationStageStatus, RegistrationState } from "../models/site-registration.model";

const history = [
  {action: RegistrationHistoryAction.STARTED, at: 1000, by: "secretary@example.org"},
  {action: RegistrationHistoryAction.SUBMITTED, at: 5000, by: "secretary@example.org"},
  {action: RegistrationHistoryAction.READY_FOR_REVIEW, at: 65000, by: "NGX"},
  {action: RegistrationHistoryAction.RUN_AGAIN, at: 100000, by: "Site Reviewer"}
];

describe("registration history", () => {
  it("lists each step in order with who did it and how long since the step before", () => {
    const rows = registrationHistoryRows([...history].reverse());
    expect(rows.map(row => [row.label, row.by, row.sincePrevious])).toEqual([
      ["Registration started", "secretary@example.org", null],
      ["Submitted for building", "secretary@example.org", 4000],
      ["Ready for review", "NGX", 60000],
      ["Run again", "Site Reviewer", 35000]
    ]);
  });

  it("times the latest build, still running when it has not finished", () => {
    expect(latestBuildSpan(history.slice(0, 3), 200000)).toEqual({from: 5000, to: 65000, finished: true});
    expect(latestBuildSpan(history, 200000)).toEqual({from: 100000, to: 200000, finished: false});
    expect(latestBuildSpan(history.slice(0, 1), 200000)).toBe(null);
  });
});

describe("registration stages", () => {
  const fresh = {plan: RegistrationPlan.FULL, state: RegistrationState.QUEUED, verifiedAt: 1, provisionedAt: null, walksLoadedAt: null, importedAt: null};
  const statuses = (registration: typeof fresh) => registrationStages(registration).map(stage => [stage.label, stage.status]);

  it("shows a queued build waiting for its first step, then naming the step it is running", () => {
    expect(statuses({...fresh, state: RegistrationState.PROVISIONING})[2]).toEqual(["Creating the site", RegistrationStageStatus.RUNNING]);
    expect(statuses(fresh)).toEqual([
      ["Email confirmed", RegistrationStageStatus.DONE],
      ["Submitted", RegistrationStageStatus.DONE],
      ["Waiting to create the site", RegistrationStageStatus.WAITING],
      ["Walks loaded", RegistrationStageStatus.PENDING],
      ["Pages imported", RegistrationStageStatus.PENDING],
      ["Ready for review", RegistrationStageStatus.PENDING],
      ["Group invited", RegistrationStageStatus.PENDING]
    ]);
  });

  it("shows run again on an existing site redoing only the import", () => {
    expect(statuses({...fresh, state: RegistrationState.IMPORTING, provisionedAt: 1, walksLoadedAt: 2})).toEqual([
      ["Email confirmed", RegistrationStageStatus.DONE],
      ["Submitted", RegistrationStageStatus.DONE],
      ["Site created", RegistrationStageStatus.DONE],
      ["Walks loaded", RegistrationStageStatus.DONE],
      ["Importing pages", RegistrationStageStatus.RUNNING],
      ["Ready for review", RegistrationStageStatus.PENDING],
      ["Group invited", RegistrationStageStatus.PENDING]
    ]);
  });

  it("marks the step that failed", () => {
    expect(statuses({...fresh, state: RegistrationState.FAILED, provisionedAt: 1, walksLoadedAt: 2})[4]).toEqual(["Importing pages", RegistrationStageStatus.FAILED]);
  });

  it("leaves out the import for a Lite site and waits at review", () => {
    expect(statuses({...fresh, plan: RegistrationPlan.LITE, state: RegistrationState.REVIEW, provisionedAt: 1, walksLoadedAt: 2})).toEqual([
      ["Email confirmed", RegistrationStageStatus.DONE],
      ["Submitted", RegistrationStageStatus.DONE],
      ["Site created", RegistrationStageStatus.DONE],
      ["Walks loaded", RegistrationStageStatus.DONE],
      ["Ready for review", RegistrationStageStatus.DONE],
      ["Waiting for approval", RegistrationStageStatus.WAITING]
    ]);
  });

  it("waits for the email to be confirmed, then for the group to submit", () => {
    expect(statuses({...fresh, state: RegistrationState.AWAITING_EMAIL, verifiedAt: null}).slice(0, 2)).toEqual([
      ["Waiting for the committee email to be confirmed", RegistrationStageStatus.WAITING],
      ["Submitted", RegistrationStageStatus.PENDING]
    ]);
    expect(statuses({...fresh, state: RegistrationState.DRAFT}).slice(0, 3)).toEqual([
      ["Email confirmed", RegistrationStageStatus.DONE],
      ["Waiting for the group to submit", RegistrationStageStatus.WAITING],
      ["Site created", RegistrationStageStatus.PENDING]
    ]);
  });

  it("shows every step done once the group is invited", () => {
    expect(registrationStages({...fresh, state: RegistrationState.COMPLETE, provisionedAt: 1, walksLoadedAt: 2, importedAt: 3})
      .every(stage => stage.status === RegistrationStageStatus.DONE)).toBe(true);
  });
});
