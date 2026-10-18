import { vi } from "vitest";
import { AlbumEditorView, AlbumPhotoSort, ContentMetadata, ContentMetadataItem } from "../../../models/content-metadata.model";
import { StoredValue } from "../../../models/ui-actions";
import { ImageListEditComponent } from "./image-list-edit";

describe("ImageListEditComponent photo preparation", () => {
  const photo = (index: number) => ({originalFileName: `photo-${index}.jpg`, base64Content: "data:image/jpeg;base64,YWJj"});
  const componentFor = (files: ContentMetadataItem[] = [photo(1), photo(2)]) => {
    const component = Object.create(ImageListEditComponent.prototype) as ImageListEditComponent;
    Object.assign(component, {
      contentMetadata: {maxImageSize: 200000, files},
      base64Files: [],
      nonImageFiles: [],
      contentMetadataService: {defaultDateSourceFor: () => "upload"},
      dateUtils: {dateTimeNow: () => ({toMillis: () => 1})},
      stringUtils: {pluraliseWithCount: (count: number, label: string) => `${count} ${label}${count === 1 ? "" : "s"}`},
      uploaderIdentity: () => null,
      contributor: () => false,
      addToChangedItems: vi.fn(),
      applyFilter: vi.fn(),
      notifyTarget: {busy: false},
      notify: {success: vi.fn(), error: vi.fn(), warning: vi.fn(), setBusy: vi.fn(), clearBusy: vi.fn()},
      logger: {error: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn()},
      numberUtils: {humanFileSize: () => "200 kb"},
      fileUtils: {
        isResizableName: () => true,
        resizeBase64Image: vi.fn().mockResolvedValue("data:image/jpeg;base64,c21hbGw="),
        downscaleBase64Image: vi.fn().mockResolvedValue("data:image/jpeg;base64,c21hbGw="),
        loadBase64ImageFromFile: vi.fn().mockImplementation(async (file: File) => ({file, base64Content: "data:image/jpeg;base64,YWJj"})),
        prepareDroppedFiles: vi.fn().mockImplementation(async (fileList: File[]) => ({
          images: Array.from(fileList || []).map(file => ({file, base64Content: "data:image/jpeg;base64,YWJj"})),
          skippedHeic: 0,
          unread: 0
        })),
        contentMetadataItemFromBase64File: (file: {file: File; base64Content: string}) => ({originalFileName: file.file.name, base64Content: file.base64Content})
      },
      urlService: {isBase64Image: (value: string) => value?.startsWith("data:image/")},
      uploader: {isUploading: false, clearQueue: vi.fn(), addToQueue: vi.fn(), uploadAll: vi.fn()}
    });
    return component;
  };

  it("resizes one photo at a time and reports progress for each", async () => {
    const component = componentFor();
    const pending: {complete: (value: string) => void} = {complete: null};
    component["fileUtils"].resizeBase64Image = vi.fn()
      .mockImplementationOnce(() => new Promise<string>(resolve => pending.complete = resolve))
      .mockResolvedValue("data:image/jpeg;base64,c21hbGw=");
    const resizing = component["compressUnsavedImagesToMaxSize"]();

    expect(component["fileUtils"].resizeBase64Image).toHaveBeenCalledTimes(1);
    pending.complete("data:image/jpeg;base64,c21hbGw=");
    await resizing;

    expect(component["fileUtils"].resizeBase64Image).toHaveBeenCalledTimes(2);
    expect(component["notify"].success).toHaveBeenLastCalledWith(expect.objectContaining({message: expect.stringContaining("photo 2 of 2")}));
  });

  it("keeps photos unsaved and reports the failed photo without starting an upload", async () => {
    const component = componentFor();
    component["fileUtils"].resizeBase64Image = vi.fn().mockRejectedValue(new Error("Canvas memory exhausted"));
    component["exitAfterSave"] = true;

    await component["prepareFilesAndPerformUpload"]();

    expect(component["uploader"].uploadAll).not.toHaveBeenCalled();
    expect(component["notify"].error).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining("photo 1 of 2 (photo-1.jpg)")}));
    expect(component["preparingPhotos"]).toBe(false);
    expect(component["exitAfterSave"]).toBe(false);
    expect(component["notify"].clearBusy).toHaveBeenCalled();
    expect(component["unsavedImages"]()).toHaveLength(2);
  });

  it("keeps a preparation error visible without claiming the selection was added", async () => {
    const existing = photo(100);
    const component = componentFor([existing]);
    component["fileUtils"].downscaleBase64Image = vi.fn().mockRejectedValue(new Error("Canvas memory exhausted"));

    await component.onFileSelectOrDropped([new File(["photo"], "photo-1.jpg", {type: "image/jpeg"})]);

    expect(component["notify"].error).toHaveBeenCalledWith(expect.objectContaining({message: "Canvas memory exhausted"}));
    expect(component["notify"].success).not.toHaveBeenCalledWith(expect.objectContaining({title: "Photos ready"}));
    expect(component.contentMetadata.files).toEqual([existing]);
    expect(component["preparingPhotos"]).toBe(false);
    expect(component["uploader"].uploadAll).not.toHaveBeenCalled();
  });

  it("honours auto-choose on Save in the traditional editor before clearing the request", async () => {
    const component = componentFor();
    const request = {marked: false};
    const createWalkAlbumService = {
      markAlbumForAutoCover: vi.fn(() => request.marked = true),
      clearPendingAlbum: vi.fn(() => request.marked = false),
      ensureAlbumPageAfterSave: vi.fn().mockResolvedValue(null),
      applyAutoCoverIfNeeded: vi.fn(async (album: ContentMetadata) => ({...album, coverImage: request.marked ? "chosen.jpeg" : album.coverImage}))
    };
    Object.assign(component, {
      workflowMode: false,
      saveOrUpdateSuccessful: vi.fn(),
      createWalkAlbumService,
      refreshS3Metadata: vi.fn().mockResolvedValue(null),
      postMetadataRetrieveMapping: vi.fn()
    });
    component.contentMetadata.name = "walks/photos/example";
    component.contentMetadata.coverImage = "previous.jpeg";

    component["autoChooseCover"]();
    const saved = await component.postSaveContentMetadata(Promise.resolve({...component.contentMetadata}));

    expect(saved.coverImage).toBe("chosen.jpeg");
    expect(createWalkAlbumService.applyAutoCoverIfNeeded).toHaveBeenCalledWith(expect.anything(), {force: false});
    expect(request.marked).toBe(false);
    expect(component["autoCoverRequested"]).toBe(false);
  });

  it("finishes each photo before reading the next and accepts a large selection", async () => {
    const component = componentFor([]);
    const files = Array.from({length: 80}, (_, index) => new File(["photo"], `photo-${index + 1}.jpg`, {type: "image/jpeg"}));
    const pending: {complete: (value: string) => void} = {complete: null};
    component["fileUtils"].downscaleBase64Image = vi.fn()
      .mockImplementationOnce(() => new Promise<string>(resolve => pending.complete = resolve))
      .mockResolvedValue("data:image/jpeg;base64,c21hbGw=");
    const preparing = component.onFileSelectOrDropped(files);
    await Promise.resolve();
    await Promise.resolve();

    expect(component["fileUtils"].prepareDroppedFiles).toHaveBeenCalledTimes(1);
    expect(component["fileUtils"].downscaleBase64Image).toHaveBeenCalledTimes(1);
    pending.complete("data:image/jpeg;base64,c21hbGw=");
    await preparing;

    expect(component["fileUtils"].prepareDroppedFiles).toHaveBeenCalledTimes(1);
    expect(component["unsavedImages"]()).toHaveLength(80);
    expect(component["unsavedImages"]().map(item => item.originalFileName)).toEqual(files.map(file => file.name));
    expect(component.base64Files).toHaveLength(0);
    expect(component["preparingPhotos"]).toBe(false);
    expect(component["notify"].success).toHaveBeenLastCalledWith(expect.objectContaining({message: "80 photos added. Save when you are done."}));
  });

  it("adds converted photos from the shared drop pipeline and warns about files that were not images", async () => {
    const component = componentFor([photo(100)]);
    const files = [1, 2, 3].map(index => new File(["photo"], `photo-${index}.heic`, {type: "image/heic"}));
    component["fileUtils"].prepareDroppedFiles = vi.fn().mockResolvedValue({
      images: [{file: files[0], base64Content: "data:image/jpeg;base64,YQ=="}, {file: files[2], base64Content: "data:image/jpeg;base64,YQ=="}],
      skippedHeic: 1,
      unread: 0
    });
    component["fileUtils"].downscaleBase64Image = vi.fn().mockResolvedValue("data:image/jpeg;base64,c21hbGw=");

    await component.onFileSelectOrDropped(files);

    expect(component["fileUtils"].prepareDroppedFiles).toHaveBeenCalledWith(files, expect.any(Array));
    expect(component["unsavedImages"]().map(item => item.originalFileName)).toEqual(["photo-1.heic", "photo-3.heic", "photo-100.jpg"]);
    expect(component["notify"].warning).toHaveBeenCalledWith(expect.objectContaining({title: "Some photos could not be added"}));
    expect(component["preparingPhotos"]).toBe(false);
    expect(component["notify"].clearBusy).toHaveBeenCalled();
    expect(component["uploader"].uploadAll).not.toHaveBeenCalled();
  });

  it("names files skipped by a partially successful drop", async () => {
    const component = componentFor([]);
    const file = new File(["photo"], "readable.jpeg", {type: "image/jpeg"});
    component["fileUtils"].prepareDroppedFiles = vi.fn().mockResolvedValue({
      images: [{file, base64Content: "data:image/jpeg;base64,YQ=="}],
      failedFiles: ["unreadable.jpeg", "corrupt.png"], unread: 1, skippedHeic: 0, skippedDuplicates: 0
    });

    await component.onFileSelectOrDropped([file]);

    expect(component["unsavedImages"]()).toHaveLength(1);
    expect(component["notify"].warning).toHaveBeenCalledWith(expect.objectContaining({
      title: "Some photos could not be added",
      message: expect.stringContaining("Files: unreadable.jpeg, corrupt.png")
    }));
    expect(component["uploader"].uploadAll).not.toHaveBeenCalled();
  });

  it("keeps all 39 unsaved photos while opening details and returning to the grid", () => {
    const files = Array.from({length: 39}, (_, index) => photo(index));
    const component = componentFor(files);
    Object.assign(component, {
      filteredFiles: files,
      route: {},
      router: {navigate: vi.fn().mockResolvedValue(true)}
    });
    component["openPhoto"](files[12]);
    expect(component["selectedPhoto"]()).toBe(files[12]);
    expect(component["unsavedImages"]()).toHaveLength(39);
    component["selectAdjacentPhoto"](1);
    expect(component["selectedPhoto"]()).toBe(files[13]);
    component["showPhotos"]();
    expect(component["unsavedImages"]()).toEqual(files);
    expect(component["uploader"].uploadAll).not.toHaveBeenCalled();
  });

  it("reports a repeated drop without adding or uploading another copy", async () => {
    const component = componentFor([photo(1)]);
    component["fileUtils"].prepareDroppedFiles = vi.fn().mockResolvedValue({images: [], skippedDuplicates: 1, skippedHeic: 0, unread: 0});
    await component.onFileSelectOrDropped([new File(["photo"], "photo-1.jpg", {type: "image/jpeg"})]);
    expect(component["unsavedImages"]()).toHaveLength(1);
    expect(component["notify"].warning).toHaveBeenCalledWith(expect.objectContaining({title: "Duplicate photos skipped"}));
    expect(component["notify"].error).not.toHaveBeenCalled();
    expect(component["uploader"].uploadAll).not.toHaveBeenCalled();
  });

  it("offers chronological and filename ordering without mutating the original list", () => {
    const files = [{...photo(10), date: 100}, {...photo(2), date: 300}, {...photo(1), date: 200}];
    const component = componentFor(files);
    component["albumPhotoSort"] = AlbumPhotoSort.NEWEST;
    expect(component["sortedPhotos"](files).map(item => item.date)).toEqual([300, 200, 100]);
    component["albumPhotoSort"] = AlbumPhotoSort.OLDEST;
    expect(component["sortedPhotos"](files).map(item => item.date)).toEqual([100, 200, 300]);
    component["albumPhotoSort"] = AlbumPhotoSort.FILENAME;
    expect(component["sortedPhotos"](files).map(item => item.originalFileName)).toEqual(["photo-1.jpg", "photo-2.jpg", "photo-10.jpg"]);
    expect(files.map(item => item.date)).toEqual([100, 300, 200]);
  });

  [AlbumPhotoSort.NEWEST, AlbumPhotoSort.OLDEST, AlbumPhotoSort.FILENAME].forEach(order => {
    [false, true].forEach(down => {
      it(`keeps a manual move ${down ? "down" : "up"} visible from ${order} ordering and saves custom order in the URL`, () => {
        const files = [{...photo(10), date: 100}, {...photo(2), date: 300}, {...photo(1), date: 200}];
        const component = componentFor(files);
        const navigate = vi.fn().mockResolvedValue(true);
        Object.assign(component, {
          albumPhotoSort: order,
          albumEditorView: AlbumEditorView.PHOTOS,
          route: {},
          router: {navigate},
          contentMetadataService: {
            findIndex: (items, item) => items.indexOf(item),
            canMoveUp: (items, item) => items.indexOf(item) > 0,
            canMoveDown: (items, item) => items.indexOf(item) < items.length - 1
          }
        });
        const displayed = component["sortedPhotos"](files);
        component.applyFilter = vi.fn(() => component.filteredFiles = component["sortedPhotos"](component.contentMetadata.files));
        const item = displayed[1];
        const expected = down ? [displayed[0], displayed[2], item] : [item, displayed[0], displayed[2]];

        if (down) {
          component.moveDown(item);
        } else {
          component.moveUp(item);
        }

        expect(component.filteredFiles).toEqual(expected);
        expect(component.contentMetadata.files).toEqual(expected);
        expect(component["albumPhotoSort"]).toBe(AlbumPhotoSort.CUSTOM);
        expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
          queryParams: {[StoredValue.ALBUM_PHOTO_SORT]: AlbumPhotoSort.CUSTOM},
          queryParamsHandling: "merge"
        }));
      });
    });
  });

  it("does not request S3 file metadata for an empty album", async () => {
    const component = componentFor([]);
    const listMetaData = vi.fn();
    Object.assign(component["contentMetadataService"], {listMetaData});

    await component["refreshS3Metadata"]();

    expect(listMetaData).not.toHaveBeenCalled();
    expect(component.s3Metadata).toEqual([]);
  });

  it("still loads S3 metadata for saved photos", async () => {
    const component = componentFor([{...photo(1), image: "photo-1.jpg"}]);
    const metadata = [{key: "carousels/hillside-park/photo-1.jpg"}];
    const listMetaData = vi.fn().mockResolvedValue(metadata);
    Object.assign(component["contentMetadataService"], {listMetaData, rootFolderAndName: () => "carousels/hillside-park"});

    await component["refreshS3Metadata"]();

    expect(listMetaData).toHaveBeenCalledWith("carousels/hillside-park");
    expect(component.s3Metadata).toEqual(metadata);
  });

  it("describes album loading separately from preparing newly selected photos", async () => {
    const component = componentFor([]);
    const pending: {resolve: (album: ContentMetadata) => void} = {resolve: null};
    Object.assign(component["contentMetadataService"], {items: () => new Promise<ContentMetadata>(resolve => pending.resolve = resolve)});
    component["postMetadataRetrieveMapping"] = vi.fn();
    const loading = component.refreshContentAndS3Metadata("hillside-park");

    expect(component.albumUploadTitle()).toBe("Loading album…");
    expect(component.albumUploadWorkingSubtitle()).toBe("Loading the album and saved photo details.");
    pending.resolve(component.contentMetadata);
    await loading;

    expect(component["loadingAlbum"]).toBe(false);
    expect(component.albumUploadTitle()).toBe("Add photos");
  });

});
