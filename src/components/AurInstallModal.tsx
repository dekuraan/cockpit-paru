import React, { useState, useRef, useCallback } from "react";
import {
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Alert,
} from "@patternfly/react-core";
import { aurInstall } from "../api";
import { useAutoScrollLog } from "../hooks/useAutoScrollLog";
import { LOG_CONTAINER_HEIGHT, STREAMING_TIMEOUT_SECS } from "../constants";

interface AurInstallModalProps {
  name: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const AurInstallModal: React.FC<AurInstallModalProps> = ({
  name,
  isOpen,
  onClose,
  onComplete,
}) => {
  const [log, setLog] = useState("");
  const [running, setRunning] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const logContainerRef = useAutoScrollLog(log);

  const handleStart = useCallback(() => {
    setLog("");
    setRunning(true);
    setSuccess(null);
    setErrorMsg(null);

    const { cancel } = aurInstall(
      {
        onData: (data) => setLog((prev) => prev + data),
        onComplete: () => {
          setRunning(false);
          setSuccess(true);
          onComplete?.();
        },
        onError: (err) => {
          setRunning(false);
          setSuccess(false);
          setErrorMsg(err);
        },
        timeout: STREAMING_TIMEOUT_SECS,
      },
      name
    );

    cancelRef.current = cancel;
  }, [name, onComplete]);

  const handleCancel = () => {
    cancelRef.current?.();
  };

  const handleClose = () => {
    if (running) {
      cancelRef.current?.();
    }
    onClose();
  };

  // Auto-start on open
  React.useEffect(() => {
    if (isOpen && !running && success === null) {
      handleStart();
    }
  }, [isOpen, running, success, handleStart]);

  return (
    <Modal
      variant={ModalVariant.large}
      isOpen={isOpen}
      onClose={handleClose}
    >
      <ModalHeader title={`Installing: ${name}`} />
      <ModalBody>
        {success === true && (
          <Alert variant="success" isInline title="Installation successful" style={{ marginBottom: "1rem" }} />
        )}
        {success === false && errorMsg && (
          <Alert variant="danger" isInline title="Installation failed" style={{ marginBottom: "1rem" }}>
            {errorMsg}
          </Alert>
        )}
        <div
          ref={logContainerRef}
          style={{
            height: LOG_CONTAINER_HEIGHT,
            overflowY: "auto",
            backgroundColor: "var(--pf-t--global--background--color--secondary--default)",
            padding: "1rem",
            fontFamily: "var(--pf-t--global--font--family--mono)",
            fontSize: "0.85rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            borderRadius: "var(--pf-t--global--border--radius--small)",
          }}
        >
          {log || (running ? "Starting paru...\n" : "")}
        </div>
      </ModalBody>
      <ModalFooter>
        {running && (
          <Button key="cancel" variant="danger" onClick={handleCancel}>
            Cancel
          </Button>
        )}
        {!running && (
          <Button key="close" variant="primary" onClick={handleClose}>
            Close
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
