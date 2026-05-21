import { Directive, Input, TemplateRef, inject } from "@angular/core";

@Directive({
  selector: "[appSortableTableCell]",
  standalone: true
})
export class SortableTableCellDirective {
  template: TemplateRef<{ $implicit: any; row: any }> = inject(TemplateRef);
  @Input("appSortableTableCell") key!: string;
}
