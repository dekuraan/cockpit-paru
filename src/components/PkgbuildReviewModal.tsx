import React from "react";
import {
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Alert,
  CodeBlock,
  CodeBlockCode,
} from "@patternfly/react-core";

interface PkgbuildReviewModalProps {
  name: string;
  pkgbuild: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirmInstall: () => void;
}

export const PkgbuildReviewModal: React.FC<PkgbuildReviewModalProps> = ({
  name,
  pkgbuild,
  isOpen,
  onClose,
  onConfirmInstall,
}) => {
  return (
    <Modal
      variant={ModalVariant.large}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalHeader title={`PKGBUILD: ${name}`} />
      <ModalBody>
        <Alert
          variant="warning"
          isInline
          title="Security Warning"
          style={{ marginBottom: "1rem" }}
        >
          AUR packages are user-contributed and not officially supported. Review the PKGBUILD
          carefully before installing. Malicious PKGBUILDs can execute arbitrary code on your system.
        </Alert>
        <CodeBlock>
          <CodeBlockCode>{pkgbuild}</CodeBlockCode>
        </CodeBlock>
      </ModalBody>
      <ModalFooter>
        <Button key="install" variant="primary" onClick={onConfirmInstall}>
          Confirm &amp; Install
        </Button>
        <Button key="cancel" variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
