import expect from "expect";
import { describe, it } from "mocha";
import { buildEventCaption, captionFingerprint, eventCaptionInputFrom } from "./event-caption-builder";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { EventCaptionInput } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";

describe("event-caption-builder", () => {

  const fullInput: EventCaptionInput = {
    title: "Chilham circular",
    description: "A gentle loop through the orchards.",
    date: "Saturday, 15 August 2026",
    time: "10:00 am",
    startLocation: "Chilham Square, CT4 8BY",
    distance: "6.5 miles",
    grade: "Easy",
    leader: "Jo Bloggs",
    url: "https://example.org/walks/chilham-circular"
  };

  it("substitutes every placeholder in the default template", () => {
    const caption = buildEventCaption(fullInput);
    expect(caption).toContain("Chilham circular");
    expect(caption).toContain("Saturday, 15 August 2026 at 10:00 am");
    expect(caption).toContain("Starting from Chilham Square, CT4 8BY");
    expect(caption).toContain("6.5 miles · Easy");
    expect(caption).toContain("https://example.org/walks/chilham-circular");
  });

  it("leaves out a line whose placeholders are all empty", () => {
    const caption = buildEventCaption({...fullInput, distance: "", grade: ""});
    expect(caption).not.toContain("·");
    expect(caption).toContain("Chilham circular");
    expect(caption).toContain("Starting from Chilham Square, CT4 8BY");
  });

  it("keeps a partially populated line and tidies the separator", () => {
    const caption = buildEventCaption({...fullInput, distance: ""});
    expect(caption).toContain("Easy");
    expect(caption).not.toContain("· Easy");
  });

  it("honours a custom template and ignores unknown placeholders", () => {
    const caption = buildEventCaption(fullInput, "Join us: {title} on {date}. {unknownToken}");
    expect(caption).toContain("Join us: Chilham circular on Saturday, 15 August 2026. {unknownToken}");
  });

  it("adds a link back to the event when a custom template leaves it out", () => {
    const caption = buildEventCaption(fullInput, "Join us: {title}");
    expect(caption).toEqual("Join us: Chilham circular\n\nFull details: https://example.org/walks/chilham-circular");
  });

  it("does not repeat the link when the template already includes it", () => {
    const caption = buildEventCaption(fullInput, "{title} - {url}");
    expect(caption.match(/https:\/\/example\.org\/walks\/chilham-circular/g)).toHaveLength(1);
  });

  it("leaves the caption alone when there is no event url to link to", () => {
    const caption = buildEventCaption({...fullInput, url: ""}, "Join us: {title}");
    expect(caption).toEqual("Join us: Chilham circular");
  });

  it("collapses the blank lines left behind by dropped lines", () => {
    const caption = buildEventCaption({...fullInput, description: "", distance: "", grade: ""});
    expect(caption).not.toContain("\n\n\n");
  });

  it("strips markdown from the event description", () => {
    const event = {
      groupEvent: {
        title: "Coastal walk",
        description: "See the **cliffs** and [the bay](https://example.org/bay) ![photo](https://example.org/a.jpg)",
        start_date_time: "2026-08-15T10:00:00+01:00",
        distance_miles: 6.5,
        difficulty: {code: "easy", description: "Easy"},
        start_location: {description: "Dover seafront", postcode: "CT16 1LW"}
      },
      fields: {contactDetails: {displayName: "Jo Bloggs"}}
    } as unknown as ExtendedGroupEvent;
    const input = eventCaptionInputFrom(event, "https://example.org/walks/coastal-walk");
    expect(input.description).toEqual("See the cliffs and the bay");
    expect(input.distance).toEqual("6.5 miles");
    expect(input.grade).toEqual("Easy");
    expect(input.leader).toEqual("Jo Bloggs");
    expect(input.startLocation).toEqual("Dover seafront, CT16 1LW");
  });

  it("omits the distance when the event has none", () => {
    const event = {groupEvent: {title: "Pub social", start_date_time: "2026-08-15T19:30:00+01:00"}} as unknown as ExtendedGroupEvent;
    const input = eventCaptionInputFrom(event, "https://example.org/social/pub-social");
    expect(input.distance).toEqual("");
    expect(input.grade).toEqual("");
  });

  it("produces a stable fingerprint that changes with the caption", () => {
    const caption = buildEventCaption(fullInput);
    expect(captionFingerprint(caption)).toEqual(captionFingerprint(buildEventCaption(fullInput)));
    expect(captionFingerprint(caption)).not.toEqual(captionFingerprint(buildEventCaption({...fullInput, time: "11:00 am"})));
  });
});
