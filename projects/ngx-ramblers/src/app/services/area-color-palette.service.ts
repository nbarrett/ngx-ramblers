import { Injectable } from "@angular/core";
import { AREA_COLOR_PALETTE } from "../models/color-palette.model";

@Injectable({
  providedIn: "root"
})
export class AreaColorPaletteService {

  generateColor(index: number): string {
    return AREA_COLOR_PALETTE[index % AREA_COLOR_PALETTE.length];
  }

  generateColors(count: number): string[] {
    return Array.from({ length: count }, (_, i) => this.generateColor(i));
  }

  get palette(): string[] {
    return [...AREA_COLOR_PALETTE];
  }
}
