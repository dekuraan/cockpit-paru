import React, { useState } from "react";
import {
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Label,
  Flex,
  FlexItem,
  Alert,
  Spinner,
} from "@patternfly/react-core";
import { ExternalLinkAltIcon, CodeIcon } from "@patternfly/react-icons";
import type { AurPackage } from "../api";
import { formatDate, aurGetPkgbuild } from "../api";
import { AUR_BASE_URL } from "../constants";
import { PkgbuildReviewModal } from "./PkgbuildReviewModal";
import { AurInstallModal } from "./AurInstallModal";

interface AurPackageDetailsModalProps {
  pkg: AurPackage;
  isOpen: boolean;
  onClose: () => void;
  onInstalled?: () => void;
}

export const AurPackageDetailsModal: React.FC<AurPackageDetailsModalProps> = ({
  pkg,
  isOpen,
  onClose,
  onInstalled,
}) => {
  const [showPkgbuild, setShowPkgbuild] = useState(false);
  const [pkgbuildContent, setPkgbuildContent] = useState<string | null>(null);
  const [pkgbuildLoading, setPkgbuildLoading] = useState(false);
  const [pkgbuildError, setPkgbuildError] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  const handleViewPkgbuild = async () => {
    setPkgbuildLoading(true);
    setPkgbuildError(null);
    try {
      const resp = await aurGetPkgbuild(pkg.name);
      setPkgbuildContent(resp.pkgbuild);
      setShowPkgbuild(true);
    } catch (e) {
      setPkgbuildError(e instanceof Error ? e.message : String(e));
    } finally {
      setPkgbuildLoading(false);
    }
  };

  const handleInstallFromPkgbuild = () => {
    setShowPkgbuild(false);
    setShowInstall(true);
  };

  const handleInstallComplete = () => {
    setShowInstall(false);
    onInstalled?.();
    onClose();
  };

  const aurUrl = `${AUR_BASE_URL}/packages/${pkg.name}`;

  return (
    <>
      <Modal
        variant={ModalVariant.large}
        isOpen={isOpen && !showPkgbuild && !showInstall}
        onClose={onClose}
      >
        <ModalHeader title={`AUR: ${pkg.name}`} />
        <ModalBody>
          {pkgbuildError && (
            <Alert variant="danger" isInline title="Failed to fetch PKGBUILD" style={{ marginBottom: "1rem" }}>
              {pkgbuildError}
            </Alert>
          )}

          {pkgbuildLoading && <Spinner size="md" />}

          <DescriptionList isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>Name</DescriptionListTerm>
              <DescriptionListDescription>{pkg.name}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Version</DescriptionListTerm>
              <DescriptionListDescription>
                {pkg.version}
                {pkg.out_of_date != null && (
                  <Label color="orange" style={{ marginLeft: "0.5rem" }}>
                    Out of date since {formatDate(pkg.out_of_date)}
                  </Label>
                )}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Description</DescriptionListTerm>
              <DescriptionListDescription>{pkg.description || "—"}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Maintainer</DescriptionListTerm>
              <DescriptionListDescription>
                {pkg.maintainer || <Label color="orange">Orphaned</Label>}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Votes / Popularity</DescriptionListTerm>
              <DescriptionListDescription>
                <Flex>
                  <FlexItem>{pkg.votes} votes</FlexItem>
                  <FlexItem>{pkg.popularity.toFixed(4)} popularity</FlexItem>
                </Flex>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Package Base</DescriptionListTerm>
              <DescriptionListDescription>{pkg.package_base || pkg.name}</DescriptionListDescription>
            </DescriptionListGroup>
            {pkg.url && (
              <DescriptionListGroup>
                <DescriptionListTerm>Upstream URL</DescriptionListTerm>
                <DescriptionListDescription>
                  <a href={pkg.url} target="_blank" rel="noopener noreferrer">
                    {pkg.url} <ExternalLinkAltIcon />
                  </a>
                </DescriptionListDescription>
              </DescriptionListGroup>
            )}
            <DescriptionListGroup>
              <DescriptionListTerm>AUR Page</DescriptionListTerm>
              <DescriptionListDescription>
                <a href={aurUrl} target="_blank" rel="noopener noreferrer">
                  {aurUrl} <ExternalLinkAltIcon />
                </a>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>First Submitted</DescriptionListTerm>
              <DescriptionListDescription>{formatDate(pkg.first_submitted)}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Last Modified</DescriptionListTerm>
              <DescriptionListDescription>{formatDate(pkg.last_modified)}</DescriptionListDescription>
            </DescriptionListGroup>
            {pkg.depends.length > 0 && (
              <DescriptionListGroup>
                <DescriptionListTerm>Dependencies</DescriptionListTerm>
                <DescriptionListDescription>{pkg.depends.join(", ")}</DescriptionListDescription>
              </DescriptionListGroup>
            )}
            {pkg.makedepends.length > 0 && (
              <DescriptionListGroup>
                <DescriptionListTerm>Make Dependencies</DescriptionListTerm>
                <DescriptionListDescription>{pkg.makedepends.join(", ")}</DescriptionListDescription>
              </DescriptionListGroup>
            )}
            {pkg.installed && (
              <DescriptionListGroup>
                <DescriptionListTerm>Installed Version</DescriptionListTerm>
                <DescriptionListDescription>
                  <Label color="green">{pkg.installed_version}</Label>
                </DescriptionListDescription>
              </DescriptionListGroup>
            )}
          </DescriptionList>
        </ModalBody>
        <ModalFooter>
          <Button
            key="pkgbuild"
            variant="secondary"
            icon={<CodeIcon />}
            onClick={handleViewPkgbuild}
            isLoading={pkgbuildLoading}
            isDisabled={pkgbuildLoading}
          >
            View PKGBUILD
          </Button>
          {!pkg.installed && (
            <Button
              key="install"
              variant="primary"
              onClick={() => setShowInstall(true)}
            >
              Install
            </Button>
          )}
          <Button key="close" variant="link" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {showPkgbuild && pkgbuildContent && (
        <PkgbuildReviewModal
          name={pkg.name}
          pkgbuild={pkgbuildContent}
          isOpen={showPkgbuild}
          onClose={() => setShowPkgbuild(false)}
          onConfirmInstall={handleInstallFromPkgbuild}
        />
      )}

      {showInstall && (
        <AurInstallModal
          name={pkg.name}
          isOpen={showInstall}
          onClose={() => setShowInstall(false)}
          onComplete={handleInstallComplete}
        />
      )}
    </>
  );
};
