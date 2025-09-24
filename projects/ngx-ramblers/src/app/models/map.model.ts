export type MapProvider = "osm" | "os";

export enum OSMapStyleKey {
  LEISURE_27700 = "LEISURE_27700",
  LEISURE_3857 = "LEISURE_3857",
  OUTDOOR_27700 = "OUTDOOR_27700",
  OUTDOOR_3857 = "OUTDOOR_3857",
  LIGHT_27700 = "LIGHT_27700",
  LIGHT_3857 = "LIGHT_3857",
  ROAD_27700 = "ROAD_27700",
  ROAD_3857 = "ROAD_3857",
}

export type MapStyleInfo = {
  key: string;
  name: string;
  description: string;
};

export const OSMapStyle: Record<OSMapStyleKey, MapStyleInfo> = {
  [OSMapStyleKey.LEISURE_27700]: {
    key: "Leisure_27700",
    name: "OS Explorer (1:25,000)",
    description: "Colorful style based on OS Explorer maps, ideal for parks and leisure activities in the UK.",
  },
  [OSMapStyleKey.LEISURE_3857]: {
    key: "Leisure_3857",
    name: "Leisure Explorer (Web Mercator)",
    description: "Same colorful leisure style, optimized for web and global viewing.",
  },
  [OSMapStyleKey.OUTDOOR_27700]: {
    key: "Outdoor_27700",
    name: "OS Outdoor",
    description: "Traditional outdoor map with paths and contours, perfect for hiking in the UK.",
  },
  [OSMapStyleKey.OUTDOOR_3857]: {
    key: "Outdoor_3857",
    name: "Outdoor Trails (Web Mercator)",
    description: "Outdoor-focused map with trail details, ready for web applications.",
  },
  [OSMapStyleKey.LIGHT_27700]: {
    key: "Light_27700",
    name: "OS Light",
    description: "Subtle, clean base map highlighting key features.",
  },
  [OSMapStyleKey.LIGHT_3857]: {
    key: "Light_3857",
    name: "Minimal Light (Web Mercator)",
    description: "Light and simple style for versatile web mapping.",
  },
  [OSMapStyleKey.ROAD_27700]: {
    key: "Road_27700",
    name: "OS Road (1:250,000)",
    description: "Road-focused map for navigation and driving in the UK.",
  },
  [OSMapStyleKey.ROAD_3857]: {
    key: "Road_3857",
    name: "Road Navigator (Web Mercator)",
    description: "Clear road emphasis, suitable for online route planning.",
  },
} as const;

export const OS_MAP_STYLE_LIST: MapStyleInfo[] = Object.values(OSMapStyle).filter(s => !s.key.endsWith("_3857"));
