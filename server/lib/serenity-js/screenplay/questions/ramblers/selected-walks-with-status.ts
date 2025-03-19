import { SelectedWalksWithStatusNotMatching } from "./selected-walks-with-status-not-matching";
import { SelectedWalksWithStatusMatching } from "./selected-walks-with-status-matching";

export class SelectedWalksWithStatus {

  static matching = (...statuses: string[]) => new SelectedWalksWithStatusMatching(statuses);
  static notMatching = (...statuses: string[]) => new SelectedWalksWithStatusNotMatching(statuses);

}
