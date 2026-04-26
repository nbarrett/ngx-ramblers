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

    const tokens = searchText.toLowerCase().split(/\s+/).filter(token => token.length > 0);
    if (tokens.length === 0) {
      return itemsToSearch;
    }
    return itemsToSearch.filter(item => {
      const searchableContent = (item.searchableText || JSON.stringify(item)).toLowerCase();
      return tokens.every(token => searchableContent.includes(token));
    });
  }
}
