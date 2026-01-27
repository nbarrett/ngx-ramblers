/**
 * Real UK venue URLs for testing the venue parser.
 * These are production URLs that can be used for integration testing.
 * Note: Website content may change over time, so tests should be tolerant.
 */

export interface VenueTestFixture {
  url: string;
  expectedType: string;
  expectedNameContains?: string;
  expectedPostcodePattern?: RegExp;
  region: string;
  notes?: string;
}

export const PUB_FIXTURES: VenueTestFixture[] = [
  // Kings Arms pubs across UK
  { url: "https://www.thekingsarmslondon.co.uk/", expectedType: "pub", expectedNameContains: "Kings Arms", region: "London" },
  { url: "https://www.thekingsarmspub.com/", expectedType: "pub", expectedNameContains: "Kings Arms", region: "London" },
  { url: "https://www.thekingsarmscardington.co.uk/", expectedType: "pub", expectedNameContains: "Kings Arms", region: "Bedford" },
  { url: "https://www.kingsarmsoxford.co.uk/", expectedType: "pub", expectedNameContains: "Kings Arms", region: "Oxford" },
  { url: "https://www.kingsarmsw1.co.uk/", expectedType: "pub", expectedNameContains: "Kings Arms", region: "London" },
  { url: "https://www.kingsarmssalford.com/", expectedType: "pub", expectedNameContains: "Kings Arms", region: "Salford" },
  { url: "https://www.kingsarmswandsworth.co.uk/", expectedType: "pub", expectedNameContains: "Kings Arms", region: "London" },
  { url: "https://www.thekingsarmsbexleyheath.co.uk/", expectedType: "pub", expectedNameContains: "Kings Arms", region: "London" },
  { url: "https://www.thekingsarmsegham.co.uk/", expectedType: "pub", expectedNameContains: "Kings Arms", region: "Surrey" },

  // Red Lion pubs
  { url: "https://www.redlionwestminster.co.uk/", expectedType: "pub", expectedNameContains: "Red Lion", region: "London" },
  { url: "https://www.redlionmayfair.co.uk/", expectedType: "pub", expectedNameContains: "Red Lion", region: "London" },
  { url: "https://www.redlionoxford.co.uk/", expectedType: "pub", expectedNameContains: "Red Lion", region: "Oxford" },
  { url: "https://www.redlionashington.co.uk/", expectedType: "pub", expectedNameContains: "Red Lion", region: "West Sussex" },
  { url: "https://www.theredlionwelwyn.co.uk/", expectedType: "pub", expectedNameContains: "Red Lion", region: "Hertfordshire" },
  { url: "https://www.theredlionpub.uk/", expectedType: "pub", expectedNameContains: "Red Lion", region: "Oxfordshire" },
  { url: "https://www.red-lion-barnes.co.uk/", expectedType: "pub", expectedNameContains: "Red Lion", region: "London" },
  { url: "https://www.redlionlacock.co.uk/", expectedType: "pub", expectedNameContains: "Red Lion", region: "Wiltshire" },
  { url: "https://theoldredlion.uk/", expectedType: "pub", expectedNameContains: "Red Lion", region: "London" },

  // Crown Inn pubs
  { url: "https://crowninnenstone.co.uk/", expectedType: "pub", expectedNameContains: "Crown", region: "Cotswolds" },
  { url: "https://www.crowninn.net/", expectedType: "pub", expectedNameContains: "Crown", region: "Suffolk" },
  { url: "https://www.the-crowninn.co.uk/", expectedType: "pub", expectedNameContains: "Crown", region: "Southampton" },
  { url: "https://www.thecrownwidnes.co.uk/", expectedType: "pub", expectedNameContains: "Crown", region: "Widnes" },
  { url: "https://www.thecrowninnderbyshire.co.uk/", expectedType: "pub", expectedNameContains: "Crown", region: "Derbyshire" },
  { url: "https://www.thecrowninn-cotswolds.co.uk/", expectedType: "pub", expectedNameContains: "Crown", region: "Cotswolds" },
  { url: "https://www.crowninnbishopswaltham.co.uk/", expectedType: "pub", expectedNameContains: "Crown", region: "Hampshire" },
  { url: "https://www.crowninnatfinglesham.co.uk/", expectedType: "pub", expectedNameContains: "Crown", region: "Kent" },
  { url: "https://www.crown-inn.co.uk/", expectedType: "pub", expectedNameContains: "Crown", region: "Buckinghamshire" },

  // White Horse pubs
  { url: "https://www.thewhitehorserichmond.co.uk/", expectedType: "pub", expectedNameContains: "White Horse", region: "London" },
  { url: "https://whitehorsepub.co.uk/", expectedType: "pub", expectedNameContains: "White Horse", region: "Heathrow" },
  { url: "https://www.whitehorseradlett.co.uk/", expectedType: "pub", expectedNameContains: "White Horse", region: "Hertfordshire" },
  { url: "https://www.thewhitehorsepub.co.uk/", expectedType: "pub", expectedNameContains: "White Horse", region: "Chorleywood" },
  { url: "https://whitehorsedorking.com/", expectedType: "pub", expectedNameContains: "White Horse", region: "Surrey" },
  { url: "https://www.whitehorsewembley.co.uk/", expectedType: "pub", expectedNameContains: "White Horse", region: "London" },
  { url: "https://thewhitehorsechurton.co.uk/", expectedType: "pub", expectedNameContains: "White Horse", region: "Cheshire" },
  { url: "https://www.whitehorsewestbourne.co.uk/", expectedType: "pub", expectedNameContains: "White Horse", region: "Hampshire" },
  { url: "https://www.whitehorseharrow.co.uk/", expectedType: "pub", expectedNameContains: "White Horse", region: "London" },

  // Plough Inn pubs
  { url: "https://www.ploughinn.com/", expectedType: "pub", expectedNameContains: "Plough", region: "Surrey" },
  { url: "https://www.theploughinnford.co.uk/", expectedType: "pub", expectedNameContains: "Plough", region: "Worcestershire" },
  { url: "https://www.theploughpublangley.co.uk/", expectedType: "pub", expectedNameContains: "Plough", region: "Kent" },
  { url: "https://theploughinncheshire.com/", expectedType: "pub", expectedNameContains: "Plough", region: "Cheshire" },
  { url: "https://www.ploughhathersage.com/", expectedType: "pub", expectedNameContains: "Plough", region: "Derbyshire" },
  { url: "https://www.theploughdulwich.co.uk/", expectedType: "pub", expectedNameContains: "Plough", region: "London" },
  { url: "https://www.ploughnorthfields.co.uk/", expectedType: "pub", expectedNameContains: "Plough", region: "London" },
  { url: "https://theploughinnkelmscott.com/", expectedType: "pub", expectedNameContains: "Plough", region: "Oxfordshire" },
  { url: "https://www.theploughellington.co.uk/", expectedType: "pub", expectedNameContains: "Plough", region: "Northumberland" },
  { url: "https://www.theploughinncobham.co.uk/", expectedType: "pub", expectedNameContains: "Plough", region: "Surrey" },

  // Anchor Inn pubs
  { url: "https://www.anchorhastings.co.uk/", expectedType: "pub", expectedNameContains: "Anchor", region: "East Sussex" },
  { url: "https://www.theanchorcowes.co.uk/", expectedType: "pub", expectedNameContains: "Anchor", region: "Isle of Wight" },
  { url: "https://www.theanchorinnseatown.co.uk/", expectedType: "pub", expectedNameContains: "Anchor", region: "Dorset" },
  { url: "https://www.anchorhenley.co.uk/", expectedType: "pub", expectedNameContains: "Anchor", region: "Oxfordshire" },
  { url: "https://www.theanchorinn.net/", expectedType: "pub", expectedNameContains: "Anchor", region: "Somerset" },
  { url: "https://www.anchorkempsey.co.uk/", expectedType: "pub", expectedNameContains: "Anchor", region: "Worcestershire" },
  { url: "https://anchorpub.net/", expectedType: "pub", expectedNameContains: "Anchor", region: "Devon" },
  { url: "https://www.theanchorinnirby.co.uk/", expectedType: "pub", expectedNameContains: "Anchor", region: "Wirral" },
  { url: "https://anchorinn-totton.co.uk/", expectedType: "pub", expectedNameContains: "Anchor", region: "Hampshire" },
  { url: "https://theanchorinn-sidmouth.co.uk/", expectedType: "pub", expectedNameContains: "Anchor", region: "Devon" },

  // Original test cases from user
  { url: "https://dukeofcumberland.co.uk/", expectedType: "pub", expectedNameContains: "Duke", region: "Kent", notes: "Footer legal links issue" },
  { url: "https://www.newflyinghorsewye.co.uk/", expectedType: "pub", expectedNameContains: "Flying Horse", region: "Kent", notes: "Opening hours issue" },
];

