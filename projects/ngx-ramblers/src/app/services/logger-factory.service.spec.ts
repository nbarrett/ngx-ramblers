import { NGXLogger, NgxLoggerLevel } from "ngx-logger";
import { vi } from "vitest";
import { Logger } from "./logger-factory.service";

describe("Logger", () => {
  describe("table", () => {
    let debugSpy: ReturnType<typeof vi.fn>;
    let consoleTableSpy: ReturnType<typeof vi.spyOn>;
    let ngxLogger: NGXLogger;

    beforeEach(() => {
      debugSpy = vi.fn();
      consoleTableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined);
      ngxLogger = { debug: debugSpy } as unknown as NGXLogger;
    });

    afterEach(() => {
      consoleTableSpy.mockRestore();
    });

    it("renders the label and table when level is DEBUG", () => {
      const logger = new Logger(ngxLogger, "BannerComponent", NgxLoggerLevel.DEBUG);

      logger.table("banner-diagnostics: 3 banners", [{ id: "a" }]);

      expect(debugSpy).toHaveBeenCalledWith("BannerComponent -", "banner-diagnostics: 3 banners");
      expect(consoleTableSpy).toHaveBeenCalledWith([{ id: "a" }]);
    });

    it("renders the label and table when level is finer than DEBUG (TRACE)", () => {
      const logger = new Logger(ngxLogger, "BannerComponent", NgxLoggerLevel.TRACE);

      logger.table("label", [{ id: "a" }]);

      expect(debugSpy).toHaveBeenCalled();
      expect(consoleTableSpy).toHaveBeenCalled();
    });

    it("is a no-op when level is coarser than DEBUG (ERROR)", () => {
      const logger = new Logger(ngxLogger, "BannerComponent", NgxLoggerLevel.ERROR);

      logger.table("label", [{ id: "a" }]);

      expect(debugSpy).not.toHaveBeenCalled();
      expect(consoleTableSpy).not.toHaveBeenCalled();
    });
  });
});
