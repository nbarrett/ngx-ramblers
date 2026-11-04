import expect from "expect";
import { describe, it } from "mocha";
import {
  eventGalleryAlbumLinksFromHtml,
  eventGalleryImagesFromHtml,
  eventGalleryIndexImages,
  eventGalleryPaginationUrls,
  isEventGalleryAlbumUrl,
  isEventGalleryListingHtml,
  isEventGalleryListingUrl,
  isGalleryPaginationPath,
  isQueryAlbumListingHtml,
  isQueryAlbumListingUrl,
  queryAlbumLinksFromHtml
} from "./event-gallery";

const listing = `
<div class="eventgallery-events-gridlist">
  <div class="item-container" data-eg-link="/our-pictures/event/Chessvalley2026.html">
    <a href="/our-pictures/event/Chessvalley2026.html">
      <img alt="Chess Valley Walk Coach Ramble, Hertfordshire"
           src="https://group.example.org.uk/components/com_eventgallery/helpers/image.php?width=1600&folder=Chessvalley2026&file=one.jpeg"/>
    </a>
  </div>
  <div class="item-container" data-eg-link="/our-pictures/event/Sheffieldday1.html">
    <a href="/our-pictures/event/Sheffieldday1.html">
      <img alt="Sheffield Holiday Day 1"
           src="https://group.example.org.uk/components/com_eventgallery/helpers/image.php?width=1600&folder=Sheffieldday1&file=two.jpeg"/>
    </a>
  </div>
  <a href="/our-pictures.html?start=50">Page 2</a>
</div>`;

describe("event-gallery", () => {
  it("recognises Event Gallery from the Joomla component, not a menu alias", () => {
    expect(isEventGalleryListingUrl("https://group.example.org.uk/index.php?option=com_eventgallery&view=events")).toBe(true);
    expect(isEventGalleryListingUrl("https://group.example.org.uk/index.php?option=com_eventgallery&view=events&start=50")).toBe(true);
    expect(isEventGalleryListingUrl("https://group.example.org.uk/our-pictures.html?start=50")).toBe(true);
    expect(isEventGalleryAlbumUrl("https://group.example.org.uk/our-pictures/event/Chessvalley2026.html")).toBe(true);
    expect(isEventGalleryAlbumUrl("https://group.example.org.uk/index.php?option=com_eventgallery&view=event&folder=Chessvalley2026")).toBe(true);
    expect(isEventGalleryListingHtml(listing, "https://group.example.org.uk/our-pictures.html")).toBe(true);
    expect(isGalleryPaginationPath("photos/2", "https://group.example.org.uk/our-pictures.html?start=50")).toBe(true);
    expect(isGalleryPaginationPath("photos", "https://group.example.org.uk/our-pictures.html")).toBe(false);
  });

  it("reads album links and pagination from an Event Gallery listing", () => {
    const links = eventGalleryAlbumLinksFromHtml(listing, "https://group.example.org.uk/our-pictures.html");
    expect(links.map(link => [link.title, link.path.split("/").pop()])).toEqual([
      ["Chess Valley Walk Coach Ramble, Hertfordshire", "Chessvalley2026.html"],
      ["Sheffield Holiday Day 1", "Sheffieldday1.html"]
    ]);
    expect(eventGalleryPaginationUrls(listing, "https://group.example.org.uk/our-pictures.html")).toEqual([
      "https://group.example.org.uk/our-pictures.html?start=50"
    ]);
  });

  it("keeps full-size Event Gallery photos and treats many folders as an index", () => {
    const html = `<img data-src="https://group.example.org.uk/components/com_eventgallery/helpers/image.php?width=160&folder=Chessvalley2026&file=a.jpeg" src="/media/com_eventgallery/frontend/images/blank.gif" alt="Chess Valley"/>
      <img src="https://group.example.org.uk/components/com_eventgallery/helpers/image.php?width=1600&folder=Chessvalley2026&file=b.jpeg" alt=""/>`;
    expect(eventGalleryImagesFromHtml(html, "https://group.example.org.uk/our-pictures/event/Chessvalley2026.html").map(image => image.src)).toEqual([
      "https://group.example.org.uk/components/com_eventgallery/helpers/image.php?width=1600&folder=Chessvalley2026&file=a.jpeg",
      "https://group.example.org.uk/components/com_eventgallery/helpers/image.php?width=1600&folder=Chessvalley2026&file=b.jpeg"
    ]);
    expect(eventGalleryIndexImages([
      {src: "https://group.example.org.uk/components/com_eventgallery/helpers/image.php?folder=A&file=1.jpg"},
      {src: "https://group.example.org.uk/components/com_eventgallery/helpers/image.php?folder=B&file=1.jpg"},
      {src: "https://group.example.org.uk/components/com_eventgallery/helpers/image.php?folder=C&file=1.jpg"}
    ])).toBe(true);
  });

  it("reads query-parameter album listings used by PHP event galleries", () => {
    const html = `
      <a href="photodisplay.php?event_id=34"><img src="./images/events/34.jpg" alt=""/></a>
      <a href="photodisplay.php?event_id=34">Hillside Park 5 Feb 2026</a>
      <a href="photodisplay.php?event_id=35">Canal Path 8 Feb 26</a>
      <a href="photodisplay.php?event_id=36">River Meadow 15 Feb 26</a>`;
    const pageUrl = "https://group.example.org.uk/gallery/eventdisplay.php";
    expect(isQueryAlbumListingUrl(pageUrl)).toBe(true);
    expect(isQueryAlbumListingUrl("https://group.example.org.uk/gallery/photodisplay.php?event_id=34")).toBe(false);
    expect(queryAlbumLinksFromHtml(`
      <a href="walks.php?event_id=34">Sunday walk</a>
      <a href="walks.php?event_id=35">Wednesday walk</a>
      <a href="walks.php?event_id=36">Evening walk</a>`, "https://group.example.org.uk/walks.php")).toEqual([]);
    expect(isQueryAlbumListingHtml(html, pageUrl)).toBe(true);
    expect(queryAlbumLinksFromHtml(html, pageUrl).map(link => [link.title, new URL(link.path).searchParams.get("event_id")])).toEqual([
      ["Hillside Park 5 Feb 2026", "34"],
      ["Canal Path 8 Feb 26", "35"],
      ["River Meadow 15 Feb 26", "36"]
    ]);
    expect(queryAlbumLinksFromHtml(`
      <a href="photodisplay.php?event_id=34"><img src="./images/events/34.jpg"></a>
      <a href="photodisplay.php?event_id=35"><img src="./images/events/35.jpg"></a>
      <a href="photodisplay.php?event_id=36"><img src="./images/events/36.jpg"></a>`, pageUrl).map(link => link.title)).toEqual([
      "Album 34", "Album 35", "Album 36"
    ]);
  });
});
