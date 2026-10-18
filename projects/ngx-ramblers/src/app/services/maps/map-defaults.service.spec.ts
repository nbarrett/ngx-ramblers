import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";
import { UK_MAP_CENTER, UK_MAP_ZOOM } from "../../models/map.model";
import { LoggerFactory } from "../logger-factory.service";
import { RamblersGroupsService } from "../walks-and-events/ramblers-groups.service";
import { SystemConfigService } from "../system/system-config.service";
import { MapDefaultsService } from "./map-defaults.service";

describe("MapDefaultsService", () => {
  const list = vi.fn();
  const events = vi.fn();
  const systemConfig = vi.fn();

  beforeEach(() => {
    list.mockReset();
    events.mockReset();
    systemConfig.mockReset();
    TestBed.configureTestingModule({
      providers: [
        MapDefaultsService,
        {provide: RamblersGroupsService, useValue: {list}},
        {provide: SystemConfigService, useValue: {systemConfig, events}},
        {provide: LoggerFactory, useValue: {createLogger: () => ({warn: vi.fn()})}}
      ]
    });
  });

  it("uses the saved group centre when it is present", async () => {
    const config = {group: {center: [51.3, -1.2] as [number, number], zoom: 12, groupCode: "AB01"}};
    systemConfig.mockReturnValue(config);
    events.mockReturnValue(of(config));
    const service = TestBed.inject(MapDefaultsService);
    await service.resolve();
    expect(service.center()).toEqual([51.3, -1.2]);
    expect(service.zoom()).toBe(12);
    expect(list).not.toHaveBeenCalled();
  });

  it("falls back to the group's published Ramblers coordinates when no map centre is saved", async () => {
    const config = {group: {groupCode: "AB01"}};
    systemConfig.mockReturnValue(config);
    events.mockReturnValue(of(config));
    list.mockResolvedValue([{group_code: "AB01", latitude: "51.3055", longitude: "-1.2605"}]);
    const service = TestBed.inject(MapDefaultsService);
    await service.resolve();
    expect(service.center()).toEqual([51.3055, -1.2605]);
    expect(service.zoom()).toBe(11);
    expect(list).toHaveBeenCalledWith(["AB01"]);
  });

  it.each([
    [null, null],
    ["", ""],
    ["   ", "   "],
    [null, -1.2],
    [51.3, null],
    [0, 0],
    [Infinity, -1.2],
    [91, -1.2],
    [51.3, -181],
    ["invalid", "invalid"]
  ])("keeps the UK overview for unusable published coordinates %s, %s", async (latitude, longitude) => {
    const config = {group: {groupCode: "AB01"}};
    systemConfig.mockReturnValue(config);
    events.mockReturnValue(of(config));
    list.mockResolvedValue([{group_code: "AB01", latitude, longitude}]);
    const service = TestBed.inject(MapDefaultsService);
    await service.resolve();
    expect(service.center()).toEqual([...UK_MAP_CENTER]);
    expect(service.zoom()).toBe(UK_MAP_ZOOM);
  });

  it("accepts a valid published centre on the prime meridian", async () => {
    const config = {group: {groupCode: "AB01"}};
    systemConfig.mockReturnValue(config);
    events.mockReturnValue(of(config));
    list.mockResolvedValue([{group_code: "AB01", latitude: 51.3, longitude: 0}]);
    const service = TestBed.inject(MapDefaultsService);
    await service.resolve();
    expect(service.center()).toEqual([51.3, 0]);
    expect(service.zoom()).toBe(11);
  });

  it("keeps the UK overview when the group has no published coordinates", async () => {
    const config = {group: {groupCode: "AB01"}};
    systemConfig.mockReturnValue(config);
    events.mockReturnValue(of(config));
    list.mockResolvedValue([]);
    const service = TestBed.inject(MapDefaultsService);
    await service.resolve();
    expect(service.center()).toEqual([...UK_MAP_CENTER]);
    expect(service.zoom()).toBe(UK_MAP_ZOOM);
  });
});
