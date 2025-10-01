import { AREA_COLOR_PALETTE } from "../../../projects/ngx-ramblers/src/app/models/color-palette.model";

export function generateColor(index: number): string {
  return AREA_COLOR_PALETTE[index % AREA_COLOR_PALETTE.length];
}

export function generateColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => generateColor(i));
}

export { AREA_COLOR_PALETTE };
