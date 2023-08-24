import {sortBy} from "./arrays";

interface SomeNestedStructure {
  field1: {
    stringValue: string;
    numberValue: number;
  };
  field2: {
    stringValue: string;
    numberValue: number;
  };
}

let unsortedTags: any[];
let tagsSortedByName: any[];
let unsortedNestedStructure: SomeNestedStructure[];

beforeEach(() => {
  unsortedTags = [
    {name: "release_149.123", commit: "abc1", major: "release_149", minor: 123},
    {name: "release_149.125", commit: "abc2", major: "release_149", minor: 125},
    {name: "release_149.124", commit: "abc3", major: "release_149", minor: 124},
    {name: "release_148.2", commit: "abc4", major: "release_148", minor: 2},
    {name: "master.2", commit: "abc4", major: "master", minor: 2},
    {name: "master.200", commit: "abc4", major: "master", minor: 200},
    {name: "master.1", commit: "abc4", major: "master", minor: 1},
    {name: "master.100", commit: "abc4", major: "master", minor: 100},
    {name: "release_148.100", commit: "abc4", major: "release_148", minor: 100},
    {name: "release_148.1", commit: "abc4", major: "release_148", minor: 1},
  ];

  tagsSortedByName = [
    {name: "master.1", commit: "abc4", major: "master", minor: 1},
    {name: "master.100", commit: "abc4", major: "master", minor: 100},
    {name: "master.2", commit: "abc4", major: "master", minor: 2},
    {name: "master.200", commit: "abc4", major: "master", minor: 200},
    {name: "release_148.1", commit: "abc4", major: "release_148", minor: 1},
    {name: "release_148.100", commit: "abc4", major: "release_148", minor: 100},
    {name: "release_148.2", commit: "abc4", major: "release_148", minor: 2},
    {name: "release_149.123", commit: "abc1", major: "release_149", minor: 123},
    {name: "release_149.124", commit: "abc3", major: "release_149", minor: 124},
    {name: "release_149.125", commit: "abc2", major: "release_149", minor: 125},
  ];
  unsortedNestedStructure = [
    {field1: {numberValue: 1, stringValue: "D"}, field2: {numberValue: 10, stringValue: "DD"}},
    {field1: {numberValue: 2, stringValue: "B"}, field2: {numberValue: 11, stringValue: "BB"}},
    {field1: {numberValue: 1, stringValue: "C"}, field2: {numberValue: 12, stringValue: "AA"}},
    {field1: {numberValue: 3, stringValue: "A"}, field2: {numberValue: 13, stringValue: "CC"}},
    {field1: {numberValue: 2, stringValue: "F"}, field2: {numberValue: 14, stringValue: "AC"}},
    {field1: {numberValue: 3, stringValue: "G"}, field2: {numberValue: 15, stringValue: "AB"}},
  ];

});

describe("when sorting by single property", () => {

  it("should sort ascending when property supplied without prefix", () => {
    expect(unsortedTags.sort(sortBy("name"))).toEqual(tagsSortedByName);
  });

  it("should sort descending when property supplied with - prefix", () => {
    expect(unsortedTags.sort(sortBy("-name"))).toEqual(tagsSortedByName.reverse());
  });

});

describe("when sorting by single property with nested syntax", () => {

  it("should sort ascending when property supplied without prefix", () => {
    expect(unsortedNestedStructure.sort(sortBy("field2.stringValue"))).toEqual([
        {field1: {numberValue: 1, stringValue: "C"}, field2: {numberValue: 12, stringValue: "AA"}},
        {field1: {numberValue: 3, stringValue: "G"}, field2: {numberValue: 15, stringValue: "AB"}},
        {field1: {numberValue: 2, stringValue: "F"}, field2: {numberValue: 14, stringValue: "AC"}},
        {field1: {numberValue: 2, stringValue: "B"}, field2: {numberValue: 11, stringValue: "BB"}},
        {field1: {numberValue: 3, stringValue: "A"}, field2: {numberValue: 13, stringValue: "CC"}},
        {field1: {numberValue: 1, stringValue: "D"}, field2: {numberValue: 10, stringValue: "DD"}},
      ]
    );
  });

  it("should sort ascending when property supplied with prefix", () => {
    expect(unsortedNestedStructure.sort(sortBy("-field2.numberValue"))).toEqual([
        {field1: {numberValue: 3, stringValue: "G"}, field2: {numberValue: 15, stringValue: "AB"}},
        {field1: {numberValue: 2, stringValue: "F"}, field2: {numberValue: 14, stringValue: "AC"}},
        {field1: {numberValue: 3, stringValue: "A"}, field2: {numberValue: 13, stringValue: "CC"}},
        {field1: {numberValue: 1, stringValue: "C"}, field2: {numberValue: 12, stringValue: "AA"}},
        {field1: {numberValue: 2, stringValue: "B"}, field2: {numberValue: 11, stringValue: "BB"}},
        {field1: {numberValue: 1, stringValue: "D"}, field2: {numberValue: 10, stringValue: "DD"}},
      ]
    );
  });

});

