import { PageElement } from "@serenity-js/web";

export interface RamblersWalkSummary {
  tableRow: PageElement;
  walkId: string;
  walkDate: string;
  title: string;
  status: string;
  currentlySelected: boolean;
  cancelled: boolean;
}
