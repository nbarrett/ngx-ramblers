import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "filter" })
export class SearchFilterPipe implements PipeTransform {

  transform(itemsToSearch: any[], searchText: string): any[] {
    if (!itemsToSearch) {
      return [];
    }

    if (!searchText) {
      return itemsToSearch;
    }

    searchText = searchText.toLowerCase();
    return itemsToSearch.filter(item => {
      const searchableContent = item.searchableText || JSON.stringify(item);
      return searchableContent.toLowerCase().includes(searchText);
    });
  }
}
