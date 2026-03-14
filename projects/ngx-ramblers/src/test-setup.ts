import { isUndefined } from "es-toolkit/compat";
import { vi } from "vitest";
import { Settings } from "luxon";

Settings.defaultZone = "Europe/London";

class MockWorker {
    postMessage() {
        return null;
    }

    terminate() {
        return null;
    }

    addEventListener() {
        return null;
    }

    removeEventListener() {
        return null;
    }
}

if (!("Worker" in globalThis)) {
    vi.stubGlobal("Worker", MockWorker);
}

if (!isUndefined(globalThis.HTMLCanvasElement)) {
    globalThis.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4).fill(255) }))
    })) as unknown as typeof globalThis.HTMLCanvasElement.prototype.getContext;
}
