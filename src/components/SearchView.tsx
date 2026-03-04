import React, { useState, useMemo, useEffect, useRef } from "react";
import { usePackageDetails } from "../hooks/usePackageDetails";
import { usePagination } from "../hooks/usePagination";
import { useSortableTable } from "../hooks/useSortableTable";
import {
  Card,
  CardBody,
  Alert,
  SearchInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Label,
  EmptyState,
  EmptyStateBody,
  Title,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectOption,
  SelectList,
  Pagination,
  ToggleGroup,
  ToggleGroupItem,
  Badge,
  Button,
  Spinner,
} from "@patternfly/react-core";
import { SearchIcon } from "@patternfly/react-icons";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { SearchResult, searchPackages, InstalledFilterType, AurPackage, aurSearch } from "../api";
import { sanitizeSearchInput } from "../utils";
import { PackageDetailsModal } from "./PackageDetailsModal";
import { AurPackageDetailsModal } from "./AurPackageDetailsModal";
import { AurSearchResults } from "./AurSearchResults";
import { TableLoadingOverlay } from "./TableLoadingOverlay";
import { PER_PAGE_OPTIONS, SEARCH_DEBOUNCE_MS, AUR_SEARCH_DEBOUNCE_MS } from "../constants";

const MIN_SEARCH_LENGTH = 1;
const AUR_MIN_SEARCH_LENGTH = 2;

type SearchSource = "repos" | "aur" | "both";