describe("when sorting by multiple properties", () => {

  it("should sort ascending when property supplied without prefix", () => {
    expect(unsortedTags.sort(sortBy("major", "minor"))).toEqual([
      {name: "master.1", commit: "abc4", major: "master", minor: 1},
      {name: "master.2", commit: "abc4", major: "master", minor: 2},
      {name: "master.100", commit: "abc4", major: "master", minor: 100},
      {name: "master.200", commit: "abc4", major: "master", minor: 200},
      {name: "release_148.1", commit: "abc4", major: "release_148", minor: 1},
      {name: "release_148.2", commit: "abc4", major: "release_148", minor: 2},
      {name: "release_148.100", commit: "abc4", major: "release_148", minor: 100},
      {name: "release_149.123", commit: "abc1", major: "release_149", minor: 123},
      {name: "release_149.124", commit: "abc3", major: "release_149", minor: 124},
      {name: "release_149.125", commit: "abc2", major: "release_149", minor: 125},
    ]);
  });

  it("should sort descending when properties supplied with - prefix", () => {
    expect(unsortedTags.sort(sortBy("-major", "-minor"))).toEqual([
      {name: "release_149.125", commit: "abc2", major: "release_149", minor: 125},
      {name: "release_149.124", commit: "abc3", major: "release_149", minor: 124},
      {name: "release_149.123", commit: "abc1", major: "release_149", minor: 123},
      {name: "release_148.100", commit: "abc4", major: "release_148", minor: 100},
      {name: "release_148.2", commit: "abc4", major: "release_148", minor: 2},
      {name: "release_148.1", commit: "abc4", major: "release_148", minor: 1},
      {name: "master.200", commit: "abc4", major: "master", minor: 200},
      {name: "master.100", commit: "abc4", major: "master", minor: 100},
      {name: "master.2", commit: "abc4", major: "master", minor: 2},
      {name: "master.1", commit: "abc4", major: "master", minor: 1},
    ]);
  });

});

describe("when sorting by multiple properties with nested syntax", () => {

  it("should sort ascending when properties supplied without prefix", () => {
    expect(unsortedNestedStructure.sort(sortBy("field1.numberValue", "field2.stringValue"))).toEqual([
        {field1: {numberValue: 1, stringValue: "C"}, field2: {numberValue: 12, stringValue: "AA"}},
        {field1: {numberValue: 1, stringValue: "D"}, field2: {numberValue: 10, stringValue: "DD"}},
        {field1: {numberValue: 2, stringValue: "F"}, field2: {numberValue: 14, stringValue: "AC"}},
        {field1: {numberValue: 2, stringValue: "B"}, field2: {numberValue: 11, stringValue: "BB"}},
        {field1: {numberValue: 3, stringValue: "G"}, field2: {numberValue: 15, stringValue: "AB"}},
        {field1: {numberValue: 3, stringValue: "A"}, field2: {numberValue: 13, stringValue: "CC"}},
      ]
    );
  });

  it("should sort ascending when properties supplied with prefix", () => {
    expect(unsortedNestedStructure.sort(sortBy("field1.numberValue", "-field2.stringValue"))).toEqual([
        {field1: {numberValue: 1, stringValue: "D"}, field2: {numberValue: 10, stringValue: "DD"}},
        {field1: {numberValue: 1, stringValue: "C"}, field2: {numberValue: 12, stringValue: "AA"}},
        {field1: {numberValue: 2, stringValue: "B"}, field2: {numberValue: 11, stringValue: "BB"}},
        {field1: {numberValue: 2, stringValue: "F"}, field2: {numberValue: 14, stringValue: "AC"}},
        {field1: {numberValue: 3, stringValue: "A"}, field2: {numberValue: 13, stringValue: "CC"}},
        {field1: {numberValue: 3, stringValue: "G"}, field2: {numberValue: 15, stringValue: "AB"}},
      ]
    );
  });

});
