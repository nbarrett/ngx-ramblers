import { SelectedWalksWithStatusNotMatching } from "./selectedWalksWithStatusNotMatching";
import { SelectedWalksWithStatusMatching } from "./selectedWalksWithStatusMatching";

export class SelectedWalksWithStatus {

  static matching = (...statuses: string[]) => new SelectedWalksWithStatusMatching(statuses);
  static notMatching = (...statuses: string[]) => new SelectedWalksWithStatusNotMatching(statuses);

}
