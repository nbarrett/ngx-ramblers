import expect from "expect";
import {describe, it} from "mocha";
import {ExtendedGroupEvent} from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import {fallbackAlbumImageTitle} from "./album-image-title";

describe("Album image title", () => {
  it("combines the walk leader's first name with the walk title", () => {
    const walk = {
      groupEvent: {
        title: "Grove Ferry 13 mile circular",
        walk_leader: {name: "Kerry Example"}
      }
    } as ExtendedGroupEvent;

    expect(fallbackAlbumImageTitle(walk, "Album title")).toEqual("Kerry's Grove Ferry 13 mile circular");
  });

  it("uses the album title when no linked walk title is available", () => {
    expect(fallbackAlbumImageTitle({} as ExtendedGroupEvent, "Grove Ferry walk")).toEqual("Grove Ferry walk");
  });
});
