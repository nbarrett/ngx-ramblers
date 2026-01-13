import { TestBed } from "@angular/core/testing";
import { YouTubeService } from "./youtube.service";
import { LoggerTestingModule } from "ngx-logger/testing";

describe("YouTubeService", () => {
  let service: YouTubeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule]
    });
    service = TestBed.inject(YouTubeService);
  });

  describe("extractVideoId", () => {
    it("should return null for empty input", () => {
      expect(service.extractVideoId("")).toBeNull();
      expect(service.extractVideoId(null)).toBeNull();
      expect(service.extractVideoId(undefined)).toBeNull();
    });

    it("should return the input if it is already a valid video ID", () => {
      expect(service.extractVideoId("-sltmkQkoUs")).toBe("-sltmkQkoUs");
      expect(service.extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(service.extractVideoId("abc123DEF_-")).toBe("abc123DEF_-");
    });

    it("should extract video ID from youtu.be short URLs", () => {
      expect(service.extractVideoId("https://youtu.be/-sltmkQkoUs")).toBe("-sltmkQkoUs");
      expect(service.extractVideoId("http://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(service.extractVideoId("youtu.be/abc123DEF_-")).toBe("abc123DEF_-");
    });

    it("should extract video ID from standard youtube.com watch URLs", () => {
      expect(service.extractVideoId("https://www.youtube.com/watch?v=-sltmkQkoUs")).toBe("-sltmkQkoUs");
      expect(service.extractVideoId("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(service.extractVideoId("https://youtube.com/watch?v=abc123DEF_-&t=120")).toBe("abc123DEF_-");
    });

    it("should extract video ID from youtube.com embed URLs", () => {
      expect(service.extractVideoId("https://www.youtube.com/embed/-sltmkQkoUs")).toBe("-sltmkQkoUs");
      expect(service.extractVideoId("http://youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from youtube-nocookie.com embed URLs", () => {
      expect(service.extractVideoId("https://www.youtube-nocookie.com/embed/-sltmkQkoUs")).toBe("-sltmkQkoUs");
      expect(service.extractVideoId("http://youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from youtube.com/v URLs", () => {
      expect(service.extractVideoId("https://www.youtube.com/v/-sltmkQkoUs")).toBe("-sltmkQkoUs");
      expect(service.extractVideoId("http://youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from youtube.com shorts URLs", () => {
      expect(service.extractVideoId("https://www.youtube.com/shorts/-sltmkQkoUs")).toBe("-sltmkQkoUs");
      expect(service.extractVideoId("http://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from youtube.com live URLs", () => {
      expect(service.extractVideoId("https://www.youtube.com/live/-sltmkQkoUs")).toBe("-sltmkQkoUs");
      expect(service.extractVideoId("http://youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should handle URLs with extra whitespace", () => {
      expect(service.extractVideoId("  https://youtu.be/-sltmkQkoUs  ")).toBe("-sltmkQkoUs");
      expect(service.extractVideoId("\thttps://www.youtube.com/watch?v=dQw4w9WgXcQ\n")).toBe("dQw4w9WgXcQ");
    });

    it("should return null for invalid inputs", () => {
      expect(service.extractVideoId("not-a-url")).toBeNull();
      expect(service.extractVideoId("https://vimeo.com/123456789")).toBeNull();
      expect(service.extractVideoId("https://example.com/video")).toBeNull();
      expect(service.extractVideoId("12345")).toBeNull();
    });
  });

  describe("isValidVideoId", () => {
    it("should return true for valid 11-character video IDs", () => {
      expect(service.isValidVideoId("-sltmkQkoUs")).toBe(true);
      expect(service.isValidVideoId("dQw4w9WgXcQ")).toBe(true);
      expect(service.isValidVideoId("abc123DEF_-")).toBe(true);
      expect(service.isValidVideoId("___________")).toBe(true);
      expect(service.isValidVideoId("-----------")).toBe(true);
    });

    it("should return false for invalid video IDs", () => {
      expect(service.isValidVideoId("")).toBe(false);
      expect(service.isValidVideoId("short")).toBe(false);
      expect(service.isValidVideoId("toolongvideoid123")).toBe(false);
      expect(service.isValidVideoId("invalid!char")).toBe(false);
      expect(service.isValidVideoId("has spaces!")).toBe(false);
    });
  });

  describe("embedUrl", () => {
    it("should return null for empty video ID", () => {
      expect(service.embedUrl("")).toBeNull();
      expect(service.embedUrl(null)).toBeNull();
    });

    it("should generate embed URL without API parameter by default", () => {
      expect(service.embedUrl("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    });

    it("should generate embed URL with API parameter when enabled", () => {
      expect(service.embedUrl("dQw4w9WgXcQ", true)).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1");
    });
  });

  describe("thumbnailUrl", () => {
    it("should return null for empty video ID", () => {
      expect(service.thumbnailUrl("")).toBeNull();
      expect(service.thumbnailUrl(null)).toBeNull();
    });

    it("should generate thumbnail URL with default quality", () => {
      expect(service.thumbnailUrl("dQw4w9WgXcQ")).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
    });
  });
});
