import { useState, useCallback } from "react";
import type { AurPackage } from "../api";
import { aurInfo } from "../api";

export function useAurPackageDetails() {
  const [aurDetails, setAurDetails] = useState<AurPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAurDetails = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const info = await aurInfo(name);
      setAurDetails(info);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAurDetails = useCallback(() => {
    setAurDetails(null);
    setError(null);
  }, []);

  return { aurDetails, loading, error, fetchAurDetails, clearAurDetails };
}