export const CAFE_FIXTURES: VenueTestFixture[] = [
  { url: "http://theenglishrosecafe.co.uk/", expectedType: "cafe", expectedNameContains: "English Rose", region: "London" },
  { url: "https://www.thebridgetearooms.co.uk/", expectedType: "cafe", expectedNameContains: "Bridge Tea", region: "Wiltshire" },
  { url: "https://www.bricklane-tearooms.co.uk/", expectedType: "cafe", expectedNameContains: "Tea Room", region: "London" },
  { url: "https://www.cartlandsindependent.com/", expectedType: "cafe", expectedNameContains: "Cartlands", region: "Birmingham" },
  { url: "https://www.themissingbean.co.uk/", expectedType: "cafe", expectedNameContains: "Missing Bean", region: "Oxford" },
  { url: "https://www.coffeehouseonline.co.uk/", expectedType: "cafe", expectedNameContains: "Coffee House", region: "North West" },
  { url: "https://www.15grams.co.uk/", expectedType: "cafe", expectedNameContains: "15grams", region: "London" },
];

export const STATION_FIXTURES: VenueTestFixture[] = [
  { url: "https://www.rhdr.org.uk/stations/dungeness-station/", expectedType: "station", expectedNameContains: "Dungeness", region: "Kent", notes: "Original nav menu issue" },
  { url: "https://svr.co.uk/", expectedType: "station", expectedNameContains: "Severn Valley", region: "Worcestershire" },
  { url: "https://www.gcrailway.co.uk/", expectedType: "station", expectedNameContains: "Great Central", region: "Leicestershire" },
  { url: "https://llangollen-railway.co.uk/", expectedType: "station", expectedNameContains: "Llangollen", region: "Wales" },
  { url: "https://www.bluebell-railway.com/", expectedType: "station", expectedNameContains: "Bluebell", region: "Sussex" },
  { url: "https://www.west-somerset-railway.co.uk/", expectedType: "station", expectedNameContains: "Somerset", region: "Somerset" },
];

export const HALL_FIXTURES: VenueTestFixture[] = [
  { url: "https://knowlevillagehall.co.uk/", expectedType: "hall", expectedNameContains: "Knowle", region: "West Midlands" },
];

export const ALL_FIXTURES: VenueTestFixture[] = [
  ...PUB_FIXTURES,
  ...CAFE_FIXTURES,
  ...STATION_FIXTURES,
  ...HALL_FIXTURES,
];

export const PROBLEMATIC_FIXTURES: VenueTestFixture[] = [
  { url: "https://www.rhdr.org.uk/stations/dungeness-station/", expectedType: "station", expectedNameContains: "Dungeness", region: "Kent", notes: "Nav menu items extracted as venue data" },
  { url: "https://dukeofcumberland.co.uk/", expectedType: "pub", expectedNameContains: "Duke", region: "Kent", notes: "Footer legal links: Allergies & Hygiene - Cookies - Privacy" },
  { url: "https://www.newflyinghorsewye.co.uk/", expectedType: "pub", expectedNameContains: "Flying Horse", region: "Kent", notes: "Opening hours: Monday - Thursday / 08:00 - 22:00 extracted as name/address" },
];
