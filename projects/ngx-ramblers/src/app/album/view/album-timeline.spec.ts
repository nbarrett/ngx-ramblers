import { AlbumTimelineComponent } from "./album-timeline";
import { TimelinePlayDirection } from "../../models/content-text.model";
import { StoredValue } from "../../models/ui-actions";
import { RECENT_PHOTOS } from "../../models/content-metadata.model";
import { ElementRef } from "@angular/core";

describe("album timeline behaviour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function timeline(): AlbumTimelineComponent {
    const view = Object.create(AlbumTimelineComponent.prototype) as AlbumTimelineComponent;
    view.slides = [{_id: "a"}, {_id: "b"}, {_id: "c"}] as typeof view.slides;
    view.current = 1;
    view.preview = false;
    view.album = {slideInterval: 4000, timelineViewOptions: {playDirection: TimelinePlayDirection.BACKWARDS}} as typeof view.album;
    view["playTimer"] = null;
    view["dragging"] = false;
    view["scrubbing"] = false;
    view["hasUserMoved"] = false;
    view["viewInitialised"] = true;
    view.currentTag = RECENT_PHOTOS;
    view.videoIsPlaying = false;
    view["uiActions"] = {
      queryParameter: vi.fn().mockReturnValue("3"),
      updateQueryParameter: vi.fn()
    } as unknown as typeof view["uiActions"];
    return view;
  }

  it("opens on the URL playhead", () => {
    const view = timeline();
    view["applyUrlIndex"]();
    expect(view.current).toBe(2);
    expect(view["uiActions"].queryParameter).toHaveBeenCalledWith(StoredValue.TIMELINE, undefined);
  });

  it("keeps navigation and autoplay moving when URL changes re-emit the selected story", () => {
    const view = timeline();
    const tag = {key: 12, subject: "Summer Solstice"} as typeof view.currentTag;
    view.currentTag = tag;
    view["uiActions"].updateQueryParameter = vi.fn().mockImplementation(() => view.tagChanged({...tag}));
    view["changeDetector"] = {detectChanges: vi.fn()} as unknown as typeof view["changeDetector"];
    view.step(-1);
    expect(view.current).toBe(0);
    view["advancePlay"]();
    expect(view.current).toBe(2);
    view.ngOnDestroy();
  });

  it("restores the shared playhead when the initial story is selected", () => {
    const view = timeline();
    view["viewInitialised"] = false;
    view["lazyLoadingMetadataService"] = {initialiseAvailableSlides: vi.fn()} as unknown as typeof view["lazyLoadingMetadataService"];
    view.lazyLoadingMetadata = {availableSlides: view.slides} as typeof view.lazyLoadingMetadata;
    view.tagChanged({key: 12, subject: "Summer Solstice"} as typeof view.currentTag);
    expect(view.current).toBe(2);
    expect(view["uiActions"].updateQueryParameter).not.toHaveBeenCalled();
  });

  it("centres the selected photo throughout scrubbing with unequal photo widths", () => {
    const view = timeline();
    const track = document.createElement("div");
    const film = document.createElement("div");
    [{left: 16, width: 600}, {left: 632, width: 120}, {left: 768, width: 300}].forEach(geometry => {
      const slide = document.createElement("figure");
      slide.className = "timeline-slide";
      Object.defineProperties(slide, {offsetLeft: {value: geometry.left}, offsetWidth: {value: geometry.width}});
      film.appendChild(slide);
    });
    Object.defineProperty(track, "clientWidth", {value: 400});
    view.trackRef = new ElementRef(track);
    view.filmRef = new ElementRef(film);
    view["scrubEl"] = document.createElement("div");
    vi.spyOn(view["scrubEl"], "getBoundingClientRect").mockReturnValue({left: 0, width: 100} as DOMRect);
    view["scrubbing"] = true;
    [0, 50, 100].forEach((clientX, index) => {
      view["seekScrub"]({clientX} as PointerEvent);
      expect(view.current).toBe(index);
      expect(view.x).toBe([-116, -492, -718][index]);
      expect(view.knobPercent).toBe(clientX);
    });
    const position = view.x;
    view.onScrubUp();
    expect(view.x).toBe(position);
  });

  it("leaves video pointer input available without starting a film drag", () => {
    const view = timeline();
    const video = document.createElement("div");
    video.className = "timeline-video";
    const player = document.createElement("iframe");
    video.appendChild(player);
    view.onTrackDown({target: player} as unknown as PointerEvent);
    expect(view.dragging).toBe(false);
  });

  it("pauses autoplay while the current video plays and resumes when it stops", () => {
    const view = timeline();
    view["changeDetector"] = {detectChanges: vi.fn()} as unknown as typeof view["changeDetector"];
    view["restartPlay"]();
    view.onVideoPlaybackChange(view.current, true);
    vi.advanceTimersByTime(8000);
    expect(view.current).toBe(1);
    view.onVideoPlaybackChange(view.current, false);
    vi.advanceTimersByTime(4000);
    expect(view.current).toBe(0);
  });

  it("resumes autoplay when navigating away from a playing video", () => {
    const view = timeline();
    view["changeDetector"] = {detectChanges: vi.fn()} as unknown as typeof view["changeDetector"];
    view.onVideoPlaybackChange(view.current, true);
    view.goIndex(2, true);
    vi.advanceTimersByTime(4000);
    expect(view.current).toBe(1);
  });

  it("filters to the chosen story and resets to the first of that sequence", () => {
    const view = timeline();
    view["lazyLoadingMetadataService"] = {initialiseAvailableSlides: vi.fn()} as unknown as typeof view["lazyLoadingMetadataService"];
    view.lazyLoadingMetadata = {availableSlides: [{_id: "solstice-1"}, {_id: "solstice-2"}]} as typeof view.lazyLoadingMetadata;
    view.tagChanged({key: 12, subject: "Summer Solstice"} as typeof view.currentTag);
    expect(view.currentTag.subject).toBe("Summer Solstice");
    expect(view.slides.map(slide => slide._id)).toEqual(["solstice-1", "solstice-2"]);
    expect(view.current).toBe(1);
  });

  it("pauses autoplay while the tab is hidden and arms it again when visible", () => {
    const view = timeline();
    view["playTimer"] = 99 as unknown as typeof view["playTimer"];
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    view.onVisibilityChange();
    expect(view["playTimer"]).toBeNull();
    hidden.mockReturnValue(false);
    view.onVisibilityChange();
    expect(view["playTimer"]).toBeTruthy();
    hidden.mockRestore();
    view.ngOnDestroy();
  });
});
