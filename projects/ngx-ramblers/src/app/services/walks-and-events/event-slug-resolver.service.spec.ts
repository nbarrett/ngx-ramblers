import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { EventSlugResolverService } from "./event-slug-resolver.service";
import { WalksAndEventsService } from "./walks-and-events.service";

describe("EventSlugResolverService", () => {
  const settle = () => new Promise(resolve => setTimeout(resolve));

  function serviceWith(queryByIds: (eventIds: string[]) => Promise<Map<string, ExtendedGroupEvent>>): EventSlugResolverService {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        EventSlugResolverService,
        {provide: WalksAndEventsService, useValue: {queryByIds}}
      ]
    });
    return TestBed.inject(EventSlugResolverService);
  }

  it("looks up every event asked for together in a single request", async () => {
    const requests: string[][] = [];
    const service = serviceWith(async eventIds => {
      requests.push(eventIds);
      return new Map(eventIds.map(eventId => [eventId, {id: eventId, groupEvent: {url: `walk-${eventId}`}} as ExtendedGroupEvent]));
    });

    expect(service.slugOrId("1")).toEqual("1");
    expect(service.slugOrId("2")).toEqual("2");
    expect(service.slugOrId("1")).toEqual("1");
    await settle();
    await settle();

    expect(requests).toEqual([["1", "2"]]);
    expect(service.slugOrId("1")).toEqual("walk-1");
    expect(service.slugOrId("2")).toEqual("walk-2");
    expect(requests.length).toEqual(1);
  });

  it("keeps using the event id when the lookup fails", async () => {
    const requests: string[][] = [];
    const service = serviceWith(async eventIds => {
      requests.push(eventIds);
      throw new Error("database unavailable");
    });

    service.slugOrId("1");
    await settle();
    await settle();

    expect(service.slugOrId("1")).toEqual("1");
    expect(requests.length).toEqual(1);
  });
});
