import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { VenueParserService } from "./venue-parser.service";
import { VenueParseResult } from "../../models/event-venue.model";

describe("VenueParserService", () => {
  let service: VenueParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [VenueParserService]
    });
    service = TestBed.inject(VenueParserService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("parse", () => {

    describe("with empty or invalid input", () => {

      it("should return empty result for null input", () => {
        const result = service.parse(null as any);
        expect(result.confidence).toBe(0);
        expect(result.warnings).toContain("No text provided");
      });

      it("should return empty result for empty string", () => {
        const result = service.parse("");
        expect(result.confidence).toBe(0);
        expect(result.warnings).toContain("No text provided");
      });

      it("should return empty result for whitespace only", () => {
        const result = service.parse("   \n\t  ");
        expect(result.confidence).toBe(0);
        expect(result.warnings).toContain("No text provided");
      });

    });

    describe("with real venue examples", () => {

      it("should parse The Square pub address correctly", () => {
        const input = `The Square, St Mary's Rd, Elham
Canterbury CT4 6TJ`;

        const result: VenueParseResult = service.parse(input);

        expect(result.venue.postcode).toBe("CT4 6TJ");
        expect(result.venue.name).toBe("The Square");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse The Street Barham address correctly", () => {
        const input = "The Street, Barham CT4 6NY";

        const result: VenueParseResult = service.parse(input);

        expect(result.venue.postcode).toBe("CT4 6NY");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Bull Lane Bethersden address correctly (address-only, no venue name)", () => {
        const input = "Bull Lane, Bethersden, TN26 3LB";

        const result: VenueParseResult = service.parse(input);

        expect(result.venue.postcode).toBe("TN26 3LB");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse The George Community Pub multi-line address correctly", () => {
        const input = `The George Community Pub
The Street,

Bethersden.

TN26 3AG`;

        const result: VenueParseResult = service.parse(input);

        expect(result.venue.postcode).toBe("TN26 3AG");
        expect(result.venue.name).toBe("The George Community Pub");
        expect(result.venue.type).toBe("pub");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse The Black Robin full address correctly", () => {
        const input = `The Black Robin
Covet Lane
Kingston
Canterbury
Kent
CT4 6HS`;

        const result: VenueParseResult = service.parse(input);

        expect(result.venue.postcode).toBe("CT4 6HS");
        expect(result.venue.name).toBe("The Black Robin");
        expect(result.venue.type).toBe("pub");
        expect(result.venue.address1).toBe("Covet Lane");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse The Pig and Sty with URL correctly", () => {
        const input = "https://elitepubs.com/venue/the-pig-and-sty/contact/ You can find us on Ashford Rd, Bethersden, Ashford TN26 3LF";

        const result: VenueParseResult = service.parse(input);

        expect(result.venue.postcode).toBe("TN26 3LF");
        expect(result.venue.url).toBe("https://elitepubs.com/venue/the-pig-and-sty/contact/");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse The Lord Whisky Sanctuary Fund correctly", () => {
        const input = `The Lord Whisky Sanctuary Fund

Park House Animal Sanctuary

Stelling Minnis

Canterbury

Kent

CT4 6AN`;

        const result: VenueParseResult = service.parse(input);

        expect(result.venue.postcode).toBe("CT4 6AN");
        expect(result.venue.name).toBe("The Lord Whisky Sanctuary Fund");
        expect(result.venue.type).toBe("other");
        expect(result.confidence).toBeGreaterThan(0);
      });

    });

    describe("postcode extraction", () => {

      it("should extract standard UK postcode", () => {
        const result = service.parse("Some venue SW1A 1AA");
        expect(result.venue.postcode).toBe("SW1A 1AA");
      });

      it("should extract postcode without space", () => {
        const result = service.parse("Some venue CT46TJ");
        expect(result.venue.postcode).toBe("CT4 6TJ");
      });

      it("should extract postcode with lowercase letters", () => {
        const result = service.parse("Some venue ct4 6tj");
        expect(result.venue.postcode).toBe("CT4 6TJ");
      });

      it("should handle multiple postcodes and use the first one", () => {
        const result = service.parse("From SW1A 1AA to CT4 6TJ");
        expect(result.venue.postcode).toBe("SW1A 1AA");
        expect(result.warnings.length).toBeGreaterThan(0);
      });

    });

    describe("URL extraction", () => {

      it("should extract http URL", () => {
        const result = service.parse("The Pub http://example.com/pub CT4 6TJ");
        expect(result.venue.url).toBe("http://example.com/pub");
      });

      it("should extract https URL", () => {
        const result = service.parse("The Pub https://www.thesquareelham.co.uk CT4 6TJ");
        expect(result.venue.url).toBe("https://www.thesquareelham.co.uk");
      });

      it("should strip trailing punctuation from URL", () => {
        const result = service.parse("Visit https://example.com. for more info");
        expect(result.venue.url).toBe("https://example.com");
      });

    });

    describe("venue type inference", () => {

      it("should infer pub type from name containing 'pub'", () => {
        const result = service.parse("The Red Lion Pub CT4 6TJ");
        expect(result.venue.type).toBe("pub");
      });

      it("should infer pub type from name containing 'inn'", () => {
        const result = service.parse("The Kings Inn CT4 6TJ");
        expect(result.venue.type).toBe("pub");
      });

      it("should infer pub type from name containing 'arms'", () => {
        const result = service.parse("The Queens Arms CT4 6TJ");
        expect(result.venue.type).toBe("pub");
      });

      it("should infer cafe type", () => {
        const result = service.parse("The Village Cafe CT4 6TJ");
        expect(result.venue.type).toBe("cafe");
      });

      it("should infer restaurant type", () => {
        const result = service.parse("The Italian Restaurant CT4 6TJ");
        expect(result.venue.type).toBe("restaurant");
      });

      it("should infer church type", () => {
        const result = service.parse("St Mary's Church CT4 6TJ");
        expect(result.venue.type).toBe("church");
      });

      it("should infer hall type", () => {
        const result = service.parse("Village Hall CT4 6TJ");
        expect(result.venue.type).toBe("hall");
      });

      it("should infer car park type", () => {
        const result = service.parse("Station Car Park CT4 6TJ");
        expect(result.venue.type).toBe("car park");
      });

      it("should default to other for unrecognised venue", () => {
        const result = service.parse("Some Random Place CT4 6TJ");
        expect(result.venue.type).toBe("other");
      });

    });

    describe("confidence scoring", () => {

      it("should have confidence when postcode found", () => {
        const result = service.parse("Some location CT4 6TJ");
        expect(result.confidence).toBeGreaterThanOrEqual(30);
      });

      it("should have higher confidence with postcode and name", () => {
        const result = service.parse("The Red Lion Pub CT4 6TJ");
        expect(result.confidence).toBeGreaterThanOrEqual(55);
      });

      it("should have higher confidence with URL", () => {
        const withUrl = service.parse("The Pub https://example.com CT4 6TJ");
        const withoutUrl = service.parse("The Pub CT4 6TJ");
        expect(withUrl.confidence).toBeGreaterThan(withoutUrl.confidence);
      });

      it("should have low or zero confidence when no postcode found", () => {
        const result = service.parse("Some random text without postcode");
        expect(result.confidence).toBeLessThan(30);
      });

    });

    describe("Kent venue examples - pubs", () => {

      it("should parse Hare & Hounds Ashford", () => {
        const result = service.parse("Hare & Hounds, Maidstone Road, Ashford TN25 4NR");
        expect(result.venue.postcode).toBe("TN25 4NR");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Red Lion Biddenden", () => {
        const result = service.parse("Red Lion, 14 High Street, Biddenden TN27 8AH");
        expect(result.venue.postcode).toBe("TN27 8AH");
        expect(result.venue.name).toBe("Red Lion");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Three Chimneys Biddenden", () => {
        const result = service.parse("Three Chimneys, Hareplain Road, Biddenden TN27 8LW");
        expect(result.venue.postcode).toBe("TN27 8LW");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Oak on the Green Bearsted", () => {
        const result = service.parse("Oak on the Green, The Green, Bearsted ME14 4EJ");
        expect(result.venue.postcode).toBe("ME14 4EJ");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Rose Inn Bearsted", () => {
        const result = service.parse("Rose Inn, 87 Ashford Road, Bearsted ME14 4BS");
        expect(result.venue.postcode).toBe("ME14 4BS");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse White Horse Bearsted", () => {
        const result = service.parse("White Horse, The Green, Bearsted ME14 4DL");
        expect(result.venue.postcode).toBe("ME14 4DL");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Bull Barming", () => {
        const result = service.parse("The Bull, 5 Tonbridge Road, Barming ME16 9HB");
        expect(result.venue.postcode).toBe("ME16 9HB");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Chequers Aylesford", () => {
        const result = service.parse("Chequers, 61-63 High Street, Aylesford ME20 7AY");
        expect(result.venue.postcode).toBe("ME20 7AY");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Hook & Hatchet Hucking", () => {
        const result = service.parse("Hook & Hatchet, Church Road, Hucking ME17 1QT");
        expect(result.venue.postcode).toBe("ME17 1QT");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Plough Inn Langley", () => {
        const result = service.parse("Plough Inn, Sutton Road, Langley ME17 3LX");
        expect(result.venue.postcode).toBe("ME17 3LX");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Chequers Laddingford", () => {
        const result = service.parse("Chequers, The Street, Laddingford ME18 6BP");
        expect(result.venue.postcode).toBe("ME18 6BP");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Chequers Sevenoaks", () => {
        const result = service.parse("Chequers, 73 High Street, Sevenoaks TN13 1LD");
        expect(result.venue.postcode).toBe("TN13 1LD");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse White Hart Sevenoaks", () => {
        const result = service.parse("White Hart, Tonbridge Road, Sevenoaks TN13 1SG");
        expect(result.venue.postcode).toBe("TN13 1SG");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Kings Head Bessels Green", () => {
        const result = service.parse("King's Head, Bessels Green Road, Bessels Green TN13 2PT");
        expect(result.venue.postcode).toBe("TN13 2PT");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Bedford Tunbridge Wells", () => {
        const result = service.parse("The Bedford, 2 High St, Tunbridge Wells TN1 1UX");
        expect(result.venue.postcode).toBe("TN1 1UX");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Duke of York Tunbridge Wells", () => {
        const result = service.parse("Duke of York, 17 The Pantiles, Tunbridge Wells TN2 5TD");
        expect(result.venue.postcode).toBe("TN2 5TD");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Mount Edgcumbe Tunbridge Wells", () => {
        const result = service.parse("The Mount Edgcumbe, The Common, Tunbridge Wells TN4 8BX");
        expect(result.venue.postcode).toBe("TN4 8BX");
      });

      it("should parse Halfway House Brenchley", () => {
        const result = service.parse("Halfway House, Horsmonden Road, Brenchley TN12 7AX");
        expect(result.venue.postcode).toBe("TN12 7AX");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Old Gate Inn Canterbury", () => {
        const result = service.parse("Old Gate Inn, 162-164 New Dover Road, Canterbury CT1 3EL");
        expect(result.venue.postcode).toBe("CT1 3EL");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Parrot Canterbury", () => {
        const result = service.parse("The Parrot, 1-9 Church Lane, St Radigunds, Canterbury CT1 2AG");
        expect(result.venue.postcode).toBe("CT1 2AG");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Dolphin Canterbury", () => {
        const result = service.parse("Dolphin, 17 St Radigund's Street, Canterbury CT1 2AA");
        expect(result.venue.postcode).toBe("CT1 2AA");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse New Inn Canterbury", () => {
        const result = service.parse("New Inn, 19 Havelock Street, Canterbury CT1 1NP");
        expect(result.venue.postcode).toBe("CT1 1NP");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Old Buttermarket Canterbury", () => {
        const result = service.parse("Old Buttermarket, 39 Burgate, Canterbury CT1 2HW");
        expect(result.venue.postcode).toBe("CT1 2HW");
      });

      it("should parse Elephant Faversham", () => {
        const result = service.parse("The Elephant, 31 The Mall, Faversham ME13 8JN");
        expect(result.venue.postcode).toBe("ME13 8JN");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Shipwrights Arms Faversham", () => {
        const result = service.parse("Shipwright's Arms, Hollowshore, Faversham ME13 7TU");
        expect(result.venue.postcode).toBe("ME13 7TU");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse White Lion Selling", () => {
        const result = service.parse("The White Lion, The Street, Selling, Faversham ME13 9RQ");
        expect(result.venue.postcode).toBe("ME13 9RQ");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Breakwater Dover", () => {
        const result = service.parse("The Breakwater, St. Martins Yard, Lorne Rd, Dover CT16 2AA");
        expect(result.venue.postcode).toBe("CT16 2AA");
      });

      it("should parse White Horse Dover", () => {
        const result = service.parse("The White Horse Inn, High Street, Dover CT17 9RH");
        expect(result.venue.postcode).toBe("CT17 9RH");
        expect(result.venue.type).toBe("pub");
      });

    });

    describe("Kent venue examples - village halls and community centres", () => {

      it("should parse Godmersham Village Hall", () => {
        const result = service.parse("Godmersham & Crundale Village Hall, Canterbury Road, Godmersham CT4 7DR");
        expect(result.venue.postcode).toBe("CT4 7DR");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse Whitstable Umbrella Community Centre", () => {
        const result = service.parse("Whitstable Umbrella Community Centre, Oxford Street, Whitstable CT5 1DD");
        expect(result.venue.postcode).toBe("CT5 1DD");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse Westgate Hall Canterbury", () => {
        const result = service.parse("Westgate Hall, Westgate Hall Road, Canterbury CT1 2BT");
        expect(result.venue.postcode).toBe("CT1 2BT");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse Aldington Village Hall", () => {
        const result = service.parse("Aldington Village Hall, The Corner, Roman Road, Aldington, Ashford TN25 7EE");
        expect(result.venue.postcode).toBe("TN25 7EE");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse Biddenden Village Hall", () => {
        const result = service.parse("Biddenden Village Hall, Tenterden Rd, Biddenden, Ashford TN27 8BB");
        expect(result.venue.postcode).toBe("TN27 8BB");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse Chiddingstone Causeway Village Hall", () => {
        const result = service.parse("The Causeway Hall, Tonbridge Road, Chiddingstone Causeway TN11 8JS");
        expect(result.venue.postcode).toBe("TN11 8JS");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse St Edith Hall Kemsing", () => {
        const result = service.parse("St. Edith Hall, High Street, Kemsing, Sevenoaks TN15 6NA");
        expect(result.venue.postcode).toBe("TN15 6NA");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse Sissinghurst Village Hall", () => {
        const result = service.parse("St George's Institute, Jubilee Field, The Street, Sissinghurst, Cranbrook TN17 2JQ");
        expect(result.venue.postcode).toBe("TN17 2JQ");
      });

      it("should parse Aylesford Community Centre", () => {
        const result = service.parse("Aylesford Community Centre, 25 Forstal Road, Aylesford ME20 7AU");
        expect(result.venue.postcode).toBe("ME20 7AU");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse Bobbing Village Hall", () => {
        const result = service.parse("Bobbing Village Hall, Sheppey Way, Bobbing ME9 8PL");
        expect(result.venue.postcode).toBe("ME9 8PL");
        expect(result.venue.type).toBe("hall");
      });

    });

    describe("Kent venue examples - churches and church halls", () => {

      it("should parse Canterbury Baptist Church as church", () => {
        const result = service.parse("Canterbury Baptist Church, St. George's Place, Canterbury CT1 1UT");
        expect(result.venue.postcode).toBe("CT1 1UT");
        expect(result.venue.type).toBe("church");
      });

      it("should parse St George's Church Hall as hall", () => {
        const result = service.parse("St. George's Church Hall, Church Road, Weald, Sevenoaks TN14 6LT");
        expect(result.venue.postcode).toBe("TN14 6LT");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse St John Baptist Church Hall as hall", () => {
        const result = service.parse("St. John The Baptist Church Hall, Quakers Hall Lane, Sevenoaks TN13 3TX");
        expect(result.venue.postcode).toBe("TN13 3TX");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse St Luke's Church Hall as hall", () => {
        const result = service.parse("St. Luke's Church Hall, 30 Eardley Road, Sevenoaks TN13 1XT");
        expect(result.venue.postcode).toBe("TN13 1XT");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse St Mary's Church Hall as hall", () => {
        const result = service.parse("St. Mary's Church Hall, London Rd, Riverhead TN13 2BS");
        expect(result.venue.postcode).toBe("TN13 2BS");
        expect(result.venue.type).toBe("hall");
      });

      it("should parse Pembury Baptist Church as church", () => {
        const result = service.parse("Pembury Baptist Church, 1 Romford Road, Pembury TN2 4HR");
        expect(result.venue.postcode).toBe("TN2 4HR");
        expect(result.venue.type).toBe("church");
      });

      it("should parse St Peter's Church Hall as hall", () => {
        const result = service.parse("St Peter's Church Hall, 99 Queenborough Rd, Minster on Sea, Sheerness ME12 3DF");
        expect(result.venue.postcode).toBe("ME12 3DF");
        expect(result.venue.type).toBe("hall");
      });

    });

    describe("Kent venue examples - multi-line addresses", () => {

      it("should parse Kentish Hare multi-line", () => {
        const input = `The Kentish Hare
95 Bidborough Ridge
Bidborough
Tunbridge Wells
TN3 0XB`;
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("TN3 0XB");
        expect(result.venue.name).toBe("The Kentish Hare");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Great House Hawkhurst multi-line", () => {
        const input = `The Great House
Gill's Green
Hawkhurst
Cranbrook
Kent
TN18 5EJ`;
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("TN18 5EJ");
        expect(result.venue.type).toBe("other");
      });

      it("should parse Vineyard Lamberhurst multi-line", () => {
        const input = `The Vineyard
The Down
Lamberhurst
Kent
TN3 8EU`;
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("TN3 8EU");
      });

      it("should parse Sugar Loaves Hollingbourne multi-line", () => {
        const input = `Sugar Loaves
56 Eyhorne Street
Hollingbourne
Maidstone
Kent
ME17 1TS`;
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("ME17 1TS");
        expect(result.venue.address1).toBe("56 Eyhorne Street");
      });

      it("should parse Windmill Hollingbourne multi-line", () => {
        const input = `The Windmill
32 Eyhorne Street
Hollingbourne
ME17 1TR`;
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("ME17 1TR");
      });

      it("should parse Park Gate Hollingbourne multi-line", () => {
        const input = `Park Gate Inn
Ashford Road
Hollingbourne
Kent
ME17 1PG`;
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("ME17 1PG");
        expect(result.venue.name).toBe("Park Gate Inn");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Angel Addington multi-line", () => {
        const input = `The Angel
The Green
Addington
West Malling
Kent
ME19 5BB`;
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("ME19 5BB");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Lower Bell Blue Bell Hill multi-line", () => {
        const input = `Lower Bell
201 Old Chatham Road
Blue Bell Hill
Aylesford
ME20 7EF`;
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("ME20 7EF");
        expect(result.venue.type).toBe("pub");
      });

    });

    describe("Kent venue examples - with URLs", () => {

      it("should parse Kings Arms Boxley with URL", () => {
        const input = "https://www.thekingsarmsmaidstone.co.uk The Kings Arms, The Street, Boxley, Maidstone ME14 3DR";
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("ME14 3DR");
        expect(result.venue.url).toBe("https://www.thekingsarmsmaidstone.co.uk");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Bull Tunbridge Wells with URL", () => {
        const input = "The Bull https://www.bulltunbridgewells.co.uk 28 High Street, Tunbridge Wells TN1 1UX";
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("TN1 1UX");
        expect(result.venue.url).toBe("https://www.bulltunbridgewells.co.uk");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse Hand and Sceptre with URL", () => {
        const input = "The Hand & Sceptre, 21 London Rd, Southborough TN4 0RJ https://www.thehandandsceptre.co.uk/";
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("TN4 0RJ");
        expect(result.venue.url).toBe("https://www.thehandandsceptre.co.uk/");
      });

      it("should parse Sun Inn Faversham with URL", () => {
        const input = "The Sun Inn https://www.sunfaversham.co.uk/ 10 West Street, Faversham ME13 7JE";
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("ME13 7JE");
        expect(result.venue.url).toBe("https://www.sunfaversham.co.uk/");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse White Lion Selling with URL", () => {
        const input = "White Lion https://www.whitelionselling.co.uk Perry Wood Road, Selling, Faversham ME13 9RQ";
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("ME13 9RQ");
        expect(result.venue.url).toBe("https://www.whitelionselling.co.uk");
        expect(result.venue.type).toBe("pub");
      });

    });

    describe("Kent venue examples - car parks", () => {

      it("should parse Oldbury Hill National Trust car park", () => {
        const result = service.parse("Oldbury Hill Car Park, Oldbury Lane, Ightham TN15 0ET");
        expect(result.venue.postcode).toBe("TN15 0ET");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse One Tree Hill car park", () => {
        const result = service.parse("One Tree Hill Car Park, Seal Chart, Sevenoaks TN15 0SN");
        expect(result.venue.postcode).toBe("TN15 0SN");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Toys Hill car park", () => {
        const result = service.parse("Toys Hill Car Park, Toys Hill, Westerham TN16 1QG");
        expect(result.venue.postcode).toBe("TN16 1QG");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Knole Park car park", () => {
        const result = service.parse("Knole Park Car Park, Sevenoaks TN13 1HX");
        expect(result.venue.postcode).toBe("TN13 1HX");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Wye Downs car park", () => {
        const result = service.parse("Wye Downs Car Park, Coldharbour Lane, Wye TN25 5HE");
        expect(result.venue.postcode).toBe("TN25 5HE");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse White Cliffs Dover car park", () => {
        const result = service.parse("White Cliffs of Dover Car Park, Upper Road, Dover CT16 1HJ");
        expect(result.venue.postcode).toBe("CT16 1HJ");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Shorne Woods Country Park car park", () => {
        const result = service.parse("Shorne Woods Country Park Car Park, Brewers Road, Shorne DA12 3HX");
        expect(result.venue.postcode).toBe("DA12 3HX");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse West Blean Woods car park", () => {
        const result = service.parse("West Blean Woods Car Park, Thornden Wood Road, Canterbury CT6 7NZ");
        expect(result.venue.postcode).toBe("CT6 7NZ");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Ightham Mote car park", () => {
        const result = service.parse("Ightham Mote Car Park, Mote Road, Ivy Hatch TN15 0NU");
        expect(result.venue.postcode).toBe("TN15 0NU");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Emmetts Garden car park", () => {
        const result = service.parse("Emmetts Garden Car Park, Ide Hill, Sevenoaks TN14 6BA");
        expect(result.venue.postcode).toBe("TN14 6BA");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Reculver Country Park car park", () => {
        const result = service.parse("Reculver Country Park Car Park, Reculver Lane, Herne Bay CT6 6SS");
        expect(result.venue.postcode).toBe("CT6 6SS");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Trosley Country Park car park", () => {
        const result = service.parse("Trosley Country Park Car Park, Waterlow Road, Vigo Village DA13 0SG");
        expect(result.venue.postcode).toBe("DA13 0SG");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Lullingstone Country Park car park", () => {
        const result = service.parse("Lullingstone Country Park Car Park, Castle Road, Eynsford DA4 0JF");
        expect(result.venue.postcode).toBe("DA4 0JF");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Sandwich Bay car park", () => {
        const result = service.parse("Sandwich Bay Beach Car Park, Guildford Road, Sandwich CT13 9QB");
        expect(result.venue.postcode).toBe("CT13 9QB");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Bedgebury Pinetum car park", () => {
        const result = service.parse("Bedgebury National Pinetum Car Park, Lady Oak Lane, Goudhurst TN17 2SL");
        expect(result.venue.postcode).toBe("TN17 2SL");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Mote Park car park", () => {
        const result = service.parse("Mote Park Car Park, Mote Avenue, Maidstone ME15 7SU");
        expect(result.venue.postcode).toBe("ME15 7SU");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Hucking Estate car park", () => {
        const result = service.parse("Hucking Estate Car Park, Church Road, Hucking ME17 1QT");
        expect(result.venue.postcode).toBe("ME17 1QT");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Chartwell car park", () => {
        const result = service.parse("Chartwell Car Park, Mapleton Road, Westerham TN16 1PS");
        expect(result.venue.postcode).toBe("TN16 1PS");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Brockhill Country Park car park", () => {
        const result = service.parse("Brockhill Country Park Car Park, Sandling Road, Hythe CT21 4HL");
        expect(result.venue.postcode).toBe("CT21 4HL");
        expect(result.venue.type).toBe("car park");
      });

      it("should parse Teston Bridge Country Park car park", () => {
        const result = service.parse("Teston Bridge Country Park Car Park, Teston Lane, Teston ME18 5BX");
        expect(result.venue.postcode).toBe("ME18 5BX");
        expect(result.venue.type).toBe("car park");
      });

    });

    describe("venues with pipe separator", () => {

      it("should parse The Bell Inn with pipe separator and no postcode", () => {
        const input = `The Bell Inn | Smarden
Bell Lane, Smarden, Ashford, UK`;
        const result = service.parse(input);
        expect(result.venue.name).toBe("The Bell Inn");
        expect(result.venue.address1).toBe("Bell Lane");
        expect(result.venue.type).toBe("pub");
      });

      it("should parse venue with pipe separator and postcode", () => {
        const input = `The Red Lion | Canterbury
High Street, Canterbury CT1 2AA`;
        const result = service.parse(input);
        expect(result.venue.name).toBe("The Red Lion");
        expect(result.venue.address1).toBe("High Street");
        expect(result.venue.address2).toBe("Canterbury");
        expect(result.venue.postcode).toBe("CT1 2AA");
        expect(result.venue.type).toBe("pub");
      });

    });

    describe("UK railway stations", () => {

      it("should parse Romney, Hythe & Dymchurch Railway (Kent)", () => {
        const result = service.parse("Romney, Hythe & Dymchurch Railway, New Romney Station, New Romney, Kent TN28 8PL");
        expect(result.venue.postcode).toBe("TN28 8PL");
        expect(result.venue.name).toBe("Romney");
        expect(result.venue.address1).toBe("Hythe & Dymchurch Railway");
        expect(result.venue.address2).toBe("New Romney Station");
        expect(result.venue.type).toBe("station");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Edinburgh Waverley Station", () => {
        const result = service.parse("Edinburgh Waverley Station, Waverley Bridge, Edinburgh EH1 1BB");
        expect(result.venue.postcode).toBe("EH1 1BB");
        expect(result.venue.name).toBe("Edinburgh Waverley Station");
        expect(result.venue.address1).toBe("Waverley Bridge");
        expect(result.venue.address2).toBe("Edinburgh");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Glasgow Central Station", () => {
        const result = service.parse("Glasgow Central Station, Gordon Street, Glasgow G1 3SL");
        expect(result.venue.postcode).toBe("G1 3SL");
        expect(result.venue.name).toBe("Glasgow Central Station");
        expect(result.venue.address1).toBe("Gordon Street");
        expect(result.venue.address2).toBe("Glasgow");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Cardiff Central Station", () => {
        const result = service.parse("Cardiff Central Station, Central Square, Cardiff CF10 1EP");
        expect(result.venue.postcode).toBe("CF10 1EP");
        expect(result.venue.name).toBe("Cardiff Central Station");
        expect(result.venue.address1).toBe("Central Square");
        expect(result.venue.address2).toBe("Cardiff");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Manchester Piccadilly Station", () => {
        const result = service.parse("Manchester Piccadilly Station, Station Approach, Manchester M1 2BN");
        expect(result.venue.postcode).toBe("M1 2BN");
        expect(result.venue.name).toBe("Manchester Piccadilly Station");
        expect(result.venue.address1).toBe("Station Approach");
        expect(result.venue.address2).toBe("Manchester");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Birmingham New Street Station", () => {
        const result = service.parse("Birmingham New Street Station, Station Street, Birmingham B2 4QA");
        expect(result.venue.postcode).toBe("B2 4QA");
        expect(result.venue.name).toBe("Birmingham");
        expect(result.venue.address1).toBe("Birmingham New Street Station");
        expect(result.venue.address2).toBe("Station Street");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Leeds Station", () => {
        const result = service.parse("Leeds Station, New Station Street, Leeds LS1 4DY");
        expect(result.venue.postcode).toBe("LS1 4DY");
        expect(result.venue.name).toBe("Leeds Station");
        expect(result.venue.address1).toBe("New Station Street");
        expect(result.venue.address2).toBe("Leeds");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Liverpool Lime Street Station", () => {
        const result = service.parse("Liverpool Lime Street Station, Lime Street, Liverpool L1 1JD");
        expect(result.venue.postcode).toBe("L1 1JD");
        expect(result.venue.name).toBe("Liverpool");
        expect(result.venue.address1).toBe("Liverpool Lime Street Station");
        expect(result.venue.address2).toBe("Lime Street");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Newcastle Central Station", () => {
        const result = service.parse("Newcastle Central Station, Neville Street, Newcastle upon Tyne NE1 5DL");
        expect(result.venue.postcode).toBe("NE1 5DL");
        expect(result.venue.name).toBe("Newcastle Central Station");
        expect(result.venue.address1).toBe("Neville Street");
        expect(result.venue.address2).toBe("Newcastle upon Tyne");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse York Station", () => {
        const result = service.parse("York Station, Station Road, York YO24 1AB");
        expect(result.venue.postcode).toBe("YO24 1AB");
        expect(result.venue.name).toBe("York Station");
        expect(result.venue.address1).toBe("Station Road");
        expect(result.venue.address2).toBe("York");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Bristol Temple Meads Station", () => {
        const result = service.parse("Bristol Temple Meads Station, Station Approach, Bristol BS1 6QF");
        expect(result.venue.postcode).toBe("BS1 6QF");
        expect(result.venue.name).toBe("Bristol Temple Meads Station");
        expect(result.venue.address1).toBe("Station Approach");
        expect(result.venue.address2).toBe("Bristol");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Brighton Station", () => {
        const result = service.parse("Brighton Station, Queens Road, Brighton BN1 3XP");
        expect(result.venue.postcode).toBe("BN1 3XP");
        expect(result.venue.name).toBe("Brighton Station");
        expect(result.venue.address1).toBe("Queens Road");
        expect(result.venue.address2).toBe("Brighton");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Sheffield Station", () => {
        const result = service.parse("Sheffield Station, Sheaf Street, Sheffield S1 2BP");
        expect(result.venue.postcode).toBe("S1 2BP");
        expect(result.venue.name).toBe("Sheffield Station");
        expect(result.venue.address1).toBe("Sheaf Street");
        expect(result.venue.address2).toBe("Sheffield");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Nottingham Station", () => {
        const result = service.parse("Nottingham Station, Station Street, Nottingham NG2 3AQ");
        expect(result.venue.postcode).toBe("NG2 3AQ");
        expect(result.venue.name).toBe("Nottingham Station");
        expect(result.venue.address1).toBe("Station Street");
        expect(result.venue.address2).toBe("Nottingham");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Southampton Central Station", () => {
        const result = service.parse("Southampton Central Station, Blechynden Terrace, Southampton SO15 1AL");
        expect(result.venue.postcode).toBe("SO15 1AL");
        expect(result.venue.name).toBe("Southampton Central Station");
        expect(result.venue.address1).toBe("Blechynden Terrace");
        expect(result.venue.address2).toBe("Southampton");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Oxford Station", () => {
        const result = service.parse("Oxford Station, Park End Street, Oxford OX1 1HS");
        expect(result.venue.postcode).toBe("OX1 1HS");
        expect(result.venue.name).toBe("Oxford Station");
        expect(result.venue.address1).toBe("Park End Street");
        expect(result.venue.address2).toBe("Oxford");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Cambridge Station", () => {
        const result = service.parse("Cambridge Station, Station Road, Cambridge CB1 2JW");
        expect(result.venue.postcode).toBe("CB1 2JW");
        expect(result.venue.name).toBe("Cambridge Station");
        expect(result.venue.address1).toBe("Station Road");
        expect(result.venue.address2).toBe("Cambridge");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Aberdeen Station", () => {
        const result = service.parse("Aberdeen Station, Guild Street, Aberdeen AB11 6LX");
        expect(result.venue.postcode).toBe("AB11 6LX");
        expect(result.venue.name).toBe("Aberdeen Station");
        expect(result.venue.address1).toBe("Guild Street");
        expect(result.venue.address2).toBe("Aberdeen");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Inverness Station", () => {
        const result = service.parse("Inverness Station, Station Square, Inverness IV1 1LE");
        expect(result.venue.postcode).toBe("IV1 1LE");
        expect(result.venue.name).toBe("Inverness Station");
        expect(result.venue.address1).toBe("Station Square");
        expect(result.venue.address2).toBe("Inverness");
        expect(result.confidence).toBeGreaterThan(0);
      });

      it("should parse Swansea Station", () => {
        const result = service.parse("Swansea Station, High Street, Swansea SA1 1NU");
        expect(result.venue.postcode).toBe("SA1 1NU");
        expect(result.venue.name).toBe("Swansea Station");
        expect(result.venue.address1).toBe("High Street");
        expect(result.venue.address2).toBe("Swansea");
        expect(result.confidence).toBeGreaterThan(0);
      });

    });

    describe("Kent venue examples - cafes", () => {

      it("should parse The Goods Shed Canterbury", () => {
        const result = service.parse("The Goods Shed Cafe, Station Road West, Canterbury CT2 8AN");
        expect(result.venue.postcode).toBe("CT2 8AN");
        expect(result.venue.type).toBe("cafe");
      });

      it("should parse Steep Street Coffee House", () => {
        const result = service.parse("Steep Street Coffee House, 39 Steep Street, Folkestone CT20 1TZ");
        expect(result.venue.postcode).toBe("CT20 1TZ");
        expect(result.venue.type).toBe("cafe");
      });

      it("should parse Tea Room multi-line", () => {
        const input = `The Old Tea Room
High Street
Chilham
Canterbury
CT4 8DB`;
        const result = service.parse(input);
        expect(result.venue.postcode).toBe("CT4 8DB");
        expect(result.venue.type).toBe("cafe");
      });

      it("should parse Coffee Shop Whitstable", () => {
        const result = service.parse("The Coffee Shop, Harbour Street, Whitstable CT5 1AH");
        expect(result.venue.postcode).toBe("CT5 1AH");
        expect(result.venue.type).toBe("cafe");
      });

    });

  });

});
