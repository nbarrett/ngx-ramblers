import expect from "expect";
import { describe, it } from "mocha";
import {
  inferVenueTypeFromName,
  parseVenueFromText,
  parseVenueFromHtml,
  extractTextFromHtml,
  VenueTypeValue
} from "./venue-parser";
import { PROBLEMATIC_FIXTURES, VenueTestFixture } from "./venue-test-fixtures";

describe("venue-parser.inferVenueTypeFromName", () => {
  it("should identify pubs by common terms", () => {
    expect(inferVenueTypeFromName("The Kings Arms")).toEqual(VenueTypeValue.PUB);
    expect(inferVenueTypeFromName("Rose and Crown")).toEqual(VenueTypeValue.PUB);
    expect(inferVenueTypeFromName("The Bull Inn")).toEqual(VenueTypeValue.PUB);
    expect(inferVenueTypeFromName("Duke of Cumberland")).toEqual(VenueTypeValue.PUB);
  });

  it("should identify stations", () => {
    expect(inferVenueTypeFromName("Dungeness Station")).toEqual(VenueTypeValue.STATION);
    expect(inferVenueTypeFromName("Canterbury West Railway Station")).toEqual(VenueTypeValue.STATION);
  });

  it("should identify cafes", () => {
    expect(inferVenueTypeFromName("The Tea Room")).toEqual(VenueTypeValue.CAFE);
    expect(inferVenueTypeFromName("Coffee Corner Café")).toEqual(VenueTypeValue.CAFE);
  });

  it("should identify halls", () => {
    expect(inferVenueTypeFromName("Village Hall")).toEqual(VenueTypeValue.HALL);
    expect(inferVenueTypeFromName("Community Centre")).toEqual(VenueTypeValue.HALL);
  });

  it("should identify churches", () => {
    expect(inferVenueTypeFromName("St Mary's Church")).toEqual(VenueTypeValue.CHURCH);
    expect(inferVenueTypeFromName("Canterbury Cathedral")).toEqual(VenueTypeValue.CHURCH);
  });

  it("should return OTHER for unrecognised names", () => {
    expect(inferVenueTypeFromName("Random Place")).toEqual(VenueTypeValue.OTHER);
    expect(inferVenueTypeFromName("")).toEqual(VenueTypeValue.OTHER);
  });
});

