import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { ColourPalette } from "../../../models/system.model";
import { BadgeButtonComponent } from "../badge-button/badge-button";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faPalette } from "@fortawesome/free-solid-svg-icons";

export interface ColourPaletteOption {
  value: ColourPalette;
  label: string;
  swatches: string[];
}

export const COLOUR_PALETTE_OPTIONS: ColourPaletteOption[] = [
  {value: ColourPalette.RAMBLERS, label: "Ramblers", swatches: ["#9BC8AB", "#F9B104", "#F08050", "#F6B09D", "#6BA368"]},
  {value: ColourPalette.RANDOM, label: "Random", swatches: ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"]},
  {value: ColourPalette.EARTH_TONES, label: "Earth Tones", swatches: ["#8B6914", "#A0522D", "#CD853F", "#D2B48C", "#BC8F5F"]},
  {value: ColourPalette.OCEAN, label: "Ocean", swatches: ["#006994", "#40A8C4", "#2E8B57", "#5F9EA0", "#1A759F"]},
  {value: ColourPalette.SUNSET, label: "Sunset", swatches: ["#FF6B35", "#D64045", "#E8A317", "#C73866", "#FF9F1C"]},
  {value: ColourPalette.FOREST, label: "Forest", swatches: ["#228B22", "#556B2F", "#2E8B57", "#6B8E23", "#3CB371"]},
  {value: ColourPalette.PASTEL, label: "Pastel", swatches: ["#FFB3BA", "#BAFFC9", "#BAE1FF", "#FFFFBA", "#E8BAFF"]},
  {value: ColourPalette.VIVID, label: "Vivid", swatches: ["#FF0066", "#00CC99", "#3366FF", "#FF9900", "#CC00FF"]},
  {value: ColourPalette.AUTUMN, label: "Autumn", swatches: ["#8B4513", "#D2691E", "#B22222", "#DAA520", "#CD6600"]},
  {value: ColourPalette.BERRY, label: "Berry", swatches: ["#8E4585", "#C71585", "#DC143C", "#4B0082", "#993366"]},
  {value: ColourPalette.SLATE, label: "Slate", swatches: ["#708090", "#2F4F4F", "#778899", "#5F6B6D", "#4A5859"]},
  {value: ColourPalette.TROPICAL, label: "Tropical", swatches: ["#FF6F61", "#FFD700", "#00CED1", "#FF1493", "#32CD32"]},
  {value: ColourPalette.LAVENDER, label: "Lavender", swatches: ["#9370DB", "#BA55D3", "#7B68EE", "#DDA0DD", "#8A2BE2"]},
  {value: ColourPalette.TERRACOTTA, label: "Terracotta", swatches: ["#CC5533", "#E07850", "#B8452A", "#D4916E", "#A0522D"]},
  {value: ColourPalette.NORDIC, label: "Nordic", swatches: ["#5B7C99", "#8FAAB3", "#3D5A6E", "#A8C4CE", "#2C4A5A"]},
  {value: ColourPalette.JEWEL, label: "Jewel", swatches: ["#0F4C81", "#6B3A2A", "#2C6E49", "#7B2D8E", "#B8860B"]},
  {value: ColourPalette.CITRUS, label: "Citrus", swatches: ["#FFD700", "#FF8C00", "#ADFF2F", "#FF6347", "#32CD32"]},
  {value: ColourPalette.DUSTY_ROSE, label: "Dusty Rose", swatches: ["#BC8F8F", "#CD5C5C", "#E8B4B8", "#C48793", "#D4A0A0"]},
  {value: ColourPalette.APPEALING, label: "Appealing", swatches: ["#C4A0C4", "#8CBCB8", "#C8C878", "#E89060", "#F0E8A0"]}
];

export const COLOUR_PALETTE_COLOURS: Record<ColourPalette, string[]> = {
  [ColourPalette.RAMBLERS]: [
    "#9BC8AB", "#F9B104", "#F08050", "#F6B09D", "#6BA368", "#D4A76A", "#E8C547", "#7DCEA0",
    "#C4956A", "#88B04B", "#E07B54", "#B5D99C", "#D4915E", "#F5C242", "#9FD5B7", "#CC8855",
    "#A8D08D", "#E8A96B", "#79B791", "#D6A84E", "#B6D7A8", "#F0A06A", "#8CC084", "#E5BE6A"
  ],
  [ColourPalette.RANDOM]: [
    "#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6", "#1ABC9C", "#E67E22", "#2980B9",
    "#27AE60", "#F1C40F", "#8E44AD", "#16A085", "#D35400", "#2C3E50", "#C0392B", "#7F8C8D",
    "#E91E63", "#00BCD4", "#4CAF50", "#FF9800", "#673AB7", "#009688", "#FF5722", "#3F51B5"
  ],
  [ColourPalette.EARTH_TONES]: [
    "#8B6914", "#A0522D", "#CD853F", "#D2B48C", "#BC8F5F", "#6B4226", "#8B7355", "#C4A35A",
    "#967117", "#B8860B", "#A68064", "#7B5B3A", "#C9A96E", "#856D4D", "#9E7C4F", "#B39C73",
    "#6E4B2F", "#C0A172", "#8B7042", "#A38B5E", "#D4B896", "#7D6340", "#BCA38A", "#937B52"
  ],
  [ColourPalette.OCEAN]: [
    "#006994", "#40A8C4", "#2E8B57", "#5F9EA0", "#1A759F", "#20B2AA", "#4682B4", "#008B8B",
    "#3CB4A0", "#1E6D8A", "#48C9B0", "#2874A6", "#5DADE2", "#117A65", "#76D7C4", "#2471A3",
    "#138D75", "#85C1E9", "#0E6655", "#5499C7", "#17A589", "#3498DB", "#1A5276", "#73C6B6"
  ],
  [ColourPalette.SUNSET]: [
    "#FF6B35", "#D64045", "#E8A317", "#C73866", "#FF9F1C", "#E84C3D", "#F0A830", "#B5338A",
    "#FF7F50", "#DC3545", "#FFB347", "#D63384", "#E76F51", "#C62828", "#F4A460", "#AD1457",
    "#FF8C42", "#B71C1C", "#F5C469", "#880E4F", "#FFA07A", "#E53935", "#FFCC80", "#9C27B0"
  ],
  [ColourPalette.FOREST]: [
    "#228B22", "#556B2F", "#2E8B57", "#6B8E23", "#3CB371", "#2D5A27", "#4E8C3F", "#8FBC5A",
    "#1B5E20", "#66BB6A", "#33691E", "#81C784", "#4A7C3F", "#A5D6A7", "#2E7D32", "#76C76E",
    "#388E3C", "#9CCC65", "#1B7A2E", "#AED581", "#43A047", "#689F38", "#558B2F", "#7CB342"
  ],
  [ColourPalette.PASTEL]: [
    "#FFB3BA", "#BAFFC9", "#BAE1FF", "#FFFFBA", "#E8BAFF", "#FFD1DC", "#B5EAD7", "#C7CEEA",
    "#FFDAC1", "#D4F0F0", "#FCE4EC", "#E0F7FA", "#F3E5F5", "#FFF9C4", "#E8EAF6", "#DCEDC8",
    "#F0F4C3", "#B2DFDB", "#F8BBD0", "#BBDEFB", "#C8E6C9", "#FFE0B2", "#D1C4E9", "#B3E5FC"
  ],
  [ColourPalette.VIVID]: [
    "#FF0066", "#00CC99", "#3366FF", "#FF9900", "#CC00FF", "#00CCFF", "#FF3333", "#33CC33",
    "#6633FF", "#FFCC00", "#FF00CC", "#00FF99", "#0066FF", "#FF6600", "#9933FF", "#00FFCC",
    "#CC3300", "#33FF66", "#3300FF", "#FFFF00", "#FF0099", "#00FF66", "#0033FF", "#FF3300"
  ],
  [ColourPalette.AUTUMN]: [
    "#8B4513", "#D2691E", "#B22222", "#DAA520", "#CD6600", "#A52A2A", "#CC7722", "#8B0000",
    "#BDB76B", "#CD5C5C", "#B8860B", "#9B2335", "#C88141", "#6B3A2A", "#D4A054", "#8B3A3A",
    "#BA6B2E", "#932F2F", "#C49B3F", "#7B3F00", "#D98C5F", "#A44040", "#B5872C", "#6E2C00"
  ],
  [ColourPalette.BERRY]: [
    "#8E4585", "#C71585", "#DC143C", "#4B0082", "#993366", "#800080", "#B03060", "#8B008B",
    "#9932CC", "#C02050", "#7B2D8E", "#D5006D", "#551A8B", "#E91E63", "#6A1B9A", "#AD1457",
    "#7C4DFF", "#D81B60", "#4A148C", "#F06292", "#8E24AA", "#EC407A", "#5E35B1", "#FF4081"
  ],
  [ColourPalette.SLATE]: [
    "#708090", "#2F4F4F", "#778899", "#5F6B6D", "#4A5859", "#3B4D61", "#536878", "#69747C",
    "#465A65", "#7B8D8E", "#3C4F5C", "#848B8A", "#566573", "#6C7A7D", "#3D5466", "#8F9B9E",
    "#4B636E", "#7A8B8B", "#394D5E", "#8B9DAF", "#5C6F7B", "#6B7F8A", "#445566", "#7F9099"
  ],
  [ColourPalette.TROPICAL]: [
    "#FF6F61", "#FFD700", "#00CED1", "#FF1493", "#32CD32", "#FF4500", "#00BFFF", "#FF69B4",
    "#7CFC00", "#FFA500", "#00FA9A", "#FF6347", "#40E0D0", "#FFB6C1", "#ADFF2F", "#FF7F50",
    "#48D1CC", "#FF1744", "#76FF03", "#FFC107", "#00E5FF", "#FF5252", "#69F0AE", "#FFD740"
  ],
  [ColourPalette.LAVENDER]: [
    "#9370DB", "#BA55D3", "#7B68EE", "#DDA0DD", "#8A2BE2", "#9966CC", "#B19CD9", "#6A5ACD",
    "#CE93D8", "#7E57C2", "#D1C4E9", "#5C6BC0", "#AB47BC", "#9575CD", "#E1BEE7", "#651FFF",
    "#AA66CC", "#B388FF", "#7C43BD", "#EA80FC", "#673AB7", "#D500F9", "#8C52FF", "#C6A8EC"
  ],
  [ColourPalette.TERRACOTTA]: [
    "#CC5533", "#E07850", "#B8452A", "#D4916E", "#A0522D", "#C0603A", "#E8946A", "#8B4C39",
    "#D17D5F", "#9E4A2F", "#DA8B6A", "#7D3F2E", "#CB7852", "#B5604A", "#E0A080", "#6B3A2F",
    "#C47050", "#A35540", "#D9997C", "#8C4830", "#B86845", "#944535", "#CF8C70", "#7A3D2A"
  ],
  [ColourPalette.NORDIC]: [
    "#5B7C99", "#8FAAB3", "#3D5A6E", "#A8C4CE", "#2C4A5A", "#6B8FA0", "#4E7080", "#9AB5C0",
    "#3A6578", "#B0C8D0", "#4C6E80", "#7D9DAD", "#345868", "#92B0BD", "#5A7F94", "#A0BBCA",
    "#2F5060", "#86A5B4", "#446878", "#9CC0CC", "#3C5F72", "#7A9AAB", "#507488", "#B4CCD5"
  ],
  [ColourPalette.JEWEL]: [
    "#0F4C81", "#6B3A2A", "#2C6E49", "#7B2D8E", "#B8860B", "#1A237E", "#4E342E", "#1B5E20",
    "#4A148C", "#8D6E25", "#0D47A1", "#5D4037", "#2E7D32", "#6A1B9A", "#9E7D25", "#1565C0",
    "#3E2723", "#388E3C", "#7B1FA2", "#7E6514", "#283593", "#4E2B1F", "#1F7A38", "#8E24AA"
  ],
  [ColourPalette.CITRUS]: [
    "#FFD700", "#FF8C00", "#ADFF2F", "#FF6347", "#32CD32", "#FFC300", "#FF7043", "#9ACD32",
    "#F44336", "#66BB6A", "#FFAB00", "#E65100", "#76FF03", "#FF5252", "#00C853", "#FFB300",
    "#BF360C", "#B2FF59", "#FF1744", "#00E676", "#FFA000", "#DD2C00", "#CCFF90", "#D50000"
  ],
  [ColourPalette.DUSTY_ROSE]: [
    "#BC8F8F", "#CD5C5C", "#E8B4B8", "#C48793", "#D4A0A0", "#B06E6E", "#DBA4A4", "#A56B6B",
    "#E0C0C0", "#C27878", "#D9ABAB", "#B88585", "#CEAAAE", "#A87878", "#D3B0B0", "#BF9090",
    "#C99292", "#AE8080", "#D6B8B8", "#B47A7A", "#C8A0A0", "#AA7070", "#D0ACAC", "#B58888"
  ],
  [ColourPalette.APPEALING]: [
    "#C4A0C4", "#8CBCB8", "#C8C878", "#E89060", "#F0E8A0", "#A8A8D8", "#F0B0B8", "#D8A888",
    "#C0E4F0", "#F0D878", "#C8DCA0", "#D0B8D8", "#98CCC8", "#D8D090", "#F0A878", "#B8B8E0",
    "#F4C8D0", "#E8C0A0", "#A8D8E8", "#E8E0A8", "#B0D8A8", "#D8A8C8", "#A8D0C8", "#E0D0A0"
  ]
};

@Component({
  selector: "app-colour-palette-selector",
  template: `
    <div class="d-flex align-items-center" style="gap: 0.5rem;">
      @if (showLabel) {
        <label class="form-label mb-0 small text-nowrap">Colour palette:</label>
      }
      <ng-select [items]="palettes"
                 bindLabel="label"
                 bindValue="value"
                 [clearable]="false"
                 [searchable]="false"
                 appendTo="body"
                 [dropdownPosition]="'bottom'"
                 [(ngModel)]="selected"
                 (ngModelChange)="onSelectionChange()"
                 style="min-width: 240px;">
        <ng-template ng-label-tmp>
          @if (selectedOption; as palette) {
            <div class="d-flex align-items-center" style="gap: 0.5rem;">
              <div class="d-flex" style="gap: 2px;">
                @for (colour of palette.swatches; track colour) {
                  <span [style.background]="colour" style="width: 14px; height: 14px; border-radius: 2px; display: inline-block;"></span>
                }
              </div>
              <span>{{ palette.label }}</span>
            </div>
          }
        </ng-template>
        <ng-template ng-option-tmp let-item="item">
          <div class="d-flex align-items-center" style="gap: 0.5rem;">
            <div class="d-flex" style="gap: 2px;">
              @for (colour of item.swatches; track colour) {
                <span [style.background]="colour" style="width: 14px; height: 14px; border-radius: 2px; display: inline-block;"></span>
              }
            </div>
            <span>{{ item.label }}</span>
          </div>
        </ng-template>
      </ng-select>
      @if (showReapply) {
        <app-badge-button
          caption="Reapply"
          [icon]="faPalette"
          (click)="reapply.emit()"
          [disabled]="disabled"
          tooltip="Regenerate with same palette"/>
      }
    </div>
  `,
  imports: [FormsModule, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective, BadgeButtonComponent, FontAwesomeModule]
})
export class ColourPaletteSelectorComponent {
  @Input() selected: ColourPalette = ColourPalette.RAMBLERS;
  @Input() showLabel = true;
  @Input() showReapply = true;
  @Input() disabled = false;
  @Output() selectedChange = new EventEmitter<ColourPalette>();
  @Output() reapply = new EventEmitter<void>();

  palettes = COLOUR_PALETTE_OPTIONS;
  faPalette = faPalette;

  get selectedOption(): ColourPaletteOption {
    return this.palettes.find(p => p.value === this.selected);
  }

  onSelectionChange() {
    this.selectedChange.emit(this.selected);
  }
}
