import {
  buildAccessibilityCriteria,
  buildAdvancedSearchCriteria,
  buildDaysOfWeekCriteria,
  buildDifficultyCriteria,
  buildDistanceRangeCriteria,
  buildFacilitiesCriteria,
  buildFreeOnlyCriteria,
  buildGroupCodesCriteria,
  buildLeaderIdsCriteria,
  buildProximityCriteria
} from "./advanced-search-criteria-builder";
import { EventField, GroupEventField } from "../../models/walk.model";
import { AdvancedSearchCriteria } from "../../models/search.model";
import { DateUtilsService } from "../../services/date-utils.service";

describe("Advanced Search Criteria Builder", () => {
  let mockDateUtils: jasmine.SpyObj<DateUtilsService>;

  beforeEach(() => {
    mockDateUtils = jasmine.createSpyObj("DateUtilsService", ["daysOfWeek", "mongoDayOfWeekFromName"]);
    mockDateUtils.daysOfWeek.and.returnValue([
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ]);
    mockDateUtils.mongoDayOfWeekFromName.and.callFake((dayName: string) => {
      const days: { [key: string]: number } = {
        "Sunday": 1,
        "Monday": 2,
        "Tuesday": 3,
        "Wednesday": 4,
        "Thursday": 5,
        "Friday": 6,
        "Saturday": 7
      };
      return days[dayName] || null;
    });
  });

  describe("buildProximityCriteria", () => {
    it("should build correct bounding box query for proximity search", () => {
      const lat = 51.5074;
      const lng = -0.1278;
      const radiusMiles = 10;

      const criteria = buildProximityCriteria(lat, lng, radiusMiles);

      expect(criteria.$and).toBeDefined();
      expect(criteria.$and.length).toBe(2);
      expect(criteria.$and[0][GroupEventField.START_LOCATION_LATITUDE]).toBeDefined();
      expect(criteria.$and[1][GroupEventField.START_LOCATION_LONGITUDE]).toBeDefined();
    });

    it("should calculate correct latitude bounds", () => {
      const lat = 51.5;
      const lng = -0.1;
      const radiusMiles = 10;
      const radiusDegrees = radiusMiles / 69;

      const criteria = buildProximityCriteria(lat, lng, radiusMiles);

      const latCriteria = criteria.$and[0][GroupEventField.START_LOCATION_LATITUDE];
      expect(latCriteria.$gte).toBeCloseTo(lat - radiusDegrees, 5);
      expect(latCriteria.$lte).toBeCloseTo(lat + radiusDegrees, 5);
    });

    it("should calculate correct longitude bounds adjusted for latitude", () => {
      const lat = 51.5;
      const lng = -0.1;
      const radiusMiles = 10;
      const radiusDegrees = radiusMiles / 69;
      const lngAdjustment = radiusDegrees / Math.cos(lat * Math.PI / 180);

      const criteria = buildProximityCriteria(lat, lng, radiusMiles);

      const lngCriteria = criteria.$and[1][GroupEventField.START_LOCATION_LONGITUDE];
      expect(lngCriteria.$gte).toBeCloseTo(lng - lngAdjustment, 5);
      expect(lngCriteria.$lte).toBeCloseTo(lng + lngAdjustment, 5);
    });
  });

  describe("buildDaysOfWeekCriteria", () => {
    it("should build criteria for selected days of week", () => {
      const daysOfWeek = ["Monday", "Wednesday", "Friday"];

      const criteria = buildDaysOfWeekCriteria(daysOfWeek, mockDateUtils);

      expect(criteria).toBeTruthy();
      expect(criteria.$expr).toBeDefined();
      expect(criteria.$expr.$in).toBeDefined();
      expect(criteria.$expr.$in[1]).toEqual([2, 4, 6]);
    });

    it("should return null when no valid days provided", () => {
      const criteria = buildDaysOfWeekCriteria([], mockDateUtils);
      expect(criteria).toBeNull();
    });

    it("should filter out invalid day names", () => {
      const daysOfWeek = ["Monday", "InvalidDay", "Friday"];

      const criteria = buildDaysOfWeekCriteria(daysOfWeek, mockDateUtils);

      expect(criteria.$expr.$in[1]).toEqual([2, 6]);
    });

    it("should convert day indexes to MongoDB day numbers", () => {
      const daysOfWeek = ["Sunday"];

      const criteria = buildDaysOfWeekCriteria(daysOfWeek, mockDateUtils);

      expect(criteria.$expr.$in[1]).toEqual([1]);
    });
  });

  describe("buildDifficultyCriteria", () => {
    it("should build criteria for difficulty levels", () => {
      const difficulty = ["Easy", "Moderate"];

      const criteria = buildDifficultyCriteria(difficulty);

      expect(criteria[`${GroupEventField.DIFFICULTY}.description`]).toEqual({ $in: difficulty });
    });

    it("should handle single difficulty level", () => {
      const difficulty = ["Strenuous"];

      const criteria = buildDifficultyCriteria(difficulty);

      expect(criteria[`${GroupEventField.DIFFICULTY}.description`].$in).toEqual(difficulty);
    });
  });

  describe("buildDistanceRangeCriteria", () => {
    it("should build criteria with both min and max distance", () => {
      const criteria = buildDistanceRangeCriteria(5, 15);

      expect(criteria[GroupEventField.DISTANCE_MILES]).toEqual({
        $gte: 5,
        $lte: 15
      });
    });

    it("should build criteria with only min distance", () => {
      const criteria = buildDistanceRangeCriteria(10, undefined);

      expect(criteria[GroupEventField.DISTANCE_MILES]).toEqual({ $gte: 10 });
    });

    it("should build criteria with only max distance", () => {
      const criteria = buildDistanceRangeCriteria(undefined, 20);

      expect(criteria[GroupEventField.DISTANCE_MILES]).toEqual({ $lte: 20 });
    });

    it("should return null when neither min nor max provided", () => {
      const criteria = buildDistanceRangeCriteria(undefined, undefined);

      expect(criteria).toBeNull();
    });

    it("should return null when both are non-numeric", () => {
      const criteria = buildDistanceRangeCriteria(NaN, NaN);

      expect(criteria).toBeNull();
    });
  });

  describe("buildAccessibilityCriteria", () => {
    it("should build criteria for accessibility features", () => {
      const accessibility = ["Wheelchair accessible", "Dog friendly"];

      const criteria = buildAccessibilityCriteria(accessibility);

      expect(criteria[`${GroupEventField.ACCESSIBILITY}.description`]).toEqual({ $in: accessibility });
    });
  });

  describe("buildFacilitiesCriteria", () => {
    it("should build criteria for facilities", () => {
      const facilities = ["Parking", "Toilets"];

      const criteria = buildFacilitiesCriteria(facilities);

      expect(criteria[`${GroupEventField.FACILITIES}.description`]).toEqual({ $in: facilities });
    });
  });

  describe("buildFreeOnlyCriteria", () => {
    it("should build criteria for free-only walks", () => {
      const criteria = buildFreeOnlyCriteria();

      expect(criteria.$or).toBeDefined();
      expect(criteria.$or.length).toBe(3);
      expect(criteria.$or[0]).toEqual({ [GroupEventField.EXTERNAL_URL]: { $exists: false } });
      expect(criteria.$or[1]).toEqual({ [GroupEventField.EXTERNAL_URL]: null });
      expect(criteria.$or[2]).toEqual({ [GroupEventField.EXTERNAL_URL]: "" });
    });
  });

  describe("buildLeaderIdsCriteria", () => {
    it("should build criteria for MongoDB IDs", () => {
      const mongoIds = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"];

      const criteria = buildLeaderIdsCriteria(mongoIds);

      expect(criteria[EventField.CONTACT_DETAILS_MEMBER_ID]).toEqual({ $in: mongoIds });
    });

    it("should build criteria for composite IDs with group code and name", () => {
      const compositeIds = ["kt-01-steve-brown"];

      const criteria = buildLeaderIdsCriteria(compositeIds);

      expect(criteria.$and).toBeDefined();
      expect(criteria.$and[0][GroupEventField.GROUP_CODE]).toBeDefined();
      expect(criteria.$and[0][GroupEventField.GROUP_CODE].$regex).toBe("^KT01$");
      expect(criteria.$and[0][GroupEventField.GROUP_CODE].$options).toBe("i");
    });

    it("should combine MongoDB IDs and composite IDs with $or", () => {
      const mixedIds = ["507f1f77bcf86cd799439011", "kt-01-steve-brown"];

      const criteria = buildLeaderIdsCriteria(mixedIds);

      expect(criteria.$or).toBeDefined();
      expect(criteria.$or.length).toBe(2);
    });

    it("should return empty match criteria when no valid IDs provided", () => {
      const criteria = buildLeaderIdsCriteria([]);

      expect(criteria._id).toBeDefined();
      expect(criteria._id.$exists).toBe(false);
    });
  });

  describe("buildGroupCodesCriteria", () => {
    it("should build case-insensitive regex criteria for single group code", () => {
      const groupCodes = ["GRP001"];

      const criteria = buildGroupCodesCriteria(groupCodes);

      expect(criteria[GroupEventField.GROUP_CODE]).toBeDefined();
      expect(criteria[GroupEventField.GROUP_CODE].$regex).toBe("^GRP001$");
      expect(criteria[GroupEventField.GROUP_CODE].$options).toBe("i");
    });

    it("should build $or criteria for multiple group codes", () => {
      const groupCodes = ["GRP001", "GRP002"];

      const criteria = buildGroupCodesCriteria(groupCodes);

      expect(criteria.$or).toBeDefined();
      expect(criteria.$or.length).toBe(2);
      expect(criteria.$or[0][GroupEventField.GROUP_CODE].$regex).toBe("^GRP001$");
      expect(criteria.$or[1][GroupEventField.GROUP_CODE].$regex).toBe("^GRP002$");
    });
  });

  describe("buildAdvancedSearchCriteria", () => {
    it("should return empty array when no criteria provided", () => {
      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: undefined,
        dateUtils: mockDateUtils
      });

      expect(criteria).toEqual([]);
    });

    it("should build proximity search criteria", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        proximityLat: 51.5074,
        proximityLng: -0.1278,
        proximityRadiusMiles: 10
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(1);
      expect(criteria[0].$and).toBeDefined();
      expect(criteria[0].$and[0][GroupEventField.START_LOCATION_LATITUDE]).toBeDefined();
    });

    it("should not build proximity criteria when any coordinate is missing", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        proximityLat: 51.5074,
        proximityRadiusMiles: 10
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(0);
    });

    it("should build multiple criteria when multiple filters provided", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        proximityLat: 51.5074,
        proximityLng: -0.1278,
        proximityRadiusMiles: 10,
        difficulty: ["Moderate"],
        distanceMin: 5,
        distanceMax: 15,
        freeOnly: true
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(4);
    });

    it("should build leader IDs criteria", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        leaderIds: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(1);
      expect(criteria[0][EventField.CONTACT_DETAILS_MEMBER_ID]).toBeDefined();
    });

    it("should build group codes criteria", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        groupCodes: ["GRP001"]
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(1);
      expect(criteria[0][GroupEventField.GROUP_CODE]).toBeDefined();
    });

    it("should build days of week criteria", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        daysOfWeek: ["Monday", "Friday"]
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(1);
      expect(criteria[0].$expr).toBeDefined();
    });

    it("should skip days of week criteria when all days are invalid", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        daysOfWeek: ["InvalidDay"]
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(0);
    });

    it("should build accessibility criteria", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        accessibility: ["Wheelchair accessible"]
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(1);
      expect(criteria[0][`${GroupEventField.ACCESSIBILITY}.description`]).toBeDefined();
    });

    it("should build facilities criteria", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        facilities: ["Parking"]
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(1);
      expect(criteria[0][`${GroupEventField.FACILITIES}.description`]).toBeDefined();
    });

    it("should build comprehensive criteria with all filters", () => {
      const searchCriteria: AdvancedSearchCriteria = {
        leaderIds: ["507f1f77bcf86cd799439011"],
        groupCodes: ["GRP001"],
        proximityLat: 51.5074,
        proximityLng: -0.1278,
        proximityRadiusMiles: 10,
        daysOfWeek: ["Monday"],
        difficulty: ["Moderate"],
        distanceMin: 5,
        distanceMax: 15,
        accessibility: ["Wheelchair accessible"],
        facilities: ["Parking"],
        freeOnly: true
      };

      const criteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: searchCriteria,
        dateUtils: mockDateUtils
      });

      expect(criteria.length).toBe(9);
      expect(criteria.some(c => c[EventField.CONTACT_DETAILS_MEMBER_ID])).toBe(true);
      expect(criteria.some(c => c[GroupEventField.GROUP_CODE])).toBe(true);
      expect(criteria.some(c => c.$and && c.$and[0][GroupEventField.START_LOCATION_LATITUDE])).toBe(true);
      expect(criteria.some(c => c.$expr && c.$expr.$in)).toBe(true);
      expect(criteria.some(c => c[`${GroupEventField.DIFFICULTY}.description`])).toBe(true);
      expect(criteria.some(c => c[GroupEventField.DISTANCE_MILES])).toBe(true);
      expect(criteria.some(c => c[`${GroupEventField.ACCESSIBILITY}.description`])).toBe(true);
      expect(criteria.some(c => c[`${GroupEventField.FACILITIES}.description`])).toBe(true);
      expect(criteria.some(c => c.$or && c.$or[0][GroupEventField.EXTERNAL_URL])).toBe(true);
    });
  });
});
