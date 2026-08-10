import expect from "expect";
import {describe, it} from "mocha";
import {ContentMetadataItem, ImageTag} from "../../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import {copiedImageMetadata, mappedTags} from "./content-metadata-copy";

describe("Content metadata image copy", () => {
  it("copies descriptive metadata without sharing the source object", () => {
    const source: ContentMetadataItem = {
      _id: "source-id",
      image: "source.jpg",
      originalFileName: "walk.jpg",
      text: "Kerry's walk",
      date: 123,
      dateSource: "walk",
      eventId: "event-id",
      tags: [4],
      cropperPosition: {x1: 1, y1: 2, x2: 3, y2: 4}
    };

    const copied = copiedImageMetadata(source, "destination.jpg", [8]);

    expect(copied).toMatchObject({
      image: "destination.jpg",
      originalFileName: "walk.jpg",
      text: "Kerry's walk",
      date: 123,
      dateSource: "walk",
      eventId: "event-id",
      tags: [8]
    });
    expect(copied._id).toBeUndefined();
    expect(copied.cropperPosition).toEqual(null);
    expect(source.image).toEqual("source.jpg");
    expect(source.cropperPosition.x1).toEqual(1);
  });

  it("fills missing photo metadata from the source album context", () => {
    const source: ContentMetadataItem = {
      image: "source.jpg",
      originalFileName: "walk.jpg",
      date: 200,
      dateSource: "upload",
      tags: []
    };

    const copied = copiedImageMetadata(source, "destination.jpg", [], {
      date: 100,
      dateSource: "walks",
      eventId: "event-id",
      text: "Grove Ferry 13 mile circular"
    });

    expect(copied).toMatchObject({
      date: 100,
      dateSource: "walks",
      eventId: "event-id",
      text: "Grove Ferry 13 mile circular"
    });
  });

  it("reuses destination tags by name and creates missing tags", () => {
    const sourceTags: ImageTag[] = [
      {key: 4, subject: "Walks"},
      {key: 7, subject: "Countryside", excludeFromRecent: true}
    ];
    const destinationTags: ImageTag[] = [{key: 2, subject: "walks"}];

    const result = mappedTags(sourceTags, destinationTags, [4, 7]);

    expect(result.keys).toEqual([2, 3]);
    expect(result.tags).toEqual([
      {key: 2, subject: "walks"},
      {key: 3, subject: "Countryside", excludeFromRecent: true}
    ]);
    expect(destinationTags).toEqual([{key: 2, subject: "walks"}]);
  });
});
