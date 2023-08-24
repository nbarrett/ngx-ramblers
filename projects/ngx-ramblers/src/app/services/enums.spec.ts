import { enumForKey, enumKeyForValue, enumKeys, enumKeyValues, enumValueForKey, enumValues } from "./enums";

enum TestEnum {
  PROJECT_LEVEL = "project-level",
  TEST_LEVEL = "test-level",
  OPTIONS = "options"
}

export enum TestEnumNoValues {
  "undefined",
  "Request",
  "Backlog",
  "In Due Course",
  "On Hold",
  "To Do"
}

describe("when using enumForKey", () => {

  it("should resolve Enum if passed in uppercase or lowercase", () => {
    expect(enumForKey(TestEnum, "PROJECT_LEVEL")).toEqual(TestEnum.PROJECT_LEVEL);
    expect(enumForKey(TestEnum, "TEST_LEVEL")).toEqual(TestEnum.TEST_LEVEL);
    expect(enumForKey(TestEnum, "OPTIONS")).toEqual(TestEnum.OPTIONS);
  });

  it("should return undefined if key doesn't match", () => {
    expect(enumForKey(TestEnum, "wrong-level")).toBeUndefined();
  });

});

describe("when using enumValueForKey", () => {

  it("should return an enum for the supplied key", () => {
    expect(enumValueForKey(TestEnum, TestEnum.PROJECT_LEVEL)).toEqual("project-level");
    expect(enumValueForKey(TestEnum, TestEnum.TEST_LEVEL)).toEqual("test-level");
    expect(enumValueForKey(TestEnum, TestEnum.OPTIONS)).toEqual("options");
  });

});

describe("when using enumKeyForValue", () => {

  it("should return an enum key as a string when supplied value", () => {
    expect(enumKeyForValue(TestEnum, "project-level")).toEqual("PROJECT_LEVEL");
    expect(enumKeyForValue(TestEnum, "test-level")).toEqual("TEST_LEVEL");
    expect(enumKeyForValue(TestEnum, "options")).toEqual("OPTIONS");
  });

  it("should return an enum key as a string when supplied enum", () => {
    expect(enumKeyForValue(TestEnum, TestEnum.TEST_LEVEL)).toEqual("TEST_LEVEL");
  });

});

describe("when using enumValues", () => {

  it("should return an array of strings given an enum with values", () => {
    expect(enumValues(TestEnum)).toEqual(["project-level", "test-level", "options"]);
  });

  it("should return an array of numbers given an enum with no values", () => {
    expect(enumValues(TestEnumNoValues)).toEqual([0, 1, 2, 3, 4, 5]);
  });

});

describe("when using enumKeys", () => {

  it("should return an array of strings given an enum with values", () => {
    expect(enumKeys(TestEnum)).toEqual(["PROJECT_LEVEL", "TEST_LEVEL", "OPTIONS"]);
  });

  it("should return an array of strings given an enum with no values", () => {
    expect(enumKeys(TestEnumNoValues)).toEqual(["undefined", "Request", "Backlog", "In Due Course", "On Hold", "To Do"]);
  });

});

describe("when using enumKeyValues", () => {

  it("should return an array of strings given an enum with values", () => {
    expect(enumKeyValues(TestEnum)).toEqual([
      {key: "PROJECT_LEVEL", value: "project-level"},
      {key: "TEST_LEVEL", value: "test-level",},
      {key: "OPTIONS", value: "options",}]);
  });

  it("should return an array of strings given an enum with no values", () => {
    expect(enumKeyValues(TestEnumNoValues)).toEqual([
      {key: "undefined", value: 0},
      {key: "Request", value: 1},
      {key: "Backlog", value: 2},
      {key: "In Due Course", value: 3},
      {key: "On Hold", value: 4},
      {key: "To Do", value: 5}]);
  });

});
