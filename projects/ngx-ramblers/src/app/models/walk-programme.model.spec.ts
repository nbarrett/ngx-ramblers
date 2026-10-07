import { LinkSource } from "./walk.model";
import { displayedWalkProgrammeStatus, ProgrammeOverviewStatus, walkIsMemberFacing, walkNeedsLeader } from "./walk-programme.model";

describe("displayedWalkProgrammeStatus", () => {
  it("treats a Ramblers id and group walk URL as published without a publication event", () => {
    const status = displayedWalkProgrammeStatus({
      groupEvent: {
        id: "100473687",
        url: "https://www.ramblers.org.uk/go-walking/group-walks/lympne-pedlinge-and-brockhill-park"
      },
      fields: {links: []}
    } as any, ProgrammeOverviewStatus.APPROVED);

    expect(status).toBe(ProgrammeOverviewStatus.PUBLISHED);
  });

  it("treats a Ramblers id and linked Ramblers URL as published without a publication event", () => {
    const status = displayedWalkProgrammeStatus({
      groupEvent: {id: "100484695", url: "local-walk-slug"},
      fields: {
        links: [{
          source: LinkSource.RAMBLERS,
          href: "https://www.ramblers.org.uk/go-walking/group-walks/local-walk-slug"
        }]
      }
    } as any, ProgrammeOverviewStatus.APPROVED);

    expect(status).toBe(ProgrammeOverviewStatus.PUBLISHED);
  });

  it("does not treat a Ramblers id without a Ramblers URL as published", () => {
    const status = displayedWalkProgrammeStatus({
      groupEvent: {id: "100473687", url: "local-walk-slug"},
      fields: {links: []}
    } as any, ProgrammeOverviewStatus.APPROVED);

    expect(status).toBe(ProgrammeOverviewStatus.APPROVED);
  });

  it("keeps cancellation authoritative when a Ramblers publication identity exists", () => {
    const status = displayedWalkProgrammeStatus({
      groupEvent: {
        id: "100473687",
        url: "https://www.ramblers.org.uk/go-walking/group-walks/lympne-pedlinge-and-brockhill-park",
        status: ProgrammeOverviewStatus.CANCELLED
      },
      fields: {links: []}
    } as any, ProgrammeOverviewStatus.APPROVED);

    expect(status).toBe(ProgrammeOverviewStatus.CANCELLED);
  });
});

describe("walkIsMemberFacing", () => {
  it("includes approved, published and cancelled walks", () => {
    expect(walkIsMemberFacing(ProgrammeOverviewStatus.APPROVED, true)).toBe(true);
    expect(walkIsMemberFacing(ProgrammeOverviewStatus.PUBLISHED, true)).toBe(true);
    expect(walkIsMemberFacing(ProgrammeOverviewStatus.CANCELLED, true)).toBe(true);
  });

  it("excludes empty slots, drafts and deleted walks", () => {
    expect(walkIsMemberFacing(ProgrammeOverviewStatus.AWAITING_LEADER, true)).toBe(false);
    expect(walkIsMemberFacing(ProgrammeOverviewStatus.AWAITING_WALK_DETAILS, true)).toBe(false);
    expect(walkIsMemberFacing(ProgrammeOverviewStatus.APPROVED, true, true)).toBe(false);
  });

  it("keeps social events", () => {
    expect(walkIsMemberFacing(undefined, false)).toBe(true);
  });
});

describe("walkNeedsLeader", () => {
  it("includes a walk still awaiting a leader", () => {
    expect(walkNeedsLeader(ProgrammeOverviewStatus.AWAITING_LEADER, null, "Sunday walk")).toBe(true);
  });

  it("excludes a walk that already has a named leader", () => {
    expect(walkNeedsLeader(ProgrammeOverviewStatus.AWAITING_WALK_DETAILS, "Alex Reed", "Awaiting group-walk details")).toBe(false);
  });
});
