import { useEffect, useState } from "react";
import type { Manifest } from "@shared/types";
import { fetchCompanions } from "../api";

export function useCompanions(): { companions: Manifest[]; loading: boolean } {
  const [companions, setCompanions] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchCompanions().then((m) => {
      setCompanions(m);
      setLoading(false);
    });
  }, []);
  return { companions, loading };
}
