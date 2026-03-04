import { describe, it, expect } from "vitest";
import { sanitizeSearchInput, sanitizeErrorMessage, sanitizeUrl, MAX_SEARCH_LENGTH } from "./utils";

describe("sanitizeSearchInput", () => {
  it("trims whitespace", () => {
    expect(sanitizeSearchInput("  hello  ")).toBe("hello");
  });

  it("normalizes unicode to NFC", () => {
    // é as two code points (e + combining accent) vs single code point
    const decomposed = "e\u0301";
    const composed = "\u00e9";
    expect(sanitizeSearchInput(decomposed)).toBe(composed);
  });

  it("truncates to MAX_SEARCH_LENGTH", () => {
    const long = "a".repeat(MAX_SEARCH_LENGTH + 100);
    expect(sanitizeSearchInput(long)).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeSearchInput("")).toBe("");
    expect(sanitizeSearchInput("   ")).toBe("");
  });
});

describe("sanitizeErrorMessage", () => {
  it("returns fallback for null/undefined/empty", () => {
    expect(sanitizeErrorMessage(null)).toBe("An unknown error occurred");
    expect(sanitizeErrorMessage(undefined)).toBe("An unknown error occurred");
    expect(sanitizeErrorMessage("")).toBe("An unknown error occurred");
  });

  it("strips control characters", () => {
    expect(sanitizeErrorMessage("hello\x00world")).toBe("hello world");
    expect(sanitizeErrorMessage("line\nnewline")).toBe("line newline");
  });

  it("truncates long messages with ellipsis", () => {
    const long = "x".repeat(600);
    const result = sanitizeErrorMessage(long);
    expect(result.length).toBe(503); // 500 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("passes through normal messages", () => {
    expect(sanitizeErrorMessage("Something went wrong")).toBe("Something went wrong");
  });
});

describe("sanitizeUrl", () => {
  it("allows http and https URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com/");
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(sanitizeUrl("data:text/html,<h1>hi</h1>")).toBeNull();
  });

  it("rejects ftp: URLs", () => {
    expect(sanitizeUrl("ftp://example.com")).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(sanitizeUrl(null)).toBeNull();
    expect(sanitizeUrl(undefined)).toBeNull();
    expect(sanitizeUrl("")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(sanitizeUrl("not a url")).toBeNull();
  });
});