interface SearchViewProps {
  onViewDependencies?: (packageName: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onViewDependencies }) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aurResults, setAurResults] = useState<AurPackage[]>([]);
  const [aurTotal, setAurTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aurLoading, setAurLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aurError, setAurError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [currentQuery, setCurrentQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [repoFilter, setRepoFilter] = useState("all");
  const [repoSelectOpen, setRepoSelectOpen] = useState(false);
  const [installedFilter, setInstalledFilter] = useState<InstalledFilterType>("all");
  const [searchSource, setSearchSource] = useState<SearchSource>("repos");
  const [selectedAurPkg, setSelectedAurPkg] = useState<AurPackage | null>(null);
  const { selectedPackage, detailsLoading, detailsError, fetchDetails, clearDetails } = usePackageDetails();
  const { page, perPage, total, setPage, setPerPage, setTotal } = usePagination();
  const [totalInstalled, setTotalInstalled] = useState(0);
  const [totalNotInstalled, setTotalNotInstalled] = useState(0);
  const [repositories, setRepositories] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const currentQueryRef = useRef(currentQuery);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { activeSortIndex, activeSortDirection, setActiveSortIndex, setActiveSortDirection } = useSortableTable({
    sortableColumns: [0, 3, 4],
    defaultDirection: "asc",
  });

  const aurSort = useSortableTable({
    sortableColumns: [0, 1, 2],
    defaultDirection: "desc",
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const perPageRef = useRef(perPage);
  currentQueryRef.current = currentQuery;
  perPageRef.current = perPage;

  const getSortParams = (columnIndex: number) => {
    if (![0, 3, 4].includes(columnIndex)) return undefined;
    return {
      sortBy: {
        index: activeSortIndex ?? undefined,
        direction: activeSortDirection,
        defaultDirection: "asc" as const,
      },
      onSort: (_event: React.MouseEvent, index: number, direction: "asc" | "desc") => {
        setActiveSortIndex(index);
        setActiveSortDirection(direction);
        setPage(1);
        if (currentQuery) {
          fetchResults(currentQuery, 1, perPage, installedFilter, false, index, direction);
        }
      },
      columnIndex,
    };
  };

  // Debounced auto-search when input changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    abortControllerRef.current?.abort();

    const query = sanitizeSearchInput(searchInput);
    const minLen = searchSource === "repos" ? MIN_SEARCH_LENGTH : AUR_MIN_SEARCH_LENGTH;
    if (query.length < minLen) {
      return;
    }

    const debounceMs = searchSource === "aur" ? AUR_SEARCH_DEBOUNCE_MS : SEARCH_DEBOUNCE_MS;

    debounceRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();
      const currentController = abortControllerRef.current;

      if (query !== currentQueryRef.current) {
        if (!isMountedRef.current) return;
        setCurrentQuery(query);
        setHasSearched(true);
        setRepoFilter("all");
        setInstalledFilter("all");
        setPage(1);
        setActiveSortIndex(null);

        if (searchSource === "repos" || searchSource === "both") {
          setLoading(true);
          setError(null);
          try {
            const response = await searchPackages({
              query,
              offset: 0,
              limit: perPageRef.current,
              installed: "all",
            });
            if (currentController.signal.aborted) return;
            if (!isMountedRef.current) return;
            setResults(response.results);
            setTotal(response.total);
            setTotalInstalled(response.total_installed);
            setTotalNotInstalled(response.total_not_installed);
            setRepositories(response.repositories);
          } catch (ex) {
            if (currentController.signal.aborted) return;
            if (!isMountedRef.current) return;
            setError(ex instanceof Error ? ex.message : String(ex));
            setResults([]);
            setTotal(0);
          } finally {
            if (!currentController.signal.aborted && isMountedRef.current) {
              setLoading(false);
            }
          }
        }

        if ((searchSource === "aur" || searchSource === "both") && query.length >= AUR_MIN_SEARCH_LENGTH) {
          setAurLoading(true);
          setAurError(null);
          try {
            const response = await aurSearch({ query, offset: 0, limit: perPageRef.current });
            if (currentController.signal.aborted) return;
            if (!isMountedRef.current) return;
            setAurResults(response.results);
            setAurTotal(response.total);
          } catch (ex) {
            if (currentController.signal.aborted) return;
            if (!isMountedRef.current) return;
            setAurError(ex instanceof Error ? ex.message : String(ex));
            setAurResults([]);
            setAurTotal(0);
          } finally {
            if (!currentController.signal.aborted && isMountedRef.current) {
              setAurLoading(false);
            }
          }
        }
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, [searchInput, searchSource, setActiveSortIndex, setPage, setTotal]);

  const filteredResults = useMemo(() => {
    if (repoFilter === "all") return results;
    return results.filter((r: SearchResult) => r.repository === repoFilter);
  }, [results, repoFilter]);

  const getSortField = (index: number | null): string => {
    if (index === null) return "";
    switch (index) {
      case 0: return "name";
      case 3: return "repository";
      case 4: return "status";
      default: return "";
    }
  };

  const fetchResults = async (query: string, pageNum: number, pageSize: number, installed: InstalledFilterType, updateRepos = false, sortIdx: number | null = null, sortDirection: "asc" | "desc" = "asc") => {
    setLoading(true);
    setError(null);
    try {
      const offset = (pageNum - 1) * pageSize;
      const response = await searchPackages({
        query,
        offset,
        limit: pageSize,
        installed,
        sortBy: getSortField(sortIdx),
        sortDir: sortDirection,
      });
      if (!isMountedRef.current) return;
      setResults(response.results);
      setTotal(response.total);
      setTotalInstalled(response.total_installed);
      setTotalNotInstalled(response.total_not_installed);
      if (updateRepos) {
        setRepositories(response.repositories);
      }
    } catch (ex) {
      if (!isMountedRef.current) return;
      setError(ex instanceof Error ? ex.message : String(ex));
      setResults([]);
      setTotal(0);
      setTotalInstalled(0);
      setTotalNotInstalled(0);
      if (updateRepos) {
        setRepositories([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleSearch = async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const query = sanitizeSearchInput(searchInput);
    const minLen = searchSource === "repos" ? MIN_SEARCH_LENGTH : AUR_MIN_SEARCH_LENGTH;
    if (query.length < minLen) {
      setError(`Search query must be at least ${minLen} characters`);
      return;
    }

    setCurrentQuery(query);
    setHasSearched(true);
    setRepoFilter("all");
    setInstalledFilter("all");
    setPage(1);
    setActiveSortIndex(null);

    if (searchSource === "repos" || searchSource === "both") {
      await fetchResults(query, 1, perPage, "all", true);
    }

    if ((searchSource === "aur" || searchSource === "both") && query.length >= AUR_MIN_SEARCH_LENGTH) {
      setAurLoading(true);
      setAurError(null);
      try {
        const response = await aurSearch({ query, offset: 0, limit: perPage });
        if (!isMountedRef.current) return;
        setAurResults(response.results);
        setAurTotal(response.total);
      } catch (ex) {
        if (!isMountedRef.current) return;
        setAurError(ex instanceof Error ? ex.message : String(ex));
        setAurResults([]);
        setAurTotal(0);
      } finally {
        if (isMountedRef.current) {
          setAurLoading(false);
        }
      }
    }
  };

  const handleSearchClear = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setSearchInput("");
    setCurrentQuery("");
    setResults([]);
    setAurResults([]);
    setAurTotal(0);
    setError(null);
    setAurError(null);
    setHasSearched(false);
    setRepoFilter("all");
    setInstalledFilter("all");
    setPage(1);
    setTotal(0);
    setRepositories([]);
    setActiveSortIndex(null);
  };

  const handleSetPage = (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, newPage: number) => {
    setPage(newPage);
    if (currentQuery) {
      fetchResults(currentQuery, newPage, perPage, installedFilter, false, activeSortIndex, activeSortDirection);
    }
  };

  const handlePerPageSelect = (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
    if (currentQuery) {
      fetchResults(currentQuery, 1, newPerPage, installedFilter, false, activeSortIndex, activeSortDirection);
    }
  };

  const handleInstalledFilterChange = (value: InstalledFilterType) => {
    setInstalledFilter(value);
    setPage(1);
    if (currentQuery) {
      fetchResults(currentQuery, 1, perPage, value, false, activeSortIndex, activeSortDirection);
    }
  };

  const handleRowClick = (pkgName: string, repo: string) => {
    fetchDetails(pkgName, { strategy: "sync", repo });
  };

  const handleSourceChange = (source: SearchSource) => {
    setSearchSource(source);
    // Clear results when switching source
    setResults([]);
    setAurResults([]);
    setAurTotal(0);
    setError(null);
    setAurError(null);
    setHasSearched(false);
    setPage(1);
    setTotal(0);
    setRepositories([]);
    setActiveSortIndex(null);
    // Re-trigger search if there's input
    if (searchInput.length >= (source === "repos" ? MIN_SEARCH_LENGTH : AUR_MIN_SEARCH_LENGTH)) {
      setCurrentQuery(""); // Force re-search
    }
  };

  const handleAurSort = (_event: React.MouseEvent, index: number, direction: "asc" | "desc") => {
    aurSort.setActiveSortIndex(index);
    aurSort.setActiveSortDirection(direction);
  };

  const showRepoResults = searchSource === "repos" || searchSource === "both";
  const showAurResults = searchSource === "aur" || searchSource === "both";

  return (
    <Card>
      <CardBody>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <ToggleGroup aria-label="Search source">
                <ToggleGroupItem
                  text="Repositories"
                  isSelected={searchSource === "repos"}
                  onChange={() => handleSourceChange("repos")}
                />
                <ToggleGroupItem
                  text="AUR"
                  isSelected={searchSource === "aur"}
                  onChange={() => handleSourceChange("aur")}
                />
                <ToggleGroupItem
                  text="Both"
                  isSelected={searchSource === "both"}
                  onChange={() => handleSourceChange("both")}
                />
              </ToggleGroup>
            </ToolbarItem>
            <ToolbarItem>
              <SearchInput
                placeholder={searchSource === "aur" ? "Search AUR packages (min 2 chars)..." : "Search packages..."}
                value={searchInput}
                onChange={(_event: React.SyntheticEvent, value: string) => setSearchInput(value)}
                onClear={handleSearchClear}
                onSearch={handleSearch}
              />
            </ToolbarItem>
            {hasSearched && showRepoResults && (
              <ToolbarItem>
                <ToggleGroup aria-label="Installed filter">
                  <ToggleGroupItem
                    text={<>All <Badge isRead>{totalInstalled + totalNotInstalled}</Badge></>}
                    isSelected={installedFilter === "all"}
                    onChange={() => handleInstalledFilterChange("all")}
                  />
                  <ToggleGroupItem
                    text={<>Installed <Badge isRead>{totalInstalled}</Badge></>}
                    isSelected={installedFilter === "installed"}
                    onChange={() => handleInstalledFilterChange("installed")}
                  />
                  <ToggleGroupItem
                    text={<>Not installed <Badge isRead>{totalNotInstalled}</Badge></>}
                    isSelected={installedFilter === "not-installed"}
                    onChange={() => handleInstalledFilterChange("not-installed")}
                  />
                </ToggleGroup>
              </ToolbarItem>
            )}
            {repositories.length > 0 && showRepoResults && (
              <ToolbarItem>
                <Select
                  aria-label="Filter by repository"
                  isOpen={repoSelectOpen}
                  selected={repoFilter}
                  onSelect={(_event: React.MouseEvent | undefined, value: string | number | undefined) => {
                    setRepoFilter(value as string);
                    setRepoSelectOpen(false);
                  }}
                  onOpenChange={setRepoSelectOpen}
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={() => setRepoSelectOpen(!repoSelectOpen)}
                      isExpanded={repoSelectOpen}
                      aria-label="Filter by repository"
                    >
                      {repoFilter === "all" ? "All repositories" : repoFilter}
                    </MenuToggle>
                  )}
                >
                  <SelectList>
                    <SelectOption value="all">All repositories</SelectOption>
                    {repositories.map((repo: string) => (
                      <SelectOption key={repo} value={repo}>
                        {repo}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
              </ToolbarItem>
            )}
          </ToolbarContent>
        </Toolbar>

        {error && showRepoResults && (() => {
          const isLockError = error.toLowerCase().includes("unable to lock database");
          return (
            <Alert
              variant={isLockError ? "warning" : "danger"}
              title={isLockError ? "Database is locked" : "Repository search failed"}
              isInline
              className="pf-v6-u-mb-md"
            >
              {isLockError
                ? "Another package manager operation is in progress. Please wait for it to complete before searching."
                : error}
            </Alert>
          );
        })()}

        {aurError && showAurResults && (
          <Alert variant="danger" title="AUR search failed" isInline className="pf-v6-u-mb-md">
            {aurError}
          </Alert>
        )}

        {!hasSearched ? (
          <EmptyState titleText={<Title headingLevel="h3" size="lg">
              Search for packages
            </Title>} icon={SearchIcon}>
            <EmptyStateBody>
              {searchSource === "aur"
                ? "Enter a search term (min 2 characters) to find packages in the AUR."
                : searchSource === "both"
                ? "Enter a search term to search both repositories and AUR."
                : "Enter a search term to find packages available in the Arch Linux repositories."}
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <>
            {/* Repository results */}
            {showRepoResults && (
              <>
                {searchSource === "both" && (
                  <Title headingLevel="h3" size="lg" className="pf-v6-u-mb-md pf-v6-u-mt-md">
                    Repository Results ({total})
                  </Title>
                )}
                {loading && filteredResults.length === 0 ? (
                  <div className="pf-v6-u-p-xl pf-v6-u-text-align-center">
                    <Spinner /> Searching repositories...
                  </div>
                ) : filteredResults.length === 0 && !loading ? (
                  <EmptyState titleText={<Title headingLevel="h4" size="md">
                      No repository packages found
                    </Title>} icon={SearchIcon}>
                    <EmptyStateBody>
                      No packages matched your search in the repositories.
                    </EmptyStateBody>
                  </EmptyState>
                ) : (
                  <>
                    <Toolbar>
                      <ToolbarContent>
                        <ToolbarItem>
                          <span style={{ color: "var(--pf-t--global--text--color--subtle)" }}>
                            Found {total} package{total !== 1 ? "s" : ""}
                            {repoFilter !== "all" && ` (${filteredResults.length} in ${repoFilter})`}
                          </span>
                        </ToolbarItem>
                        <ToolbarItem variant="pagination" align={{ default: "alignEnd" }}>
                          <Pagination
                            itemCount={total}
                            perPage={perPage}
                            page={page}
                            onSetPage={handleSetPage}
                            onPerPageSelect={handlePerPageSelect}
                            perPageOptions={PER_PAGE_OPTIONS}
                            isCompact
                          />
                        </ToolbarItem>
                      </ToolbarContent>
                    </Toolbar>
                    <TableLoadingOverlay loading={loading}>
                      <Table aria-label="Search results" variant="compact">
                        <Thead>
                          <Tr>
                            <Th sort={getSortParams(0)}>Name</Th>
                            <Th>Version</Th>
                            <Th>Description</Th>
                            <Th sort={getSortParams(3)}>Repository</Th>
                            <Th sort={getSortParams(4)}>Status</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {filteredResults.map((pkg: SearchResult) => (
                            <Tr
                              key={`${pkg.repository}/${pkg.name}`}
                              isClickable
                              onRowClick={() => handleRowClick(pkg.name, pkg.repository)}
                            >
                              <Td dataLabel="Name">
                                <Button variant="link" isInline className="pf-v6-u-p-0">
                                  {pkg.name}
                                </Button>
                              </Td>
                              <Td dataLabel="Version">{pkg.version}</Td>
                              <Td dataLabel="Description">{pkg.description || "-"}</Td>
                              <Td dataLabel="Repository">
                                <Label color="blue">{pkg.repository}</Label>
                              </Td>
                              <Td dataLabel="Status">
                                {pkg.installed ? (
                                  <Label color="green">
                                    Installed{pkg.installed_version !== pkg.version ? ` (${pkg.installed_version})` : ""}
                                  </Label>
                                ) : (
                                  <Label color="grey">Not installed</Label>
                                )}
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableLoadingOverlay>
                    <Toolbar>
                      <ToolbarContent>
                        <ToolbarItem variant="pagination" align={{ default: "alignEnd" }}>
                          <Pagination
                            itemCount={total}
                            perPage={perPage}
                            page={page}
                            onSetPage={handleSetPage}
                            onPerPageSelect={handlePerPageSelect}
                            perPageOptions={PER_PAGE_OPTIONS}
                            isCompact
                          />
                        </ToolbarItem>
                      </ToolbarContent>
                    </Toolbar>
                  </>
                )}
              </>
            )}

            {/* AUR results */}
            {showAurResults && (
              <>
                {searchSource === "both" && (
                  <Title headingLevel="h3" size="lg" className="pf-v6-u-mb-md pf-v6-u-mt-lg">
                    AUR Results ({aurTotal})
                  </Title>
                )}
                {aurLoading && aurResults.length === 0 ? (
                  <div className="pf-v6-u-p-xl pf-v6-u-text-align-center">
                    <Spinner /> Searching AUR...
                  </div>
                ) : aurResults.length === 0 && !aurLoading ? (
                  <EmptyState titleText={<Title headingLevel="h4" size="md">
                      No AUR packages found
                    </Title>} icon={SearchIcon}>
                    <EmptyStateBody>
                      No packages matched your search in the AUR.
                      {currentQuery.length < AUR_MIN_SEARCH_LENGTH && " AUR search requires at least 2 characters."}
                    </EmptyStateBody>
                  </EmptyState>
                ) : (
                  <TableLoadingOverlay loading={aurLoading}>
                    <AurSearchResults
                      results={aurResults}
                      onSelect={(pkg) => setSelectedAurPkg(pkg)}
                      activeSortIndex={aurSort.activeSortIndex}
                      activeSortDirection={aurSort.activeSortDirection}
                      onSort={handleAurSort}
                    />
                  </TableLoadingOverlay>
                )}
              </>
            )}
          </>
        )}

        <PackageDetailsModal
          packageDetails={selectedPackage}
          isLoading={detailsLoading}
          onClose={clearDetails}
          error={detailsError}
          onViewDependencies={onViewDependencies}
        />

        {selectedAurPkg && (
          <AurPackageDetailsModal
            pkg={selectedAurPkg}
            isOpen={!!selectedAurPkg}
            onClose={() => setSelectedAurPkg(null)}
            onInstalled={() => {
              // Refresh search results after install
              if (currentQuery) {
                handleSearch();
              }
            }}
          />
        )}
      </CardBody>
    </Card>
  );
};
