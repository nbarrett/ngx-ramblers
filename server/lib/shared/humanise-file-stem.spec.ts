import expect from "expect";
import { describe, it } from "mocha";
import { humaniseFileStemFromUrl } from "./string-utils";

describe("humaniseFileStemFromUrl", () => {
  it("turns a readable file name into a caption", () => {
    expect(humaniseFileStemFromUrl("https://group.example/images/canewdon-circular_walk.jpg")).toEqual("canewdon circular walk");
  });

  it("gives no caption for a file name made only of numbers, hex codes and size letters", () => {
    expect(humaniseFileStemFromUrl("https://live.staticflickr.com/5686/31702683443_29c6c49dc8_c.jpg")).toEqual("");
    expect(humaniseFileStemFromUrl("site-content/1d01a038.jpeg")).toEqual("");
  });
});
