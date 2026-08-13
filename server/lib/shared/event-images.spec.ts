import expect from "expect";
import { describe, it } from "mocha";
import { absoluteImageUrl, eventImages, s3RelativePath } from "./event-images";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";

describe("event-images", () => {

  it("adds the S3 prefix to a bare file name", () => {
    expect(s3RelativePath("walk-images/abc.jpeg")).toEqual("api/aws/s3/walk-images/abc.jpeg");
  });

  it("does not add the S3 prefix twice when it is already there", () => {
    expect(s3RelativePath("api/aws/s3/walk-images/abc.jpeg")).toEqual("api/aws/s3/walk-images/abc.jpeg");
  });

  it("ignores a leading slash on the stored file name", () => {
    expect(s3RelativePath("/walk-images/abc.jpeg")).toEqual("api/aws/s3/walk-images/abc.jpeg");
  });

  it("builds an absolute url against the supplied base", () => {
    expect(absoluteImageUrl("walk-images/abc.jpeg", "https://www.ekwg.co.uk"))
      .toEqual("https://www.ekwg.co.uk/api/aws/s3/walk-images/abc.jpeg");
  });

  it("builds a localhost url when that is the base, so previews load while developing", () => {
    expect(absoluteImageUrl("walk-images/abc.jpeg", "http://localhost:4200/"))
      .toEqual("http://localhost:4200/api/aws/s3/walk-images/abc.jpeg");
  });

  it("leaves a remote url alone apart from encoding spaces", () => {
    expect(absoluteImageUrl("https://images.ramblers.org.uk/a b.jpg", "https://www.ekwg.co.uk"))
      .toEqual("https://images.ramblers.org.uk/a%20b.jpg");
  });

  it("resolves the medium style for each image on an event", () => {
    const event = {
      groupEvent: {
        media: [
          {styles: [{style: "large", url: "walk-images/large.jpeg"}, {style: "medium", url: "walk-images/medium.jpeg"}]},
          {styles: [{style: "original", url: "walk-images/only.jpeg"}]}
        ]
      }
    } as unknown as ExtendedGroupEvent;
    expect(eventImages(event, "https://www.ekwg.co.uk").map(image => image.url)).toEqual([
      "https://www.ekwg.co.uk/api/aws/s3/walk-images/medium.jpeg",
      "https://www.ekwg.co.uk/api/aws/s3/walk-images/only.jpeg"
    ]);
  });

  it("returns nothing when the event has no media", () => {
    expect(eventImages({groupEvent: {}} as unknown as ExtendedGroupEvent, "https://www.ekwg.co.uk")).toEqual([]);
  });
});
