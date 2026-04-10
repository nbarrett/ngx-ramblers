import { Component, EventEmitter, inject, OnInit, Output } from "@angular/core";
import { Location } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { isNull } from "es-toolkit/compat";
import { PageContentColumn } from "../../../models/content-text.model";
import { StoredValue } from "../../../models/ui-actions";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";

@Component({
  selector: "app-dynamic-content-search-input",
  standalone: true,
  template: `
    <div class="row mb-3">
      <div class="col-12">
        <div class="input-group">
          <span class="input-group-text">
            <fa-icon [icon]="faSearch"></fa-icon>
          </span>
          <input type="text"
                 class="form-control"
                 placeholder="Search..."
                 [(ngModel)]="searchText"
                 (ngModelChange)="onSearchChange()">
        </div>
      </div>
    </div>
  `,
  imports: [FormsModule, FontAwesomeModule]
})
export class DynamicContentSearchInputComponent implements OnInit {

  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private stringUtils = inject(StringUtilsService);
  private ui = inject(UiActionsService);

  @Output() searchTextChange = new EventEmitter<string>();

  protected readonly faSearch = faSearch;
  searchText = "";
  private searchDebounce: any;

  ngOnInit() {
    const searchParam = this.stringUtils.kebabCase(StoredValue.SEARCH);
    const urlSearchValue = this.route.snapshot.queryParamMap.get(searchParam);
    if (!isNull(urlSearchValue)) {
      this.searchText = urlSearchValue;
      this.ui.saveValueFor(StoredValue.SEARCH, urlSearchValue);
    } else {
      this.searchText = "";
      this.ui.saveValueFor(StoredValue.SEARCH, "");
    }
    this.searchTextChange.emit(this.searchText);
  }

  onSearchChange() {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
    this.searchDebounce = setTimeout(() => {
      this.ui.saveValueFor(StoredValue.SEARCH, this.searchText || "");
      this.updateUrlParams();
      this.searchTextChange.emit(this.searchText);
    }, 300);
  }

  private updateUrlParams() {
    const searchParam = this.stringUtils.kebabCase(StoredValue.SEARCH);
    const params = new URLSearchParams(window.location.search);
    if (this.searchText) {
      params.set(searchParam, this.searchText);
    } else {
      params.delete(searchParam);
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    this.location.replaceState(newUrl);
  }
}

export function filterColumnsBySearchText(columns: PageContentColumn[], searchText: string): PageContentColumn[] {
  if (!searchText) {
    return columns || [];
  }
  const lower = searchText.toLowerCase();
  return (columns || []).filter(column =>
    column.title?.toLowerCase().includes(lower) ||
    column.contentText?.toLowerCase().includes(lower)
  );
}
