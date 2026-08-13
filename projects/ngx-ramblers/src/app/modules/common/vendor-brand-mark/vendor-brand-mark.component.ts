import { Component, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { resolveVendorBrand, VendorBrandMark } from "../../../models/vendor-brand.model";

@Component({
  selector: "app-vendor-brand-mark",
  imports: [FontAwesomeModule],
  template: `
    @if (resolvedBrand(); as brand) {
      @if (brand.logoSrc) {
        <img [src]="brand.logoSrc"
             [alt]="brand.alt"
             [style.height.px]="markHeightPx(brand)"
             class="vendor-brand-mark"
             [class.vendor-brand-mark-inline]="inline">
      } @else if (brand.icon) {
        <fa-icon [icon]="brand.icon"
                 class="vendor-brand-icon"
                 [class.vendor-brand-icon-inline]="inline"
                 [style.color]="brand.iconColor || null"
                 [style.font-size.px]="markHeightPx(brand)"></fa-icon>
      }
    }
  `,
  styles: [`
    :host
      display: inline-flex
      align-items: center
      justify-content: center
      flex: 0 0 auto
      line-height: 0
      vertical-align: middle
      min-width: 1.15rem
      min-height: 1.15rem

    .vendor-brand-mark
      display: block
      width: auto
      max-width: 2.5rem
      height: auto
      object-fit: contain

    .vendor-brand-mark-inline
      max-width: 1.25rem
      max-height: 1.15rem

    .vendor-brand-icon
      display: block
      line-height: 1

    .vendor-brand-icon-inline
      width: 1.15rem
      height: 1.15rem
      text-align: center
  `]
})
export class VendorBrandMarkComponent {
  @Input() brand: VendorBrandMark | null = null;
  @Input() brandKey: string | null = null;
  @Input() serviceId: string | null = null;
  @Input() systemId: string | null = null;
  @Input() sizePx: number | null = null;
  @Input() inline = false;

  resolvedBrand(): VendorBrandMark | null {
    return resolveVendorBrand({
      brand: this.brand,
      brandKey: this.brandKey,
      serviceId: this.serviceId,
      systemId: this.systemId
    });
  }

  markHeightPx(brand: VendorBrandMark): number {
    if (this.sizePx) {
      return this.sizePx;
    } else if (this.inline) {
      return 18;
    } else if (brand.logoHeightPx) {
      return brand.logoHeightPx;
    } else {
      return 22;
    }
  }
}
