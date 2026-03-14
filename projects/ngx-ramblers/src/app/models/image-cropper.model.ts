export interface ImageCropperPosition {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CropperDebugOffsets {
  scaleOffset: number;
  translateXOffset: number;
  translateYOffset: number;
  originXOffset: number;
  originYOffset: number;
}

export interface FocalPoint {
  x: number;
  y: number;
  zoom?: number;
}
