import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { SortByDirection } from "@patternfly/react-table";
import { useSortableTable } from "./useSortableTable";

describe("useSortableTable (columns mode)", () => {
  const columns = { name: 1, repo: 2, size: 3 } as const;

  it("starts with no active sort", () => {
    const { result } = renderHook(() =>
      useSortableTable({ columns })
    );
    expect(result.current.activeSortKey).toBeNull();
    expect(result.current.activeSortIndex).toBeNull();
    expect(result.current.activeSortDirection).toBe("asc");
  });

  it("setActiveSortKey updates key and index", () => {
    const { result } = renderHook(() =>
      useSortableTable({ columns })
    );

    act(() => { result.current.setActiveSortKey("repo"); });
    expect(result.current.activeSortKey).toBe("repo");
    expect(result.current.activeSortIndex).toBe(2);
  });

  it("setActiveSortKey(null) clears sort", () => {
    const { result } = renderHook(() =>
      useSortableTable({ columns })
    );

    act(() => { result.current.setActiveSortKey("name"); });
    act(() => { result.current.setActiveSortKey(null); });
    expect(result.current.activeSortKey).toBeNull();
    expect(result.current.activeSortIndex).toBeNull();
  });

  it("getSortParams returns sort config for valid column", () => {
    const { result } = renderHook(() =>
      useSortableTable({ columns })
    );

    const params = result.current.getSortParams("name");
    expect(params).toBeDefined();
    expect(params?.columnIndex).toBe(1);
  });

  it("getSortParams returns undefined for unknown column", () => {
    const { result } = renderHook(() =>
      useSortableTable({ columns })
    );

    // @ts-expect-error testing invalid key
    const params = result.current.getSortParams("nonexistent");
    expect(params).toBeUndefined();
  });

  it("resetSort clears sort state", () => {
    const { result } = renderHook(() =>
      useSortableTable({ columns })
    );

    act(() => { result.current.setActiveSortKey("name"); });
    act(() => { result.current.setActiveSortDirection("desc"); });
    act(() => { result.current.resetSort(); });

    expect(result.current.activeSortKey).toBeNull();
    expect(result.current.activeSortDirection).toBe("asc");
  });

  it("calls onSort callback", () => {
    const onSort = vi.fn();
    const { result } = renderHook(() =>
      useSortableTable({ columns, onSort })
    );

    const params = result.current.getSortParams("name");
    // Simulate PF table sort click
    act(() => {
      params?.onSort?.({} as React.MouseEvent, 1, SortByDirection.desc, {} as any);
    });

    expect(onSort).toHaveBeenCalledWith("name", "desc");
  });
});

describe("useSortableTable (legacy mode)", () => {
  it("works with sortableColumns array", () => {
    const { result } = renderHook(() =>
      useSortableTable({ sortableColumns: [0, 1, 2] })
    );

    expect(result.current.activeSortIndex).toBeNull();

    const params = result.current.getSortParams(1);
    expect(params).toBeDefined();
    expect(params?.columnIndex).toBe(1);
  });
});
