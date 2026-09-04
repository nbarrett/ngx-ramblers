import { directionParagraphsFromText, distanceAlongRouteMetres, routeDirectionsFromPage, routeDirectionsFromText, waypointsSpacedAlongRoute } from "./route-directions";
import { PageContent, PageContentType } from "../models/content-text.model";

const WINGHAM = `Kent Ramblers Walk 86

## Wingham (Four Water Mills Walk)

Park in the public car park in Wingham High Street.

1. From the car park turn right along the High Street past Wingham Post Office.
1. Leave the village along the road towards Littlebourne.
1. When after 100 metres the lane turns sharp right, continue on along a track.

This walk was originally published on a calendar.`;

describe("routeDirectionsFromText", () => {
  it("collects markdown numbered items whether or not they are numbered in sequence", () => {
    expect(routeDirectionsFromText(WINGHAM)).toEqual([
      "From the car park turn right along the High Street past Wingham Post Office.",
      "Leave the village along the road towards Littlebourne.",
      "When after 100 metres the lane turns sharp right, continue on along a track."
    ]);
  });

  it("accepts bracketed numbers and joins continuation lines until a blank line or heading", () => {
    const text = "(1) Turn left at the church\nand follow the lane.\n\n(2) Cross the stile.\n## Points of interest\nnot a direction";
    expect(routeDirectionsFromText(text)).toEqual(["Turn left at the church and follow the lane.", "Cross the stile."]);
  });

  it("returns nothing for prose without numbered steps", () => {
    expect(routeDirectionsFromText("Just a paragraph.\n\nAnother paragraph.")).toEqual([]);
  });
});

describe("directionParagraphsFromText", () => {
  const SHOREHAM = `This walk passes through the delightfully quiet Austin Lodge Valley. However, there are a couple of steep climbs.

Distance:   4.7 Miles (2 hours)

OS Map:   Explorer 147 (Start at grid reference TQ526615)

Park in the vicinity of Shoreham station. There is a lay-by immediately opposite the station.

Proceed down Station Road away from station and take path (Darent Valley Path) on right opposite entrance to Shoreham Place.

Cross road and turn left, keeping as far onto narrow verge as you can. Very shortly take path through gap in hedge.

Climb steeply through wood. At T-junction at top turn left.

This walk was devised by a member of the group.`;

  it("takes the run of paragraphs that read as instructions when there is no numbered list", () => {
    const paragraphs = directionParagraphsFromText(SHOREHAM);
    expect(paragraphs.length).toBe(3);
    expect(paragraphs[0]).toContain("Proceed down Station Road");
    expect(paragraphs[2]).toContain("Climb steeply through wood");
  });

  it("gives nothing for text with fewer than two instruction paragraphs", () => {
    expect(directionParagraphsFromText("Distance: 4 miles\n\nA lovely walk with views.")).toEqual([]);
  });

  it("is used by the page extractor as a fallback", () => {
    const page = {path: "x", rows: [{type: PageContentType.TEXT, showSwiper: false, columns: [{columns: 12, contentText: SHOREHAM}]}]} as PageContent;
    expect(routeDirectionsFromPage(page).length).toBe(3);
  });
});

describe("routeDirectionsFromPage", () => {
  it("finds the longest numbered list anywhere in the page, including nested rows", () => {
    const page = {
      path: "walks/routes/test",
      rows: [
        {type: PageContentType.TEXT, showSwiper: false, columns: [{columns: 12, contentText: "1. Only one item here"}]},
        {
          type: PageContentType.TEXT, showSwiper: false, columns: [{
            columns: 8,
            rows: [{type: PageContentType.TEXT, showSwiper: false, columns: [{columns: 12, contentText: WINGHAM}]}]
          }]
        }
      ]
    } as PageContent;
    expect(routeDirectionsFromPage(page).length).toBe(3);
    expect(routeDirectionsFromPage(null)).toEqual([]);
  });

  it("ignores a lone numbered item", () => {
    const page = {path: "x", rows: [{type: PageContentType.TEXT, showSwiper: false, columns: [{columns: 12, contentText: "1. Only one"}]}]} as PageContent;
    expect(routeDirectionsFromPage(page)).toEqual([]);
  });
});

describe("waypointsSpacedAlongRoute", () => {
  const line = [0, 0.01, 0.02, 0.03, 0.04].map(offset => ({latitude: 51 + offset, longitude: 1}));

  it("places the first direction at the start and the rest evenly along the line", () => {
    const ids = ["a", "b", "c", "d"];
    const markers = waypointsSpacedAlongRoute(line, ["one", "two", "three", "four"], () => ids.shift() || "z");
    expect(markers.map(marker => marker.label)).toEqual(["1", "2", "3", "4"]);
    expect(markers.map(marker => marker.instruction)).toEqual(["one", "two", "three", "four"]);
    expect(markers.map(marker => Number(marker.latitude.toFixed(3)))).toEqual([51, 51.01, 51.02, 51.03]);
    expect(markers.map(marker => marker.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("measures how far along the line a marker sits, using the nearest track point", () => {
    const halfway = distanceAlongRouteMetres(line, {latitude: 51.0201, longitude: 1.0001});
    expect(Math.round(halfway)).toBe(Math.round(2 * 0.01 * 111195));
    expect(distanceAlongRouteMetres(line, {latitude: 51, longitude: 1})).toBe(0);
    expect(distanceAlongRouteMetres([line[0]], line[1])).toBeNull();
  });

  it("returns nothing without a usable line", () => {
    expect(waypointsSpacedAlongRoute([line[0]], ["one"], () => "a")).toEqual([]);
    expect(waypointsSpacedAlongRoute(line, [], () => "a")).toEqual([]);
  });
});
