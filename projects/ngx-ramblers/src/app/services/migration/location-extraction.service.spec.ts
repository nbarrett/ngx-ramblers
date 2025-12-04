import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { MigrationLocationExtractionService } from "./location-extraction.service";
import { ExtractedLocation } from "../../models/map.model";
import { SystemConfigService } from "../system/system-config.service";
import { ReplaySubject } from "rxjs";
import { SystemConfig } from "../../models/system.model";
import { ConfigService } from "../config.service";
import { ConfigKey } from "../../models/config.model";
import { HttpClientTestingModule } from "@angular/common/http/testing";

class MockSystemConfigService {
  events = () => new ReplaySubject<SystemConfig>().asObservable();
  systemConfig = () => ({}) as SystemConfig;
}

class MockConfigService {
  queryConfig<T>(key: ConfigKey, defaultOnEmpty?: T): Promise<T> {
    return Promise.resolve(defaultOnEmpty);
  }
}

describe("MigrationLocationExtractionService", () => {
  let service: MigrationLocationExtractionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule, HttpClientTestingModule],
      providers: [
        { provide: SystemConfigService, useClass: MockSystemConfigService },
        { provide: ConfigService, useClass: MockConfigService }
      ]
    });
    service = TestBed.inject(MigrationLocationExtractionService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("extractLocations", () => {
    it("should extract grid reference from explicit text", () => {
      const text = "OS Map: Explorer 148 (Start at grid reference TQ848581)";
      const locations = service.extractLocations(text);

      expect(locations.length).toBeGreaterThan(0);
      const gridRef = locations.find(l => l.type === "gridReference");
      expect(gridRef).toBeDefined();
      expect(gridRef?.value).toBe("TQ848581");
      expect(gridRef?.context).toBe("explicitly mentioned grid reference");
    });

    it("should extract grid reference with spaces", () => {
      const text = "Start at grid reference TQ 848 581 and walk north";
      const locations = service.extractLocations(text);

      const gridRef = locations.find(l => l.type === "gridReference");
      expect(gridRef).toBeDefined();
      expect(gridRef?.value).toBe("TQ848581");
    });

    it("should extract postcode", () => {
      const text = "Park at the car park near RH1 4QA and follow the signs";
      const locations = service.extractLocations(text);

      const postcode = locations.find(l => l.type === "postcode");
      expect(postcode).toBeDefined();
      expect(postcode?.value).toBe("RH14QA");
    });

    it("should extract postcode with space", () => {
      const text = "Meet at the pub in TN15 7PH at 9am";
      const locations = service.extractLocations(text);

      const postcode = locations.find(l => l.type === "postcode");
      expect(postcode).toBeDefined();
      expect(postcode?.value).toBe("TN157PH");
    });

    it("should extract start location from descriptive text", () => {
      const text = "Starting point: Otford Station and heading towards Shoreham";
      const locations = service.extractLocations(text);

      const startLoc = locations.find(l => l.context === "start location");
      expect(startLoc).toBeDefined();
      expect(startLoc?.value).toContain("Otford Station");
    });

    it("should extract start location with 'start at'", () => {
      const text = "Start at Eynsford Station and walk along the river";
      const locations = service.extractLocations(text);

      const startLoc = locations.find(l => l.context === "start location");
      expect(startLoc).toBeDefined();
      expect(startLoc?.value).toContain("Eynsford Station");
    });

    it("should extract end location", () => {
      const text = "Walk ends at Shoreham Station where refreshments are available";
      const locations = service.extractLocations(text);

      const endLoc = locations.find(l => l.context === "end location");
      expect(endLoc).toBeDefined();
      expect(endLoc?.value).toContain("Shoreham Station");
    });

    it("should extract parking location", () => {
      const text = "Parking: Free parking available at Otford village car park";
      const locations = service.extractLocations(text);

      const parking = locations.find(l => l.context === "parking");
      expect(parking).toBeDefined();
      expect(parking?.value).toContain("Free parking available at Otford village car park");
    });

    it("should handle multiple location types in same text", () => {
      const text = `OS Map: Explorer 148 (Start at grid reference TQ848581)
      Start from Otford Station (TN14 5QY) and walk to Shoreham.
      Parking available at the station car park.`;

      const locations = service.extractLocations(text);

      expect(locations.length).toBeGreaterThan(3);
      expect(locations.some(l => l.type === "gridReference")).toBe(true);
      expect(locations.some(l => l.type === "postcode")).toBe(true);
      expect(locations.some(l => l.context === "start location")).toBe(true);
      expect(locations.some(l => l.context === "parking")).toBe(true);
    });

    it("should not duplicate grid references", () => {
      const text = "Start at grid reference TQ848581 and the reference TQ848581 is on OS map";
      const locations = service.extractLocations(text);

      const gridRefs = locations.filter(l => l.type === "gridReference" && l.value === "TQ848581");
      expect(gridRefs.length).toBe(1);
    });

    it("should handle text with no locations", () => {
      const text = "This is a lovely walk through the countryside with no specific location details";
      const locations = service.extractLocations(text);

      expect(locations.length).toBe(0);
    });

    it("should stop at closing parenthesis for start location", () => {
      const text = "Start at Eynsford Station (on the A225) and walk south";
      const locations = service.extractLocations(text);

      const startLoc = locations.find(l => l.context === "start location");
      expect(startLoc).toBeDefined();
      expect(startLoc?.value).not.toContain(")");
      expect(startLoc?.value).toContain("Eynsford Station");
    });
  });

  describe("bestLocation", () => {
    it("should return null for empty array", () => {
      const result = service.bestLocation([]);
      expect(result).toBeNull();
    });

    it("should prioritize postcode over other types", () => {
      const locations: ExtractedLocation[] = [
        { type: "placeName", value: "Otford Station", context: "start location" },
        { type: "postcode", value: "TN145QY", context: "found in text" },
        { type: "placeName", value: "Village Hall", context: "parking" }
      ];

      const result = service.bestLocation(locations);
      expect(result?.type).toBe("postcode");
      expect(result?.value).toBe("TN145QY");
    });

    it("should prioritize grid reference over place names", () => {
      const locations: ExtractedLocation[] = [
        { type: "placeName", value: "Otford Station", context: "start location" },
        { type: "gridReference", value: "TQ848581", context: "explicitly mentioned grid reference" },
        { type: "placeName", value: "Village Hall", context: "parking" }
      ];

      const result = service.bestLocation(locations);
      expect(result?.type).toBe("gridReference");
      expect(result?.value).toBe("TQ848581");
    });

    it("should prioritize postcode over grid reference", () => {
      const locations: ExtractedLocation[] = [
        { type: "gridReference", value: "TQ848581", context: "found in text" },
        { type: "postcode", value: "TN145QY", context: "found in text" }
      ];

      const result = service.bestLocation(locations);
      expect(result?.type).toBe("postcode");
      expect(result?.value).toBe("TN145QY");
    });

    it("should prioritize start location over other place names", () => {
      const locations: ExtractedLocation[] = [
        { type: "placeName", value: "Village Hall", context: "parking" },
        { type: "placeName", value: "Otford Station", context: "start location" },
        { type: "placeName", value: "Shoreham Station", context: "end location" }
      ];

      const result = service.bestLocation(locations);
      expect(result?.context).toBe("start location");
      expect(result?.value).toBe("Otford Station");
    });

    it("should return first location if no priority matches", () => {
      const locations: ExtractedLocation[] = [
        { type: "placeName", value: "Village Hall", context: "parking" },
        { type: "placeName", value: "Church", context: "landmark" }
      ];

      const result = service.bestLocation(locations);
      expect(result?.value).toBe("Village Hall");
    });
  });

  describe("real world examples", () => {
    it("should extract multiple locations from narrative text", () => {
      const text = "This 16 mile walk from Cernes Farm, a few miles south west of Edenbridge, to Tonbridge Castle was opened on 23 March 1991 by Lord de L'Isle of Penshurst.";
      const locations = service.extractLocations(text);

      expect(locations.length).toBeGreaterThanOrEqual(2);

      const cernesFarm = locations.find(l => l.value.includes("Cernes Farm"));
      expect(cernesFarm).withContext(`Expected to find Cernes Farm in: ${JSON.stringify(locations)}`).toBeDefined();
      expect(cernesFarm?.type).toBe("placeName");
      expect(cernesFarm?.value).toMatch(/Cernes Farm/);

      const tonbridgeCastle = locations.find(l => l.value.includes("Tonbridge Castle"));
      expect(tonbridgeCastle).withContext(`Expected to find Tonbridge Castle in: ${JSON.stringify(locations)}`).toBeDefined();
      expect(tonbridgeCastle?.type).toBe("placeName");

      const edenbridge = locations.find(l => l.value.includes("Edenbridge"));
      expect(edenbridge).withContext(`Expected to find Edenbridge in: ${JSON.stringify(locations)}`).toBeDefined();

      const penshurst = locations.find(l => l.value.includes("Penshurst"));
      expect(penshurst).withContext(`Expected to find Penshurst in: ${JSON.stringify(locations)}`).toBeDefined();
      expect(penshurst?.type).toBe("placeName");
    });

    it("should extract Cudham and Christmas Tree Farm walk and extract the starting Grid ref as TQ446597 then use this", () => {
      const text = "Cudham and Christmas Tree Farm\n" +
        "Distance:  3.9 Miles (1h 45 mins)\n" +
        "\n" +
        "OS Map:  Explorer 147 (Start at grid reference TQ446597) \n" +
        "\n" +
        " \n" +
        "\n" +
        "Click map to enlarge and click again to enlarge further\n" +
        "\n" +
        "Park in free car park at Cudham recreation ground (on left, just past Blacksmith's Arms, when approaching from Green Street Green).  Closing times vary from as early as 4.30pm in winter to 9.00pm in summer.\n" +
        "\n" +
        "Leave car park on tarred path past tennis court and toilets.  On reaching churchyard, bear right along edge of recreation ground and go through metal kissing gate.  Bear right across drive of Rectory House and through another kissing gate.  Follow right hand edge of field to third kissing gate.  Cross next field and take path between trees.";
      const locations = service.extractLocations(text);

      expect(locations.length).toBeGreaterThanOrEqual(2);
      const gridRef = locations.find(l => l.type === "gridReference");
      expect(gridRef).withContext(`Expected to find grid reference in: ${JSON.stringify(locations)}`).toBeDefined();
      expect(gridRef?.value).toBe("TQ446597");
      expect(gridRef?.context).toBe("explicitly mentioned grid reference");
    });

    it("should extract The 153-mile (246 km) Saxon Shore Way from Gravesend to Hastings", () => {
      const text = "Saxon Shore Way\n" +
        "\n" +
        "Leaving Faversham towards Oare Marshes\n" +
        "\n" +
        "Sandwich Bay\n" +
        "\n" +
        "South Foreland Lighthouse\n" +
        "\n" +
        "West of Dover\n" +
        "\n" +
        "## Saxon Shore Way\n" +
        "\n" +
        "[\n" +
        "\n" +
        "](images/web_map.jpg)\n" +
        "\n" +
        "The 153-mile (246 km) Saxon Shore Way from Gravesend to Hastings offers the walker an unrivalled diversity of scenery from the wide expanses of marshland of the Thames and Medway estuaries to the majestic White Cliffs of Dover.  Spectacular panoramic views follow the route along the escarpment of the old sea cliffs from Folkestone to Rye and from the sandstone cliffs of the High Weald at Hastings.\n" +
        "\n" +
        "The historian is treated to the \"Saxon Shore\" forts built by the Romans at Reculver, Richborough, Dover and Lympne, to the landing place of St. Augustine and of Caesar and to defences of more modem times against Napoleon and Hitler.";
      const locations = service.extractLocations(text);

      expect(locations.length).toBeGreaterThanOrEqual(2);
      const gravesend = locations.find(l => l.value.includes("Gravesend"));
      expect(gravesend).withContext(`Expected to find Gravesend in: ${JSON.stringify(locations)}`).toBeDefined();
      expect(gravesend?.type).toBe("placeName");
      expect(gravesend?.value).toMatch(/Gravesend/);

      const hastings = locations.find(l => l.value.includes("Hastings"));
      expect(hastings).withContext(`Expected to find Hastings in: ${JSON.stringify(locations)}`).toBeDefined();
      expect(hastings?.type).toBe("placeName");
    });

    it("should extract Thames Estuary and Beachy Head as start/end locations", () => {
      const text = "The Wealdway is a superb walk running 82 miles from Gravesend on the Thames Estuary to Beachy Head and Eastbourne on the south coast.  It crosses the North Downs, the Greensand ridge, the Medway valley (twice), the High Weald (including Ashdown Forest), the Low Weald and the South Downs.\n" +
        "\n" +
        "This is quintessentially English countryside with rolling downs, archetypal village greens on which cricket has been played for centuries, deep wooded valleys and traditional pubs.  History abounds with numerous furnace and hammer ponds reminding us of the iron industry that characterised the Weald in the times of the Tudors and Stuarts and many fine old houses constructed of materials that vary along the route with the underlying geology.  Despite its proximity to many towns and with London not far away, much of the route has a surprisingly remote feel to it.";
      const locations = service.extractLocations(text);

      expect(locations.length).toBeGreaterThanOrEqual(1);
      const gravesend = locations.find(l => l.value.includes("Gravesend"));
      if (gravesend) {
        expect(gravesend?.type).toBe("placeName");
        expect(gravesend?.value).toMatch(/Gravesend/);
      }

      const beachyHead = locations.find(l => l.value.includes("Beachy Head"));
      if (beachyHead) {
        expect(beachyHead?.type).toBe("placeName");
      }

      const eastbourne = locations.find(l => l.value.includes("Eastbourne"));
      if (eastbourne) {
        expect(eastbourne?.type).toBe("placeName");
      }

      const thamesEstuary = locations.find(l => l.value.includes("Thames Estuary"));
      if (thamesEstuary) {
        expect(thamesEstuary?.type).toBe("placeName");
      }

      expect(gravesend || beachyHead || eastbourne || thamesEstuary).withContext(`Expected to find at least one major location in: ${JSON.stringify(locations)}`).toBeDefined();
    });

    it("should extract Starting point at Chipstead", () => {
      const text = "Starting point at Chipstead";
      const locations = service.extractLocations(text);

      expect(locations.length).toBeGreaterThanOrEqual(1);
      const chipstead = locations.find(l => l.value.includes("Chipstead"));
      expect(chipstead).withContext(`Expected to find Chipstead in: ${JSON.stringify(locations)}`).toBeDefined();
      expect(chipstead?.type).toBe("placeName");
      expect(chipstead?.value).toEqual("Chipstead");

    });

    it("should prioritize richer location source over simpler one (Darent Valley Path scenario)", () => {
      const text = `Starting point at Chipstead

      Some other content here.

      The Darent Valley Path starts alternatively at Sevenoaks Station or Chipstead and finishes on the bank of the Thames just north of Dartford.`;

      const locations = service.extractLocations(text);

      expect(locations.length).toBeGreaterThan(2);

      const startLocations = locations.filter(l => l.context === "start location");
      expect(startLocations.length).withContext(`Expected multiple start locations in: ${JSON.stringify(locations)}`).toBeGreaterThanOrEqual(2);

      const best = service.bestLocation(locations);
      expect(best).toBeDefined();
      expect(best?.context).toBe("start location");
      expect(best?.value).withContext(`Expected 'Sevenoaks Station' but got '${best?.value}'`).toContain("Sevenoaks Station");
    });

    it("should extract start and end locations from full Darent Valley Path description", () => {
      const text = `Darent Valley Path

![Image](https://www.kentramblers.org.uk/banners/autumn_oasts.jpg)

![Image](https://www.kentramblers.org.uk/KentWalks/DVP/images/chipstead.JPG)

Starting point at Chipstead

![Image](https://www.kentramblers.org.uk/KentWalks/DVP/images/otford.jpg)

Otford

![Image](https://www.kentramblers.org.uk/KentWalks/DVP/images/viaduct.jpg)

Eynsford Viaduct

![Image](https://www.kentramblers.org.uk/KentWalks/DVP/images/eynsford.jpg)

Eynsford Bridge

![Image](https://www.kentramblers.org.uk/KentWalks/DVP/images/darenth.jpg)

Darenth

![Image](https://www.kentramblers.org.uk/KentWalks/DVP/images/brooklands.jpg)

Brooklands Lakes

## Darent Valley Path

![Image](https://www.kentramblers.org.uk/KentWalks/DVP/images/route.gif)

The Darent Valley Path starts alternatively at Sevenoaks Station or Chipstead and finishes on the bank of the Thames just north of Dartford.  About 18 miles long, the route is steeped in history.  In Roman times there were villas every couple of miles along the valley and the finest example, Lullingstone, has been excavated and opened to the public.  For centuries the Darent was an important source of power and there were many water mills of various kinds; several survive although none is currently in use.  Picturesque villages include Otford, Shoreham, Eynsford and Farningham.  Lavender is perhaps the valley's most visible crop and there are castles at both Lullingstone and Eynsford.

Kent Ramblers have published a new guide to three of west Kent's river valley walks, including the Darent Valley Path:`;

      const locations = service.extractLocations(text);

      expect(locations.length).withContext(`All locations: ${JSON.stringify(locations)}`).toBeGreaterThanOrEqual(3);

      const startLocations = locations.filter(l => l.context === "start location");
      expect(startLocations.length).withContext(`Expected multiple start locations in: ${JSON.stringify(locations)}`).toBeGreaterThanOrEqual(2);

      const chipstead = startLocations.find(l => l.value === "Chipstead");
      expect(chipstead).withContext(`Expected to find 'Chipstead' in start locations`).toBeDefined();

      const sevenoaks = startLocations.find(l => l.value.includes("Sevenoaks Station"));
      expect(sevenoaks).withContext(`Expected to find 'Sevenoaks Station' in: ${JSON.stringify(startLocations)}`).toBeDefined();

      const endLocations = locations.filter(l => l.context === "end location");
      expect(endLocations.length).withContext(`Expected end location in: ${JSON.stringify(locations)}`).toBeGreaterThanOrEqual(1);

      const dartford = endLocations.find(l => l.value.includes("Thames") || l.value.includes("Dartford"));
      expect(dartford).withContext(`Expected to find Thames/Dartford in end locations: ${JSON.stringify(endLocations)}`).toBeDefined();

      const best = service.bestLocation(locations);
      expect(best).toBeDefined();
      expect(best?.context).toBe("start location");
      expect(best?.value).withContext(`Expected 'Sevenoaks Station' but got '${best?.value}'. All start locations: ${JSON.stringify(startLocations)}`).toContain("Sevenoaks Station");
    });

    it("should extract from typical route description", () => {
      const text = `
        Darent Valley Path

        Start at Eynsford Station (TN14 5QY) and follow the Darent Valley Path northwards.
        OS Map: Explorer 148 (grid reference TQ540655)

        Parking: Free parking available at Eynsford Station car park

        The walk follows the river Darent through beautiful countryside.
      `;

      const locations = service.extractLocations(text);

      expect(locations.length).toBeGreaterThan(2);

      const best = service.bestLocation(locations);
      expect(best?.type).toBe("postcode");
      expect(best?.value).toBe("TN145QY");
    });

    it("should handle OS map description format", () => {
      const text = "OS Map: Explorer 148 (Start at grid reference TQ848581)";
      const locations = service.extractLocations(text);

      const gridRef = locations.find(l => l.type === "gridReference");
      expect(gridRef?.value).toBe("TQ848581");
      expect(gridRef?.context).toBe("explicitly mentioned grid reference");
    });

    it("should extract from route with multiple references", () => {
      const text = `
        North Downs Way Section

        Start: Wrotham (TQ633595) - parking available at the village hall (TN15 7AE)
        End: Cuxton (TQ714662)

        Starting from Wrotham, follow the North Downs Way...
      `;

      const locations = service.extractLocations(text);

      expect(locations.some(l => l.type === "gridReference")).toBe(true);
      expect(locations.some(l => l.type === "postcode")).toBe(true);
      expect(locations.some(l => l.context === "parking")).toBe(true);
    });
  });
});
