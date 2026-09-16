import expect from "expect";
import { describe, it } from "mocha";
import { flickrGroupNamesIn, flickrGroupPoolFromHtml } from "./flickr-provider";

const poolHtml = `<html><head><title>Flickr: The Hike Essex Pool</title></head><body>
<div class="pool-photo photo-display-item" id="photo_21202650971" data-photo-id="21202650971" data-photo-owner="23206608@N06">
  <a href="/photos/23206608@N06/21202650971/in/pool-hikeessex" title="Stage 8: Canewdon Circular">
  <img src="https://live.staticflickr.com/619/21202650971_a80d447946.jpg" width="394" height="295" alt="Stage 8: Canewdon Circular &amp; lunch" class="pc_img"></a></div>
<div class="pool-photo photo-display-item" id="photo_14845334850" data-photo-id="14845334850" data-photo-owner="127115900@N03">
  <a href="/photos/127115900@N03/14845334850/in/pool-hikeessex" title="">
  <img src="https://combo.staticflickr.com/pw/images/spaceout.gif" data-defer-src="https://live.staticflickr.com/3861/14845334850_636bd294f9_n.jpg" alt="" class="pc_img defer" data-thumbdata="%7B%22sizes%22%3A%7B%22l%22%3A%5B500%2C375%5D%2C%22b%22%3A%5B0%2C0%5D%2C%22n%22%3A%5B320%2C240%5D%7D%7D"></a></div>
<div class="pool-photo photo-display-item" id="photo_555" data-photo-id="555" data-photo-owner="1@N00">
  <a href="/photos/1@N00/555/in/pool-hikeessex" title="video">no image here</a></div>
</body></html>`;

describe("Flickr group pool", () => {
  it("finds Flickr group names linked from migrated page text", () => {
    expect(flickrGroupNamesIn("To link to our Flickr site: [http://www.flickr.com/groups/hikeessex](http://www.flickr.com/groups/HikeEssex/)")).toEqual(["hikeessex"]);
    expect(flickrGroupNamesIn("No Flickr here")).toEqual([]);
  });

  it("reads each pool photo at its largest available size, including lazy-loaded ones, with the group title", () => {
    expect(flickrGroupPoolFromHtml(poolHtml)).toEqual({
      title: "Hike Essex",
      photos: [
        {src: "https://live.staticflickr.com/619/21202650971_a80d447946.jpg", alt: "Stage 8: Canewdon Circular & lunch"},
        {src: "https://live.staticflickr.com/3861/14845334850_636bd294f9.jpg", alt: ""}
      ]
    });
  });
});
