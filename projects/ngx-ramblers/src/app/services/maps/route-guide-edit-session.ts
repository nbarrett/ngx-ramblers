import { Injectable } from "@angular/core";
import { cloneDeep } from "es-toolkit/compat";
import { MapMarker } from "../../models/content-text.model";
import { ROUTE_UNDO_LIMIT } from "../../models/route-follow.model";

@Injectable()
export class RouteGuideEditSession {
  editing = false;
  private undoStack: MapMarker[][] = [];
  private snapshot: MapMarker[] | null = null;

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  begin(markers: MapMarker[]): void {
    this.editing = true;
    this.undoStack = [];
    this.snapshot = cloneDeep(markers);
  }

  end(): void {
    this.editing = false;
    this.undoStack = [];
    this.snapshot = null;
  }

  record(markers: MapMarker[]): void {
    const current = cloneDeep(markers);
    const top = this.undoStack[this.undoStack.length - 1];
    if (!top || JSON.stringify(top) !== JSON.stringify(current)) {
      this.undoStack = [...this.undoStack.slice(-(ROUTE_UNDO_LIMIT - 1)), current];
    }
  }

  undo(): MapMarker[] | null {
    return this.undoStack.pop() || null;
  }

  discard(): MapMarker[] | null {
    return this.snapshot;
  }
}
