import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSpawn } from "./test/setup";
import {
  createMockSpawnPromise,
  createMockStreamingProcess,
  mockPackageListResponse,
  mockUpdatesResponse,
  mockPackageDetails,
} from "./test/mocks";
import {
  listInstalled,
  checkUpdates,
  getPackageInfo,
  formatSize,
  formatNumber,
  formatDate,
  BackendError,
  runUpgrade,
} from "./api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("formatSize", () => {
  it("formats bytes", () => {
    expect(formatSize(500)).toBe("500 B");
    expect(formatSize(0)).toBe("0 B");
  });

  it("formats KiB", () => {
    expect(formatSize(1024)).toBe("1.0 KiB");
    expect(formatSize(2048)).toBe("2.0 KiB");
  });

  it("formats MiB", () => {
    expect(formatSize(1024 * 1024)).toBe("1.0 MiB");
    expect(formatSize(150000000)).toBe("143.1 MiB");
  });

  it("formats GiB", () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe("1.00 GiB");
  });

  it("handles negative values", () => {
    expect(formatSize(-1024)).toBe("-1.0 KiB");
    expect(formatSize(-500)).toBe("-500 B");
  });
});

describe("formatNumber", () => {
  it("formats numbers with locale separators", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(42)).toBe("42");
  });
});

describe("formatDate", () => {
  it("returns Unknown for null", () => {
    expect(formatDate(null)).toBe("Unknown");
  });

  it("converts unix timestamp to locale string", () => {
    const result = formatDate(1704067200);
    // Just check it returns a non-empty string (locale-dependent format)
    expect(result).toBeTruthy();
    expect(result).not.toBe("Unknown");
  });
});

describe("BackendError", () => {
  it("creates error with code", () => {
    const err = new BackendError("test error", "timeout");
    expect(err.message).toBe("test error");
    expect(err.code).toBe("timeout");
    expect(err.name).toBe("BackendError");
  });

  it("defaults to internal_error code", () => {
    const err = new BackendError("test");
    expect(err.code).toBe("internal_error");
  });

  it("creates from structured error", () => {
    const err = BackendError.fromStructured({
      code: "database_locked",
      message: "DB locked",
      details: "some details",
    });
    expect(err.code).toBe("database_locked");
    expect(err.message).toBe("DB locked");
    expect(err.details).toBe("some details");
  });
});

describe("runBackend-based API functions", () => {
  it("listInstalled calls backend with correct args", async () => {
    mockSpawn.mockReturnValue(
      createMockSpawnPromise(JSON.stringify(mockPackageListResponse))
    );

    const result = await listInstalled({ offset: 0, limit: 50, search: "linux" });
    expect(result.packages).toHaveLength(2);
    expect(result.total).toBe(2);

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.arrayContaining(["list-installed", "0", "50", "linux"]),
      expect.objectContaining({ superuser: "try" })
    );
  });

  it("checkUpdates returns update info", async () => {
    mockSpawn.mockReturnValue(
      createMockSpawnPromise(JSON.stringify(mockUpdatesResponse))
    );

    const result = await checkUpdates();
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].name).toBe("linux");
  });

  it("getPackageInfo returns package details", async () => {
    mockSpawn.mockReturnValue(
      createMockSpawnPromise(JSON.stringify(mockPackageDetails))
    );

    const result = await getPackageInfo("linux");
    expect(result.name).toBe("linux");
    expect(result.version).toBe("6.7.0-arch1-1");
  });

  it("throws BackendError on spawn failure", async () => {
    mockSpawn.mockReturnValue(
      createMockSpawnPromise("", true, new Error("unable to lock database"))
    );

    await expect(checkUpdates()).rejects.toThrow(BackendError);
    await expect(checkUpdates()).rejects.toThrow(/unable to lock database/);
  });

  it("throws BackendError on empty response", async () => {
    mockSpawn.mockReturnValue(createMockSpawnPromise(""));
    await expect(checkUpdates()).rejects.toThrow(BackendError);
  });

  it("throws BackendError on invalid JSON", async () => {
    mockSpawn.mockReturnValue(createMockSpawnPromise("not json"));
    await expect(checkUpdates()).rejects.toThrow(BackendError);
  });

  it("throws BackendError for structured error response", async () => {
    mockSpawn.mockReturnValue(
      createMockSpawnPromise(JSON.stringify({ code: "not_found", message: "Package not found" }))
    );

    await expect(getPackageInfo("nonexistent")).rejects.toThrow("Package not found");
  });
});

describe("runStreamingBackend-based API functions", () => {
  it("runUpgrade creates streaming process and calls callbacks", () => {
    const proc = createMockStreamingProcess();
    mockSpawn.mockReturnValue(proc);

    const onComplete = vi.fn();
    const onError = vi.fn();
    const onData = vi.fn();

    const { cancel } = runUpgrade({ onComplete, onError, onData });

    expect(mockSpawn).toHaveBeenCalled();
    expect(typeof cancel).toBe("function");

    // Simulate a complete event
    proc._emit(JSON.stringify({ type: "complete", success: true }) + "\n");
    expect(onComplete).toHaveBeenCalled();
  });

  it("runUpgrade handles error events", () => {
    const proc = createMockStreamingProcess();
    mockSpawn.mockReturnValue(proc);

    const onComplete = vi.fn();
    const onError = vi.fn();

    runUpgrade({ onComplete, onError });

    proc._emit(JSON.stringify({ type: "complete", success: false, message: "Transaction failed" }) + "\n");
    expect(onError).toHaveBeenCalledWith("Transaction failed");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("runUpgrade passes ignored packages", () => {
    const proc = createMockStreamingProcess();
    mockSpawn.mockReturnValue(proc);

    runUpgrade({ onComplete: vi.fn(), onError: vi.fn() }, ["pkg1", "pkg2"]);

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.arrayContaining(["upgrade", "pkg1,pkg2"]),
      expect.any(Object)
    );
  });
});
