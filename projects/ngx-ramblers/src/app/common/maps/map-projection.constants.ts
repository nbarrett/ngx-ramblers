export enum MapProjectionCode {
  BRITISH_NATIONAL_GRID = "EPSG:27700",
  WEB_MERCATOR = "EPSG:3857",
  WGS84 = "WGS84"
}

export const EPSG_27700_PROJ4 = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.1502,0.247,0.8421,-20.4894 +units=m +no_defs";
