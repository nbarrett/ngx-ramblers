import { EventEmitter } from "@angular/core";
import { vi } from "vitest";
import { ImageEditComponent } from "./image-edit";
import { ContentMetadataItem } from "../../../models/content-metadata.model";

describe("focused photo editing", () => {
  it("updates movement controls and clears previous photo state when navigating", () => {
    const component = Object.create(ImageEditComponent.prototype) as ImageEditComponent;
    Object.assign(component, {logger: {info: vi.fn()}, checkDuplicates: vi.fn(), editActive: true, imageLoadText: "Previous image failed"});
    const files = [{image: "first.jpg"}, {image: "second.jpg"}];
    component.acceptChangesFrom = files;
    component.acceptChangesFromIndex = 1;
    component.acceptChangesFromItem = files[1];
    expect(component.canMoveUp).toBe(true);
    expect(component.canMoveDown).toBe(false);
    expect(component.editActive).toBe(false);
    expect(component.imageLoadText).toBeNull();
  });

  it("passes cover choices to the gallery including photos not uploaded yet", () => {
    const component = Object.create(ImageEditComponent.prototype) as ImageEditComponent;
    const photo: ContentMetadataItem = {originalFileName: "photo.jpg", base64Content: "data:image/jpeg;base64,YWJj"};
    component.item = photo;
    component.selectedCover = photo;
    component.coverChange = new EventEmitter<ContentMetadataItem>();
    const chosen = vi.fn();
    const subscription = component.coverChange.subscribe(chosen);
    expect(component.coverImageSelected()).toBe(true);
    component.coverImageSet();
    expect(chosen).toHaveBeenCalledWith(photo);
    subscription.unsubscribe();
  });
});