describe("venue-parser.parseVenueFromText", () => {
  it("should extract postcode from text", () => {
    const result = parseVenueFromText("The Kings Arms, High Street, Canterbury CT1 2AA");
    expect(result.venue.postcode).toEqual("CT1 2AA");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should extract venue name with pub indicator", () => {
    const result = parseVenueFromText("The Kings Arms\n123 High Street\nCanterbury\nCT1 2AA");
    expect(result.venue.name).toEqual("The Kings Arms");
    expect(result.venue.type).toEqual(VenueTypeValue.PUB);
  });

  it("should extract phone numbers", () => {
    const result = parseVenueFromText("Contact: 01234 567890\nThe Pub\nCT1 2AA");
    expect(result.venue.phone).toEqual("01234 567890");
  });

  it("should extract URLs", () => {
    const result = parseVenueFromText("Visit https://example.com for more info\nCT1 2AA");
    expect(result.venue.url).toEqual("https://example.com");
  });

  it("should filter out junk lines", () => {
    const result = parseVenueFromText("Home\nAbout Us\nThe Kings Arms\nHigh Street\nCT1 2AA");
    expect(result.venue.name).toEqual("The Kings Arms");
  });

  it("should return zero confidence for empty text", () => {
    const result = parseVenueFromText("");
    expect(result.confidence).toEqual(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("venue-parser.junk line filtering", () => {
  it("should filter navigation menu items", () => {
    const navText = "Plan Your Visit\nThings To Do\nSpecial Events\nThe Kings Arms\nHigh Street\nCT1 2AA";
    const result = parseVenueFromText(navText);
    expect(result.venue.name).toEqual("The Kings Arms");
  });

  it("should filter footer legal links", () => {
    const footerText = "Privacy\nCookies\nTerms and Conditions\nThe Kings Arms\nCT1 2AA";
    const result = parseVenueFromText(footerText);
    expect(result.venue.name).toEqual("The Kings Arms");
  });

  it("should filter back to top buttons", () => {
    const result = parseVenueFromText("Top\nBack to Top\nThe Kings Arms\nCT1 2AA");
    expect(result.venue.name).toEqual("The Kings Arms");
  });

  it("should filter concatenated nav items like footer links", () => {
    const result = parseVenueFromText("Allergies & Hygiene - Cookies - Privacy\nThe Kings Arms\nHigh Street\nCT1 2AA");
    expect(result.venue.name).toEqual("The Kings Arms");
  });

  it("should filter common website navigation patterns", () => {
    const patterns = [
      "Home",
      "About",
      "Gallery",
      "News & Events",
      "Menu",
      "Booking",
      "Contact",
      "Venue Hire"
    ];
    patterns.forEach(pattern => {
      const result = parseVenueFromText(`${pattern}\nThe Kings Arms\nCT1 2AA`);
      expect(result.venue.name).toEqual("The Kings Arms");
    });
  });

  it("should filter opening hours day names", () => {
    const result = parseVenueFromText("Monday - Thursday\n08:00 - 22:00\nThe Flying Horse\nUpper Bridge Street\nTN25 5AN");
    expect(result.venue.name).toEqual("The Flying Horse");
    expect(result.venue.address1).not.toContain("Monday");
  });

  it("should filter time ranges", () => {
    const result = parseVenueFromText("08:00 - 22:00\n9am - 5pm\nThe Kings Arms\nHigh Street\nCT1 2AA");
    expect(result.venue.name).toEqual("The Kings Arms");
    expect(result.venue.address1).not.toContain("08:00");
  });

  it("should filter day range patterns", () => {
    const dayPatterns = [
      "Monday - Sunday",
      "Mon - Fri",
      "Monday to Friday",
      "Weekdays",
      "Weekend"
    ];
    dayPatterns.forEach(pattern => {
      const result = parseVenueFromText(`${pattern}\nThe Kings Arms\nCT1 2AA`);
      expect(result.venue.name).toEqual("The Kings Arms");
    });
  });
});

describe("venue-parser.extractTextFromHtml", () => {
  it("should remove script tags", () => {
    const html = "<p>Hello</p><script>alert('x')</script><p>World</p>";
    const result = extractTextFromHtml(html);
    expect(result.includes("alert")).toBeFalsy();
    expect(result.includes("Hello")).toBeTruthy();
    expect(result.includes("World")).toBeTruthy();
  });

  it("should remove style tags", () => {
    const html = "<style>body{color:red}</style><p>Content</p>";
    const result = extractTextFromHtml(html);
    expect(result.includes("color")).toBeFalsy();
    expect(result.includes("Content")).toBeTruthy();
  });

  it("should remove nav tags", () => {
    const html = "<nav><a>Home</a><a>About</a></nav><main><p>Content</p></main>";
    const result = extractTextFromHtml(html);
    expect(result.includes("Home")).toBeFalsy();
    expect(result.includes("Content")).toBeTruthy();
  });

  it("should remove header and footer tags", () => {
    const html = "<header>Logo</header><main>Content</main><footer>Copyright</footer>";
    const result = extractTextFromHtml(html);
    expect(result.includes("Logo")).toBeFalsy();
    expect(result.includes("Copyright")).toBeFalsy();
    expect(result.includes("Content")).toBeTruthy();
  });
});

describe("venue-parser.parseVenueFromHtml", () => {
  it("should extract from JSON-LD structured data", () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Restaurant",
          "name": "The Kings Arms",
          "address": {
            "streetAddress": "123 High Street",
            "addressLocality": "Canterbury",
            "postalCode": "CT1 2AA"
          }
        }
        </script>
      </head>
      <body><p>Some content</p></body>
      </html>
    `;
    const result = parseVenueFromHtml(html);
    expect(result.venue.name).toEqual("The Kings Arms");
    expect(result.venue.address1).toEqual("123 High Street");
    expect(result.venue.postcode).toEqual("CT1 2AA");
    expect(result.confidence).toBeGreaterThan(50);
  });

  it("should extract venue name from H1 when no JSON-LD", () => {
    const html = `
      <html>
      <head><title>Dungeness Station - RHDR</title></head>
      <body>
        <nav><a>Home</a><a>About</a></nav>
        <main>
          <h1>Dungeness Station</h1>
          <address>123 Station Road, TN29 9NA</address>
        </main>
      </body>
      </html>
    `;
    const result = parseVenueFromHtml(html);
    expect(result.venue.name).toEqual("Dungeness Station");
    expect(result.venue.postcode).toEqual("TN29 9NA");
  });

  it("should use title when H1 is not available", () => {
    const html = `
      <html>
      <head><title>The Kings Arms - Canterbury</title></head>
      <body>
        <address>123 High Street, CT1 2AA</address>
      </body>
      </html>
    `;
    const result = parseVenueFromHtml(html);
    expect(result.venue.name).toEqual("The Kings Arms");
  });

  it("should extract from address tags", () => {
    const html = `
      <html>
      <body>
        <address>
          The Kings Arms<br>
          123 High Street<br>
          Canterbury<br>
          CT1 2AA
        </address>
      </body>
      </html>
    `;
    const result = parseVenueFromHtml(html);
    expect(result.venue.postcode).toEqual("CT1 2AA");
  });

  it("should set source URL when provided", () => {
    const html = "<html><body><h1>Test Venue</h1><p>CT1 2AA</p></body></html>";
    const result = parseVenueFromHtml(html, "https://example.com");
    expect(result.venue.url).toEqual("https://example.com");
  });

  it("should not pick up navigation menu items as venue name", () => {
    const html = `
      <html>
      <head><title>Duke of Cumberland - Barham</title></head>
      <body>
        <nav>
          <a>Home</a>
          <a>About</a>
          <a>Menu</a>
          <a>Booking</a>
        </nav>
        <main>
          <h1>The Duke of Cumberland</h1>
          <p>A traditional pub in the heart of Barham.</p>
        </main>
        <footer>
          <a>Allergies & Hygiene</a>
          <a>Cookies</a>
          <a>Privacy</a>
        </footer>
      </body>
      </html>
    `;
    const result = parseVenueFromHtml(html);
    expect(result.venue.name).toEqual("The Duke of Cumberland");
    expect(result.venue.name).not.toContain("Allergies");
    expect(result.venue.name).not.toContain("Cookies");
    expect(result.venue.name).not.toContain("Home");
  });
});

/**
 * Integration tests for known problematic venue URLs.
 * These tests document specific issues that have been fixed.
 * Each fixture records the URL, expected extraction results, and notes about the original issue.
 *
 * To add a new test case:
 * 1. Add the fixture to venue-test-fixtures.ts with the URL and expected results
 * 2. Add a test here that validates the fix
 *
 * For live URL testing, use: npm run test:server:integration
 * These tests are skipped by default to avoid network dependencies in CI.
 */
describe("venue-parser.documented issues", () => {
  it("should have documented problematic fixtures for reference", () => {
    expect(PROBLEMATIC_FIXTURES.length).toBeGreaterThan(0);
    PROBLEMATIC_FIXTURES.forEach(fixture => {
      expect(fixture.url).toBeTruthy();
      expect(fixture.expectedType).toBeTruthy();
      expect(fixture.notes).toBeTruthy();
    });
  });

  it("should filter RHDR navigation menu pattern", () => {
    // This test validates that nav menu items are filtered even when in body text.
    // The key assertion is that "Plan Your Visit", "Things to Do" etc are NOT extracted.
    const text = "Plan Your Visit\nThings to Do\nSpecial Events\nAbout Us\nDungeness Station\nTN29 9NA";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("Dungeness Station");
    expect(result.venue.type).toEqual("station");
    expect(result.venue.postcode).toEqual("TN29 9NA");
    expect(result.venue.name).not.toContain("Plan Your Visit");
    expect(result.venue.name).not.toContain("Things to Do");
  });

  it("should filter Duke of Cumberland footer legal links pattern", () => {
    const text = "Allergies & Hygiene - Cookies - Privacy\nTop\nThe Duke of Cumberland\nBarham, Kent";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The Duke of Cumberland");
    expect(result.venue.name).not.toContain("Allergies");
    expect(result.venue.name).not.toContain("Privacy");
  });

  it("should filter New Flying Horse opening hours pattern", () => {
    const text = "Monday - Thursday\n08:00 - 22:00\nFriday\n08:00 - 23:00\nThe New Flying Horse\nUpper Bridge Street\nWye\nTN25 5AN";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The New Flying Horse");
    expect(result.venue.postcode).toEqual("TN25 5AN");
    expect(result.venue.name).not.toContain("Monday");
    expect(result.venue.address1).not.toContain("08:00");
  });

  it("should filter call-to-action patterns like 'Dine With Us'", () => {
    const text = "Dine With Us\nBook Now\nThe Duke of Cumberland\nHigh Street\nCT4 6TJ";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The Duke of Cumberland");
    expect(result.venue.address1).not.toContain("Dine");
  });

  it("should filter marketing copy patterns", () => {
    const text = "Explore the versatile and unique menu offered at our traditional pub\nThe Duke of Cumberland\nHigh Street\nCT4 6TJ";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The Duke of Cumberland");
    expect(result.venue.address1).not.toContain("Explore");
    // address2 may be undefined if only one address line found
    if (result.venue.address2) {
      expect(result.venue.address2).not.toContain("versatile");
    }
  });

  it("should clean venue name by removing taglines from title", () => {
    const html = `
      <html>
      <head><title>The Duke of Cumberland Barham – Traditional Country Pub in The Heart of Barham</title></head>
      <body>
        <p>Welcome to our establishment. CT4 6TJ</p>
      </body>
      </html>
    `;
    const result = parseVenueFromHtml(html);
    expect(result.venue.name).toEqual("The Duke of Cumberland Barham");
    expect(result.venue.name).not.toContain("Traditional Country Pub");
  });

  it("should filter social media links like Facebook and Instagram", () => {
    const text = "Facebook\nInstagram\nTwitter\nThe Marquis of Granby\nAlkham\nCT15 7DF";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The Marquis of Granby");
    expect(result.venue.name).not.toContain("Facebook");
    expect(result.venue.name).not.toContain("Instagram");
  });

  it("should filter 'View All Opening Times' patterns", () => {
    const text = "View All Opening Times\nThe Red Lion\nThe Square\nLenham\nME17 2PG";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The Red Lion");
    expect(result.venue.address1).not.toContain("View All");
    expect(result.venue.address1).not.toContain("Opening Times");
  });

  it("should extract address from Marquis of Granby contact page structure", () => {
    const html = `
      <html>
      <head><title>Contact Us - The Marquis of Granby</title></head>
      <body>
        <div class="textwidget custom-html-widget">
          <h5 class="header-underline">Address</h5>
          Alkham Valley Rd, Alkham<br>
          Dover CT15 7DF
        </div>
      </body>
      </html>
    `;
    const result = parseVenueFromHtml(html);
    expect(result.venue.postcode).toEqual("CT15 7DF");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should filter marketing copy like 'An 18th century pub in the heart of'", () => {
    const text = "Bell & Jorrocks\nBiddenden Road\nAn 18th century pub in the heart of Frittenden\nTN17 2EJ";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("Bell & Jorrocks");
    expect(result.venue.address1).toEqual("Biddenden Road");
    expect(result.venue.postcode).toEqual("TN17 2EJ");
    if (result.venue.address2) {
      expect(result.venue.address2).not.toContain("18th century");
      expect(result.venue.address2).not.toContain("heart of");
    }
  });

  it("should filter email addresses from address fields", () => {
    const text = "Bell & Jorrocks\nBiddenden Road\ninfo@thebellandjorrocks.co.uk\nTN17 2EJ";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("Bell & Jorrocks");
    expect(result.venue.address1).toEqual("Biddenden Road");
    expect(result.venue.postcode).toEqual("TN17 2EJ");
    if (result.venue.address2) {
      expect(result.venue.address2).not.toContain("@");
    }
  });

  it("should filter 'Food' and similar menu navigation items", () => {
    const text = "Bell & Jorrocks\nFood\nDrinks\nBiddenden Road\nFrittenden\nTN17 2EJ";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("Bell & Jorrocks");
    expect(result.venue.postcode).toEqual("TN17 2EJ");
    if (result.venue.address1) {
      expect(result.venue.address1).not.toEqual("Food");
      expect(result.venue.address1).not.toEqual("Drinks");
    }
    if (result.venue.address2) {
      expect(result.venue.address2).not.toEqual("Food");
      expect(result.venue.address2).not.toEqual("Drinks");
    }
  });

  it("should extract Bell & Jorrocks venue from real contact page HTML", () => {
    const html = `<!DOCTYPE html>
<html>
<head>
<title>Contact the Bell and Jorrocks - Kentish Public House - Real Ales and good home cooked food - 01580 852415</title>
<meta name="Description" content="Contact Us, Get in touch - The bell and Jorrocks - Real Ales and good food, kentish pub in Kent. 01580 852415" />
</head>
<body>
<div class="header">
  <div class="wrapper"> <a href="/" class="logo"> <img src="/images/header-logo.png" alt="The BELL & JORROCKS - Home"/>
    <h2>BELL &amp; JORROCKS</h2>
    <br/>
    <p>An 18th century pub in the heart of Frittenden, Kent.</p>
    </a>
    <div class="headerRight">
      <ul>
        <li><a href="tel:01580852415" class="tel">01580 852 415</a></li>
        <li><a href="mailto:info@thebellandjorrocks.co.uk">info@thebellandjorrocks.co.uk </a></li>
      </ul>
    </div>
  </div>
  <div class="menu">
    <div class="wrapper">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/Kent-Real-Ale/file/traditional-pub-food.php">Food</a></li>
        <li><a href="/Kent-Real-Ale/file/real-ale.php">Real Ales</a></li>
        <li><a href="/Kent-Real-Ale/file/newevents.php">Music &amp; Events</a></li>
        <li><a href="/Kent-Real-Ale/file/pub-history.php">History</a></li>
        <li><a href="/Kent-Real-Ale/file/pictures.php">Pub Photos</a></li>
        <li class="active"><a href="/Kent-Real-Ale/file/contactus.php">Contact</a></li>
        <li><a href="/Kent-Real-Ale/file/localinfo.php">Local Info</a></li>
      </ul>
    </div>
  </div>
</div>
<div class="contentArea">
  <div class="wrapper">
    <div class="leftSection">
      <h3>Contact Us</h3>
      <p>The Bell &amp; Jorrocks<br />
      Biddenden road,<br />
      Frittenden<br />
      Kent<br />
      TN17 2EJ</p>
      <p>01580 852415</p>
      <p>Sean &amp; Rosie welcome you to their 18th century pub in the heart of Frittenden, famous for its treacle mines.</p>
    </div>
  </div>
</div>
<div class="footer">
  <div class="wrapper">
    <div class="footerLeft">
      <ul>
        <li><a href="/Kent-Real-Ale/file/links.php">Links</a></li>
        <li><a href="/Kent-Real-Ale/file/legal.php">Legal</a></li>
        <li><a href="/Kent-Real-Ale/file/sitemap.php">Sitemap</a></li>
      </ul>
    </div>
  </div>
</div>
</body>
</html>`;
    const result = parseVenueFromHtml(html, "https://www.thebellandjorrocks.co.uk");
    expect(result.venue.name).toEqual("BELL & JORROCKS");
    expect(result.venue.address1).toEqual("Biddenden road");
    expect(result.venue.address2).toEqual("Frittenden");
    expect(result.venue.postcode).toEqual("TN17 2EJ");
    expect(result.venue.type).toEqual("pub");
    expect(result.venue.url).toEqual("https://www.thebellandjorrocks.co.uk");
    expect(result.confidence).toBeGreaterThan(50);
  });

  it("should filter Gardens Gallery and Privacy & Cookies junk", () => {
    const text = "The Railway\nGardens Gallery\nPrivacy & Cookies\nHullbridge Road\nSouth Woodham Ferrers\nCM3 5NG";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The Railway");
    expect(result.venue.address1).toEqual("Hullbridge Road");
    expect(result.venue.address2).toEqual("South Woodham Ferrers");
    expect(result.venue.postcode).toEqual("CM3 5NG");
  });

  it("should filter concatenated CTA buttons like 'See Menu Book a Table'", () => {
    const text = "See Menu Book a Table\nThe Duke of Cumberland\nThe Street\nBarham\nCT4 6NY";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The Duke of Cumberland");
    if (result.venue.address1) {
      expect(result.venue.address1).not.toContain("See Menu");
      expect(result.venue.address1).not.toContain("Book a Table");
    }
  });

  it("should filter 'Raise A Glass' promotional headings as marketing copy", () => {
    const text = "Raise A Glass\nThe Duke of Cumberland\nThe Street\nBarham\nCT4 6NY";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The Duke of Cumberland");
    if (result.venue.address1) {
      expect(result.venue.address1).not.toContain("Raise A Glass");
    }
  });

  it("should filter 'Take a look at our...' marketing copy", () => {
    const text = "Take a look at our what's on section to see upcoming events\nThe Duke of Cumberland\nThe Street\nBarham\nCT4 6NY";
    const result = parseVenueFromText(text);
    expect(result.venue.name).toEqual("The Duke of Cumberland");
    if (result.venue.address1) {
      expect(result.venue.address1).not.toContain("Take a look");
    }
    if (result.venue.address2) {
      expect(result.venue.address2).not.toContain("upcoming events");
    }
  });
});
