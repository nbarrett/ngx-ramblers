import { LinkSource } from "./walk.model";
import { displayedWalkProgrammeStatus, ProgrammeOverviewStatus } from "./walk-programme.model";

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
