import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "./usePagination";

describe("usePagination", () => {
  it("uses default values", () => {
    const { result } = renderHook(() => usePagination());
    expect(result.current.page).toBe(1);
    expect(result.current.perPage).toBe(50);
    expect(result.current.total).toBe(0);
    expect(result.current.offset).toBe(0);
  });

  it("respects custom defaults", () => {
    const { result } = renderHook(() =>
      usePagination({ defaultPerPage: 20, defaultPage: 2 })
    );
    expect(result.current.page).toBe(2);
    expect(result.current.perPage).toBe(20);
    expect(result.current.offset).toBe(20); // (2-1) * 20
  });

  it("calculates offset correctly", () => {
    const { result } = renderHook(() => usePagination({ defaultPerPage: 10 }));

    act(() => { result.current.setPage(3); });
    expect(result.current.offset).toBe(20); // (3-1) * 10

    act(() => { result.current.setPage(1); });
    expect(result.current.offset).toBe(0);
  });

  it("onPerPageSelect resets to page 1", () => {
    const { result } = renderHook(() => usePagination());

    act(() => { result.current.setPage(5); });
    expect(result.current.page).toBe(5);

    act(() => {
      result.current.onPerPageSelect({} as React.MouseEvent, 100);
    });

    expect(result.current.perPage).toBe(100);
    expect(result.current.page).toBe(1);
  });

  it("resetPage goes back to page 1", () => {
    const { result } = renderHook(() => usePagination());

    act(() => { result.current.setPage(10); });
    expect(result.current.page).toBe(10);

    act(() => { result.current.resetPage(); });
    expect(result.current.page).toBe(1);
  });

  it("onSetPage updates page", () => {
    const { result } = renderHook(() => usePagination());

    act(() => {
      result.current.onSetPage({} as React.MouseEvent, 7);
    });

    expect(result.current.page).toBe(7);
  });
});
