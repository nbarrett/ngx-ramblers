import expect from "expect";
import { describe, it } from "mocha";
import { JSDOM } from "jsdom";
import { albumContentImages, contentImagesFromHtml, layoutImage, withoutLayoutImages } from "./image-filter";
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
      "https://group.example.org.uk/gallery/01-canal.jpg",
      "https://group.example.org.uk/gallery/02-bridge.jpg",
      "https://group.example.org.uk/gallery/03-display.jpg"
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

  it("rewrites data-large onto img src and drops leftover thumbs from page html", () => {
    const html = `<img src="/gallery/thumbs/park.jpg" data-large="/gallery/photos/park.jpg" alt="Park">
      <img src="/images/banner.jpg"><img src="/gallery/photos/park.jpg" alt="Park">`;
    const filtered = withoutLayoutImages(html, "https://group.example.org.uk/gallery/park");
    const document = new JSDOM(filtered).window.document;
    expect([...document.querySelectorAll("img")].map(image => image.getAttribute("src"))).toEqual([
      "https://group.example.org.uk/gallery/photos/park.jpg",
      "https://group.example.org.uk/gallery/photos/park.jpg"
    ]);
  });

  it("uses data-large photos instead of thumbnail sources", () => {
    const html = `<img id="logo" src="../images/banner.jpg"/>
      <img src="./images/thumbnails/212.jpg" data-large="./images/photos/212.jpg" alt="image01"/>
      <img src="./images/thumbnails/213.jpg" data-large="./images/photos/213.jpg" alt="image01"/>`;
    expect(contentImagesFromHtml(html, "https://group.example.org.uk/gallery/photodisplay.php?event_id=34").map(image => image.src)).toEqual([
      "https://group.example.org.uk/gallery/images/photos/212.jpg",
      "https://group.example.org.uk/gallery/images/photos/213.jpg"
    ]);
  });

  it("keeps site banners and back arrows out of photo albums", () => {
    const photo = {src: "https://group.example.org.uk/gallery/images/photos/212.jpg", alt: "image01"};
    expect(layoutImage({src: "https://group.example.org.uk/images/banner.jpg", alt: ""})).toEqual(true);
    expect(layoutImage({src: "https://group.example.org.uk/gallery/images/banner-on-the-hill.jpg", alt: "Banner on the hill"})).toEqual(false);
    expect(layoutImage({src: "https://group.example.org.uk/gallery/images/backarrow.gif", alt: "back to events"})).toEqual(true);
    expect(albumContentImages([
      {src: "https://group.example.org.uk/images/banner.jpg", alt: ""},
      {src: "https://group.example.org.uk/gallery/images/backarrow.gif", alt: "back to events"},
      {src: "https://group.example.org.uk/gallery/images/thumbnails/212.jpg", alt: "image01"},
      photo
    ])).toEqual([photo]);
  });
});
