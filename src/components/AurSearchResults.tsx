import React from "react";
import {
  Label,
  Tooltip,
} from "@patternfly/react-core";
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  ThProps,
} from "@patternfly/react-table";
import { OutlinedStarIcon, ExclamationTriangleIcon } from "@patternfly/react-icons";
import type { AurPackage } from "../api";
import { formatDate } from "../api";

interface AurSearchResultsProps {
  results: AurPackage[];
  onSelect: (pkg: AurPackage) => void;
  activeSortIndex: number | null;
  activeSortDirection: "asc" | "desc";
  onSort: (event: React.MouseEvent, index: number, direction: "asc" | "desc") => void;
}

export const AurSearchResults: React.FC<AurSearchResultsProps> = ({
  results,
  onSelect,
  activeSortIndex,
  activeSortDirection,
  onSort,
}) => {
  const getSortParams = (columnIndex: number): ThProps["sort"] => ({
    sortBy: {
      index: activeSortIndex ?? undefined,
      direction: activeSortDirection,
    },
    onSort,
    columnIndex,
  });

  return (
    <Table aria-label="AUR search results" variant="compact">
      <Thead>
        <Tr>
          <Th sort={getSortParams(0)}>Name</Th>
          <Th>Version</Th>
          <Th>Description</Th>
          <Th sort={getSortParams(1)}>Votes</Th>
          <Th sort={getSortParams(2)}>Popularity</Th>
          <Th>Maintainer</Th>
          <Th>Status</Th>
        </Tr>
      </Thead>
      <Tbody>
        {results.map((pkg) => (
          <Tr
            key={pkg.name}
            isClickable
            onRowClick={() => onSelect(pkg)}
          >
            <Td dataLabel="Name">
              {pkg.name}
              {pkg.out_of_date != null && (
                <Tooltip content={`Flagged out of date: ${formatDate(pkg.out_of_date)}`}>
                  <ExclamationTriangleIcon style={{ color: "var(--pf-t--global--color--status--warning--default)", marginLeft: "0.5rem" }} />
                </Tooltip>
              )}
            </Td>
            <Td dataLabel="Version">{pkg.version}</Td>
            <Td dataLabel="Description">{pkg.description || "—"}</Td>
            <Td dataLabel="Votes">
              <OutlinedStarIcon style={{ marginRight: "0.25rem" }} />
              {pkg.votes}
            </Td>
            <Td dataLabel="Popularity">{pkg.popularity.toFixed(2)}</Td>
            <Td dataLabel="Maintainer">{pkg.maintainer || <Label color="orange">Orphaned</Label>}</Td>
            <Td dataLabel="Status">
              {pkg.installed ? (
                <Label color="green">Installed {pkg.installed_version}</Label>
              ) : (
                <Label color="grey">Not installed</Label>
              )}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};
