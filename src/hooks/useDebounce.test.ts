import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "./useDebounce";

describe("useDebouncedValue", () => {
  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("debounces value changes", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "initial", delay: 300 } }
    );

    expect(result.current).toBe("initial");

    // Change value
    rerender({ value: "updated", delay: 300 });

    // Value should not change yet
    expect(result.current).toBe("initial");

    // Advance time past debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("updated");

    vi.useRealTimers();
  });

  it("resets timer on rapid changes", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    rerender({ value: "b", delay: 300 });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: "c", delay: 300 });
    act(() => { vi.advanceTimersByTime(100); });

    rerender({ value: "d", delay: 300 });

    // Only 200ms have passed since last change, should still be "a"
    expect(result.current).toBe("a");

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe("d");

    vi.useRealTimers();
  });
});
