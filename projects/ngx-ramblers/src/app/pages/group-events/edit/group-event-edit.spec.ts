import { describe, expect, it, vi } from "vitest";
import { GroupEventEdit } from "./group-event-edit";
import { ExtendedGroupEvent } from "../../../models/group-event.model";

describe("GroupEventEdit URL sync", () => {
  function createContext(title: string | null, currentUrl = "existing-url") {
    const urlFor = vi.fn().mockResolvedValue("christmas-party-time");
    const createOrUpdate = vi.fn().mockImplementation(async (event: ExtendedGroupEvent) => event);
    const navigateTo = vi.fn();
    const logger = { info: vi.fn(), debug: vi.fn() };
    const notify = {
      setBusy: vi.fn(),
      clearBusy: vi.fn()
    };
    const display = {
      confirm: { clear: vi.fn() },
      groupEventLink: vi.fn().mockImplementation((event: ExtendedGroupEvent) =>
        event?.groupEvent?.url ? `social/${event.groupEvent.url}` : null)
    };
    const groupEvent = {
      id: "event-1",
      groupEvent: {
        title,
        url: currentUrl,
        location: {
          latitude: 0,
          longitude: 0,
          postcode: null,
          description: null
        }
      },
      fields: {
        venue: {
          venuePublish: true,
          isMeetingPlace: false
        }
      }
    } as ExtendedGroupEvent;
    const context = {
      groupEvent,
      walksAndEventsService: { urlFor, createOrUpdate },
      venueService: {
        syncGroupEventLocationFromVenue: vi.fn(),
        persistToCollection: vi.fn().mockResolvedValue(undefined),
        ensureVenue: vi.fn()
      },
      urlService: {
        area: () => "social",
        navigateTo,
        pathSegments: () => ["social", currentUrl, "edit"]
      },
      logger,
      notify,
      display,
      handleError: vi.fn(),
      close: vi.fn(),
      navigateToEventView: GroupEventEdit.prototype.navigateToEventView,
      syncUrlFromTitle: GroupEventEdit.prototype.syncUrlFromTitle
    } as unknown as GroupEventEdit;
    return { context, urlFor, createOrUpdate, navigateTo, groupEvent, notify, display };
  }

  describe("syncUrlFromTitle", () => {
    it("sets a client base slug then replaces it with the unique url from urlFor", async () => {
      const { context, urlFor, groupEvent } = createContext("Christmas Party time", "christmas-part");

      await GroupEventEdit.prototype.syncUrlFromTitle.call(context);

      expect(urlFor).toHaveBeenCalledWith(groupEvent);
      expect(groupEvent.groupEvent.url).toBe("christmas-party-time");
    });

    it("uses the client base slug when urlFor returns empty", async () => {
      const { context, urlFor, groupEvent } = createContext("Christmas Party time", "christmas-part");
      urlFor.mockResolvedValue("");

      await GroupEventEdit.prototype.syncUrlFromTitle.call(context);

      expect(groupEvent.groupEvent.url).toBe("christmas-party-time");
    });

    it("does not call urlFor or change the url when the title is empty", async () => {
      const { context, urlFor, groupEvent } = createContext("", "christmas-part");

      await GroupEventEdit.prototype.syncUrlFromTitle.call(context);

      expect(urlFor).not.toHaveBeenCalled();
      expect(groupEvent.groupEvent.url).toBe("christmas-part");
    });

    it("does not call urlFor when the title is missing", async () => {
      const { context, urlFor, groupEvent } = createContext(null, "christmas-part");

      await GroupEventEdit.prototype.syncUrlFromTitle.call(context);

      expect(urlFor).not.toHaveBeenCalled();
      expect(groupEvent.groupEvent.url).toBe("christmas-part");
    });
  });

  describe("onTitleChange", () => {
    it("delegates to syncUrlFromTitle", async () => {
      const { context, urlFor, groupEvent } = createContext("Christmas Party", "christmas-part");
      urlFor.mockResolvedValue("christmas-party");

      await GroupEventEdit.prototype.onTitleChange.call(context);

      expect(urlFor).toHaveBeenCalledWith(groupEvent);
      expect(groupEvent.groupEvent.url).toBe("christmas-party");
    });
  });

  describe("saveGroupEvent", () => {
    it("regenerates the url from the title before saving and navigates to the new event link", async () => {
      const { context, urlFor, createOrUpdate, navigateTo, groupEvent, notify, display } =
        createContext("Christmas Party time", "christmas-part");

      await GroupEventEdit.prototype.saveGroupEvent.call(context);

      expect(urlFor).toHaveBeenCalledWith(groupEvent);
      expect(groupEvent.groupEvent.url).toBe("christmas-party-time");
      expect(createOrUpdate).toHaveBeenCalledWith(groupEvent);
      expect(display.groupEventLink).toHaveBeenCalled();
      expect(navigateTo).toHaveBeenCalledWith(["social/christmas-party-time"]);
      expect(notify.setBusy).toHaveBeenCalled();
      expect(notify.clearBusy).toHaveBeenCalled();
    });

    it("still saves when the title is empty without regenerating the url", async () => {
      const { context, urlFor, createOrUpdate, navigateTo, groupEvent } =
        createContext("", "christmas-part");

      await GroupEventEdit.prototype.saveGroupEvent.call(context);

      expect(urlFor).not.toHaveBeenCalled();
      expect(groupEvent.groupEvent.url).toBe("christmas-part");
      expect(createOrUpdate).toHaveBeenCalledWith(groupEvent);
      expect(navigateTo).toHaveBeenCalledWith(["social/christmas-part"]);
    });
  });

  describe("navigateToEventView", () => {
    it("navigates using the relative group event link", () => {
      const { context, navigateTo, display } = createContext("Christmas Party time", "christmas-party-time");

      GroupEventEdit.prototype.navigateToEventView.call(context);

      expect(display.confirm.clear).toHaveBeenCalled();
      expect(display.groupEventLink).toHaveBeenCalledWith(context.groupEvent, true);
      expect(navigateTo).toHaveBeenCalledWith(["social/christmas-party-time"]);
    });
  });
});
