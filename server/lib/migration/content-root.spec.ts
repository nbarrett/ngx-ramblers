import expect from "expect";
import { describe, it } from "mocha";
import { JSDOM } from "jsdom";
import {
  contentHtmlFromPage,
  firstMatchingElement,
  withoutLeadingNavigationMarkdown
} from "./content-root";
import { contentImagesFromHtml, withoutLayoutImages } from "./image-filter";
import { htmlToMarkdown } from "./turndown-service-factory";
import { queryAlbumLinksFromHtml } from "./event-gallery";

describe("migration content root", () => {
  it("prefers listed content wrappers over earlier chrome in the document", () => {
    const html = `<body>
      <div id="masthead"><img src="/images/banner.jpg"><ul id="navContainer">
        <li><a href="/index.php">Home</a></li>
        <li><a href="/walks.php">Walks Programme</a></li>
        <li><a href="/social.php">Social Events</a></li>
        <li><a href="/gallery/eventdisplay.php">Gallery</a></li>
      </ul></div>
      <div id="mainCcontent" class="content"><p>Welcome to the group.</p></div>
    </body>`;
    const document = new JSDOM(html, {url: "https://group.example.org.uk/about.php"}).window.document;
    expect(firstMatchingElement(document, "#BContent, main, article, #content, #mainContent, .content, [role=main]")?.id).toBe("mainCcontent");
    expect(contentHtmlFromPage(html, "https://group.example.org.uk/about.php",
      "#BContent, main, article, #content, #mainContent, .content, [role=main]",
      ["nav", "header", "footer", "#navContainer", "#masthead"]).replace(/\s+/g, " ").trim()).toContain("Welcome to the group.");
    expect(contentHtmlFromPage(html, "https://group.example.org.uk/about.php",
      "#BContent, main, article, #content, #mainContent, .content, [role=main]",
      ["nav", "header", "footer", "#navContainer", "#masthead"])).not.toContain("Walks Programme");
    expect(contentHtmlFromPage(html, "https://group.example.org.uk/about.php",
      "#BContent, main, article, #content, #mainContent, .content, [role=main]",
      ["nav", "header", "footer", "#navContainer", "#masthead"])).not.toContain("banner.jpg");
  });

  it("drops a site-menu list when the page has no content wrapper", () => {
    const html = `<body>
      <ul>
        <li><a href="/index.php">Home</a></li>
        <li><a href="/walks.php">Walks Programme</a></li>
        <li><a href="/social.php">Social Events</a></li>
        <li><a href="/gallery.php">Gallery</a></li>
        <li><a href="/contact.php">Contacts</a></li>
      </ul>
      <p>The group walks every Sunday.</p>
    </body>`;
    expect(contentHtmlFromPage(html, "https://group.example.org.uk/about.php", "#BContent, main, article, #content", []).replace(/\s+/g, " ")).toContain("The group walks every Sunday.");
    expect(contentHtmlFromPage(html, "https://group.example.org.uk/about.php", "#BContent, main, article, #content", [])).not.toContain("Walks Programme");
  });

  it("imports a PHP group page without the masthead banner or side menu", () => {
    const pageUrl = "https://group.example.org.uk/about.php";
    const html = `<div id="wrapper">
      <div id="masthead">
        <div id="logoImage"><img id="logo" src="images/banner.jpg"/></div>
        <div id="navContainer"><ul>
          <li><a href="index.php">Home</a></li>
          <li><a href="walks.php">Walks Programme</a></li>
          <li><a href="social.php">Social Events</a></li>
          <li><a href="gallery/eventdisplay.php">Gallery</a></li>
          <li><a href="contact.php">Contacts</a></li>
        </ul></div>
        <div id="pageHeader">About Hillside Park Ramblers</div>
      </div>
      <div align="center" id="mainCcontent" class="content">
        <div class="content" id="aboutText"><p>Hillside Park Ramblers are part of The Ramblers Association.</p></div>
      </div>
    </div>`;
    const selector = "#BContent, #content, #mainContent, #main-content, .main-content, .page-content, .content, article, main, [role=main]";
    const excludes = ["nav", "header", "footer", "#navContainer", "#masthead", "#pageHeader"];
    const content = contentHtmlFromPage(html, pageUrl, selector, excludes);
    const markdown = withoutLeadingNavigationMarkdown(htmlToMarkdown(withoutLayoutImages(content, pageUrl), pageUrl, true));
    expect(content).toContain("Hillside Park Ramblers are part of The Ramblers Association.");
    expect(content).not.toContain("Walks Programme");
    expect(content).not.toContain("banner.jpg");
    expect(markdown).toContain("Hillside Park Ramblers are part of The Ramblers Association.");
    expect(markdown).not.toContain("Walks Programme");
    expect(markdown).not.toContain("banner.jpg");
  });

  it("reads full-size photos from a PHP event gallery instead of thumbs and chrome", () => {
    const listing = `<a href="photodisplay.php?event_id=34"><img src="images/events/34.jpg"></a>
      <a href="photodisplay.php?event_id=35"><img src="images/events/35.jpg"></a>
      <a href="photodisplay.php?event_id=36"><img src="images/events/36.jpg"></a>`;
    const album = `<img id="logo" src="../images/banner.jpg"/>
      <img src="./images/backarrow.gif" alt="back to events"/>
      <img src="./images/thumbnails/212.jpg" data-large="./images/photos/212.jpg" alt="image01"/>
      <img src="./images/thumbnails/213.jpg" data-large="./images/photos/213.jpg" alt="image01"/>`;
    expect(queryAlbumLinksFromHtml(listing, "https://group.example.org.uk/gallery/eventdisplay.php").map(link => link.path)).toEqual([
      "https://group.example.org.uk/gallery/photodisplay.php?event_id=34",
      "https://group.example.org.uk/gallery/photodisplay.php?event_id=35",
      "https://group.example.org.uk/gallery/photodisplay.php?event_id=36"
    ]);
    expect(contentImagesFromHtml(album, "https://group.example.org.uk/gallery/photodisplay.php?event_id=34").map(image => image.src)).toEqual([
      "https://group.example.org.uk/gallery/images/photos/212.jpg",
      "https://group.example.org.uk/gallery/images/photos/213.jpg"
    ]);
  });

  it("keeps a leading list that is page content rather than site navigation", () => {
    const markdown = `* Easy
* Moderate
* Strenuous
* Technical

Walk grades are shown on each programme page.`;
    expect(withoutLeadingNavigationMarkdown(markdown)).toContain("* Easy");
    expect(withoutLeadingNavigationMarkdown(markdown)).toContain("Walk grades are shown on each programme page.");
  });

  it("turns select options into a list and drops form controls", () => {
    const html = `<div class="content">
      <select><option>Alex Reed</option><option>Jordan Blake</option></select>
      <input type="submit" value="Send">
      <p>Contact the committee.</p>
    </div>`;
    const content = contentHtmlFromPage(html, "https://group.example.org.uk/committee.php", ".content", []);
    expect(content).toContain("Alex Reed");
    expect(content).toContain("Jordan Blake");
    expect(content).toContain("<li>");
    expect(content).not.toContain("<select");
    expect(content).not.toContain("<input");
  });

  it("strips a leading navigation list from migrated markdown", () => {
    const markdown = `* Home
* Walks Programme
* [Social Events](/information/social-events)
* [Gallery](/photos)
* [Contacts](/contact-us)

Hillside Park Ramblers are part of The Ramblers Association.`;
    expect(withoutLeadingNavigationMarkdown(markdown)).toBe("Hillside Park Ramblers are part of The Ramblers Association.");
  });
});
