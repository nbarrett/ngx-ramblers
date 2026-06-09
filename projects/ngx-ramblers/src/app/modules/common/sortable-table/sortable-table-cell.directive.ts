import { Directive, Input, TemplateRef, inject } from "@angular/core";

@Directive({
  selector: "[appSortableTableCell]",
  standalone: true
})
export class SortableTableCellDirective {
  template: TemplateRef<{ $implicit: any; row: any }> = inject(TemplateRef);
  @Input("appSortableTableCell") key!: string;
}

@Directive({
  selector: "[appSortableTableGroupHeader]",
  standalone: true
})
export class SortableTableGroupHeaderDirective {
  template: TemplateRef<{ $implicit: any; group: any }> = inject(TemplateRef);
}

@Directive({
  selector: "[appSortableTableExpandedRow]",
  standalone: true
})
export class SortableTableExpandedRowDirective {
  template: TemplateRef<{ $implicit: any; row: any }> = inject(TemplateRef);
}
