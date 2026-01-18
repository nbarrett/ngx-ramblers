import { isNumber, isUndefined } from "es-toolkit/compat";
import { CropperDebugOffsets, ImageCropperPosition } from "../models/image-cropper.model";

const cropperDimension = (endValue: number, startValue: number): number | null => {
  if (!isNumber(endValue) || !isNumber(startValue)) {
    return null;
  }
  const value = Math.max(0, endValue - startValue);
  return value || null;
};

const cropperCenter = (startValue: number, endValue: number): number => {
  const center = (startValue + endValue) / 2;
  return Math.max(0, Math.min(100, center));
};

const cropperScale = (position: ImageCropperPosition): number => {
  const cropWidth = cropperDimension(position.x2, position.x1);
  const cropHeight = cropperDimension(position.y2, position.y1);
  const scaleX = cropWidth ? 100 / cropWidth : 1;
  const scaleY = cropHeight ? 100 / cropHeight : 1;
  return Math.max(scaleX, scaleY);
};

export const cropperWrapperStyles = (heightPx: number, borderRadius: number, noBorderRadius: boolean): any => {
  const styles: any = {};
  styles["width"] = "100%";
  styles["overflow"] = "hidden";
  styles["position"] = "relative";
  if (isNumber(heightPx)) {
    styles["height.px"] = heightPx;
  }
  if (!noBorderRadius) {
    styles["border-radius.px"] = isUndefined(borderRadius) ? 6 : borderRadius;
  }
  return styles;
};

export const cropperImageStyles = (position: ImageCropperPosition, heightPx: number, debug?: CropperDebugOffsets): any => {
  const styles: any = {};
  styles["width"] = "100%";
  if (!position) {
    if (isNumber(heightPx)) {
      styles["height"] = "100%";
    }
    styles["object-fit"] = "cover";
    return styles;
  }
  const cropWidth = cropperDimension(position.x2, position.x1) || 100;
  const cropHeight = cropperDimension(position.y2, position.y1) || 100;
  const baseScale = 100 / cropWidth;
  const scale = baseScale + (debug?.scaleOffset || 0);
  const translateX = -position.x1 + (debug?.translateXOffset || 0);
  const translateY = -position.y1 + (debug?.translateYOffset || 0);
  styles["position"] = "absolute";
  styles["left"] = "0";
  styles["top"] = "0";
  styles["width"] = "100%";
  styles["transform-origin"] = "0 0";
  styles["transform"] = `scale(${scale}) translate(${translateX}%, ${translateY}%)`;
  return styles;
};

export const cropperTransformStyles = (position: ImageCropperPosition): any => {
  if (!position) {
    return {};
  }
  const scale = cropperScale(position);
  const translateX = isNumber(position.x1) ? -position.x1 : 0;
  const translateY = isNumber(position.y1) ? -position.y1 : 0;
  return {
    "transform-origin": "0 0",
    "transform": `scale(${scale}) translate(${translateX}%, ${translateY}%)`
  };
};
