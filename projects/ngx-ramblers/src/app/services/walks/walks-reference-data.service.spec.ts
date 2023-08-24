import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { EventType } from "../../models/walk.model";
import { WalksReferenceService } from "./walks-reference-data.service";

describe("WalksReferenceService", () => {

  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule],
    providers: []
  }).compileComponents());

  describe("toEventType", () => {

    it("should return supplied event type if event type supplied", () => {
      const walksReferenceService: WalksReferenceService = TestBed.inject(WalksReferenceService);
      expect(walksReferenceService.toEventType(EventType.AWAITING_APPROVAL)).toBe(EventType.AWAITING_APPROVAL);
    });

    it("should accept a string value as an arg", () => {
      const walksReferenceService: WalksReferenceService = TestBed.inject(WalksReferenceService);
      expect(walksReferenceService.toEventType("approved")).toBe(EventType.APPROVED);
    });

    it("should accept a string value in proper case as an arg", () => {
      const walksReferenceService: WalksReferenceService = TestBed.inject(WalksReferenceService);
      expect(walksReferenceService.toEventType("Approved")).toEqual(EventType.APPROVED);
    });

    it("should throw exception if an invalid value is passed as an arg", () => {
      const walksReferenceService: WalksReferenceService = TestBed.inject(WalksReferenceService);
      expect (() => {
        walksReferenceService.toEventType("I dont exist");
      }).toThrow ();
    });

  });


});
