import expect from "expect";
import { describe, it } from "mocha";
import { DiscoveredSocialNetwork, socialConfigUpdates, socialLinksFromHtml } from "./social-links";

const listing = `
<footer>
  <a href="https://www.facebook.com/groups/example">Facebook</a>
  <a href="https://www.instagram.com/examplegroup">Instagram</a>
  <a href="https://www.twitter.com/examplegroup">Twitter</a>
  <a href="https://www.facebook.com/sharer/sharer.php?u=https://group.example.org.uk/">Share</a>
</footer>`;

describe("social-links", () => {
  it("reads Facebook, Instagram and Twitter profile links and skips share buttons", () => {
    expect(socialLinksFromHtml(listing, "https://group.example.org.uk/")).toEqual([
      {network: DiscoveredSocialNetwork.FACEBOOK, url: "https://www.facebook.com/groups/example"},
      {network: DiscoveredSocialNetwork.INSTAGRAM, url: "https://www.instagram.com/examplegroup"},
      {network: DiscoveredSocialNetwork.TWITTER, url: "https://www.twitter.com/examplegroup"}
    ]);
  });

  it("writes footer-link flags onto system config paths", () => {
    expect(socialConfigUpdates([
      {network: DiscoveredSocialNetwork.FACEBOOK, url: "https://www.facebook.com/groups/example"}
    ])).toEqual({
      "value.externalSystems.facebook.groupUrl": "https://www.facebook.com/groups/example",
      "value.externalSystems.facebook.showFooterLink": true
    });
  });
});
