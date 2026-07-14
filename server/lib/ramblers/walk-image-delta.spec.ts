import expect from "expect";
import { describe, it } from "mocha";
import { ExistingWalkImage, WalkImageUpload } from "../models/walk-upload-metadata";
import { calculateWalkImageDelta, imageIdentity, MAXIMUM_RAMBLERS_WALK_IMAGES } from "./walk-image-delta";

const desiredImage = (fileName: string, alternativeText: string): WalkImageUpload => ({
  alternativeText,
  fileName,
  filePath: `/tmp/ramblers/job/images/walk-1/${fileName}`
});

const existingImage = (href: string, alternativeText: string): ExistingWalkImage => ({fileName: href, alternativeText});

describe("imageIdentity", () => {

  it("reduces a ramblers cdn preview url and a local file name to the same identity", () => {
    expect(imageIdentity("https://cdn.ramblers.org.uk/styles/thumbnail/s3/2026-07/woodland-path.jpeg?itok=mdM1Zw8U"))
      .toEqual(imageIdentity("woodland-path.jpeg"));
  });

  it("ignores the numeric suffix walks manager adds to duplicate file names", () => {
    expect(imageIdentity("woodland-path_0.jpg")).toEqual(imageIdentity("woodland-path.jpeg"));
  });
});

describe("calculateWalkImageDelta", () => {

  it("adds every image when the walk has none", () => {
    const desired = [desiredImage("first.jpeg", "First"), desiredImage("second.jpeg", "Second")];
    expect(calculateWalkImageDelta([], desired)).toEqual({
      fullReplace: false,
      removalIndexes: [],
      additions: desired,
      unchanged: 0,
      reorderRequired: false,
      alternativeTextUpdates: 2
    });
  });

  it("makes no changes when the existing images already match", () => {
    const existing = [existingImage("https://cdn.ramblers.org.uk/first.jpeg", "First"), existingImage("https://cdn.ramblers.org.uk/second.jpeg", "Second")];
    const desired = [desiredImage("first.jpeg", "First"), desiredImage("second.jpeg", "Second")];
    expect(calculateWalkImageDelta(existing, desired)).toEqual({
      fullReplace: false,
      removalIndexes: [],
      additions: [],
      unchanged: 2,
      reorderRequired: false,
      alternativeTextUpdates: 0
    });
  });

  it("adds only the new image and keeps the ones already uploaded", () => {
    const existing = [existingImage("https://cdn.ramblers.org.uk/first.jpeg", "First"), existingImage("https://cdn.ramblers.org.uk/second.jpeg", "Second")];
    const desired = [desiredImage("first.jpeg", "First"), desiredImage("second.jpeg", "Second"), desiredImage("third.jpeg", "Third")];
    expect(calculateWalkImageDelta(existing, desired)).toEqual({
      fullReplace: false,
      removalIndexes: [],
      additions: [desired[2]],
      unchanged: 2,
      reorderRequired: false,
      alternativeTextUpdates: 1
    });
  });

  it("removes only the image no longer held locally", () => {
    const existing = [
      existingImage("https://cdn.ramblers.org.uk/first.jpeg", "First"),
      existingImage("https://cdn.ramblers.org.uk/second.jpeg", "Second"),
      existingImage("https://cdn.ramblers.org.uk/third.jpeg", "Third")
    ];
    const desired = [desiredImage("first.jpeg", "First"), desiredImage("second.jpeg", "Second")];
    expect(calculateWalkImageDelta(existing, desired)).toEqual({
      fullReplace: false,
      removalIndexes: [2],
      additions: [],
      unchanged: 2,
      reorderRequired: false,
      alternativeTextUpdates: 0
    });
  });

  it("updates alternative text without re-uploading the image", () => {
    const existing = [existingImage("https://cdn.ramblers.org.uk/first.jpeg", "Old caption")];
    const desired = [desiredImage("first.jpeg", "New caption")];
    expect(calculateWalkImageDelta(existing, desired)).toEqual({
      fullReplace: false,
      removalIndexes: [],
      additions: [],
      unchanged: 1,
      reorderRequired: false,
      alternativeTextUpdates: 1
    });
  });

  it("removes every image when the walk no longer has any locally", () => {
    const existing = [existingImage("https://cdn.ramblers.org.uk/first.jpeg", "First")];
    expect(calculateWalkImageDelta(existing, [])).toEqual({
      fullReplace: false,
      removalIndexes: [0],
      additions: [],
      unchanged: 0,
      reorderRequired: false,
      alternativeTextUpdates: 0
    });
  });

  it("reorders rather than re-uploading when the existing images are in the wrong order", () => {
    const existing = [existingImage("https://cdn.ramblers.org.uk/second.jpeg", "Second"), existingImage("https://cdn.ramblers.org.uk/first.jpeg", "First")];
    const desired = [desiredImage("first.jpeg", "First"), desiredImage("second.jpeg", "Second")];
    expect(calculateWalkImageDelta(existing, desired)).toEqual({
      fullReplace: false,
      removalIndexes: [],
      additions: [],
      unchanged: 2,
      alternativeTextUpdates: 0,
      reorderRequired: true
    });
  });

  it("adds a new image and reorders when it belongs before an existing one", () => {
    const existing = [existingImage("https://cdn.ramblers.org.uk/second.jpeg", "Second")];
    const desired = [desiredImage("first.jpeg", "First"), desiredImage("second.jpeg", "Second")];
    expect(calculateWalkImageDelta(existing, desired)).toEqual({
      fullReplace: false,
      removalIndexes: [],
      additions: [desired[0]],
      unchanged: 1,
      alternativeTextUpdates: 1,
      reorderRequired: true
    });
  });

  it("replaces everything when an existing image cannot be identified", () => {
    const existing = [existingImage("", "Unknown")];
    const desired = [desiredImage("first.jpeg", "First")];
    expect(calculateWalkImageDelta(existing, desired)).toEqual({
      fullReplace: true,
      removalIndexes: [0],
      additions: desired,
      unchanged: 0,
      alternativeTextUpdates: 1,
      reorderRequired: false
    });
  });

  it("never sends more than the ramblers maximum of five images", () => {
    const desired = Array.from({length: 8}, (value, index) => desiredImage(`image-${index}.jpeg`, `Image ${index}`));
    const delta = calculateWalkImageDelta([], desired);
    expect(delta.additions.length).toEqual(MAXIMUM_RAMBLERS_WALK_IMAGES);
    expect(delta.additions.map(image => image.fileName)).toEqual(["image-0.jpeg", "image-1.jpeg", "image-2.jpeg", "image-3.jpeg", "image-4.jpeg"]);
  });

  it("keeps the first five when the sixth local image is dropped", () => {
    const existing = Array.from({length: 5}, (value, index) => existingImage(`https://cdn.ramblers.org.uk/image-${index}.jpeg`, `Image ${index}`));
    const desired = Array.from({length: 6}, (value, index) => desiredImage(`image-${index}.jpeg`, `Image ${index}`));
    expect(calculateWalkImageDelta(existing, desired)).toEqual({
      fullReplace: false,
      removalIndexes: [],
      additions: [],
      unchanged: 5,
      reorderRequired: false,
      alternativeTextUpdates: 0
    });
  });
});
