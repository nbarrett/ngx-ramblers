import expect from "expect";
import { describe, it } from "mocha";
import { JSDOM } from "jsdom";
import { albumContentImages, layoutImage, withoutLayoutImages } from "./image-filter";
import { toKebabCase } from "../../../projects/ngx-ramblers/src/app/functions/strings";

describe("migration image filtering", () => {
  it("removes navigation graphics from gallery markup before markdown conversion", () => {
    const html = `<a href="/gallery"><img src="/images/arrow_left.gif" alt="Home"></a>
      <img src="/icons/next.png"><img src="/images/loading.gif">
      <img src="/gallery/01-canal.jpg" alt="Photo">
      <img src="/gallery/02-bridge.jpg" alt="Home Farm bridge">
      <img src="/gallery/03-display.jpg" alt="Photo">`;
    const filtered = withoutLayoutImages(html, "https://group.example.org.uk/gallery");
    const document = new JSDOM(filtered).window.document;
    expect([...document.querySelectorAll("img")].map(image => image.getAttribute("src"))).toEqual([
      "/gallery/01-canal.jpg", "/gallery/02-bridge.jpg", "/gallery/03-display.jpg"
    ]);
  });

  it("recognises control labels and encoded icon filenames without excluding photo captions", () => {
    expect(layoutImage({src: "https://group.example.org.uk/images/control.gif", alt: "Previous Image"})).toEqual(true);
    expect(layoutImage({src: "https://group.example.org.uk/images/arrow%5Fleft.gif", alt: ""})).toEqual(true);
    expect(layoutImage({src: "https://group.example.org.uk/photos/walkers-playing.jpg", alt: "Walkers playing in the snow"})).toEqual(false);
  });

  it("treats gallery title tildes as word separators in page paths", () => {
    expect(toKebabCase("Canal & Hillside Park~December 2025__")).toEqual("canal-hillside-park-december-2025");
  });

  it("keeps each album photo once and produces the same result when filtered again", () => {
    const photo = {src: "https://group.example.org.uk/photos/canal.jpg", alt: "Canal"};
    const images = [photo, {src: "https://group.example.org.uk/images/arrow_left.gif", alt: "Home"}, {...photo}];
    expect(albumContentImages(images)).toEqual([photo]);
    expect(albumContentImages(albumContentImages(images))).toEqual([photo]);
  });

  it("keeps gallery index thumbnails out of photo albums", () => {
    const photo = {src: "https://group.example.org.uk/gallery/photos/park.jpg", alt: "Park"};
    const images = [
      {src: "https://group.example.org.uk/gallery/park/thumb.jpg", alt: ""},
      {src: "https://group.example.org.uk/gallery/thumbs/canal.jpg", alt: ""},
      photo
    ];
    expect(albumContentImages(images)).toEqual([photo]);
  });
});
