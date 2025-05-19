import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { EventsMigrationService } from "./migration/events-migration.service";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { ValueOrDefaultPipe } from "../pipes/value-or-default.pipe";
import { SearchFilterPipe } from "../pipes/search-filter.pipe";
import { AuditDeltaChangedItemsPipePipe } from "../pipes/audit-delta-changed-items.pipe";
import { DisplayDatePipe } from "../pipes/display-date.pipe";

describe("EventsMigrationService", () => {

  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule, HttpClientTestingModule, RouterTestingModule],
    providers: [ValueOrDefaultPipe, SearchFilterPipe, AuditDeltaChangedItemsPipePipe, DisplayDatePipe]
  }).compileComponents());

  describe("parseTime", () => {

    it("should format morning time without minutes and optionally am suffix", () => {
      const eventsMigrationService: EventsMigrationService = TestBed.inject(EventsMigrationService);
      expect(eventsMigrationService.parseTime("10 am")).toEqual({hours: 10, minutes: 0});
      expect(eventsMigrationService.parseTime("10.00")).toEqual({hours: 10, minutes: 0});
    });

    it("should format morning time with minutes and optionally am suffix", () => {
      const eventsMigrationService: EventsMigrationService = TestBed.inject(EventsMigrationService);
      expect(eventsMigrationService.parseTime("9.45")).toEqual({hours: 9, minutes: 45});
      expect(eventsMigrationService.parseTime("9.45 am")).toEqual({hours: 9, minutes: 45});
    });

    it("should format evening time without minutes and pm suffix", () => {
      const eventsMigrationService: EventsMigrationService = TestBed.inject(EventsMigrationService);
      expect(eventsMigrationService.parseTime("10 pm")).toEqual({hours: 22, minutes: 0});
    });

    it("should format afternoon time without minutes", () => {
      const eventsMigrationService: EventsMigrationService = TestBed.inject(EventsMigrationService);
      expect(eventsMigrationService.parseTime("14:00")).toEqual({hours: 14, minutes: 0});
    });

    it("should format afternoon time with minutes", () => {
      const eventsMigrationService: EventsMigrationService = TestBed.inject(EventsMigrationService);
      expect(eventsMigrationService.parseTime("14:45")).toEqual({hours: 14, minutes: 45});
    });

    it("should parse morning time with minutes", () => {
      const eventsMigrationService: EventsMigrationService = TestBed.inject(EventsMigrationService);
      expect(eventsMigrationService.parseTime("5:30")).toEqual({hours: 5, minutes: 30});
    });

    it("should format evening time with minutes", () => {
      const eventsMigrationService: EventsMigrationService = TestBed.inject(EventsMigrationService);
      expect(eventsMigrationService.parseTime("17:49")).toEqual({hours: 17, minutes: 49});
      expect(eventsMigrationService.parseTime("9.45 pm")).toEqual({hours: 21, minutes: 45});
      expect(eventsMigrationService.parseTime("11.27 PM")).toEqual({hours: 23, minutes: 27});
      expect(eventsMigrationService.parseTime("7:30 pm")).toEqual({hours: 19, minutes: 30});
    });

  });

});
