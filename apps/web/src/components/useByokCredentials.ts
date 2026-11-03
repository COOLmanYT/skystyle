"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { byokSnapshot, writeByok, clearSavedByok, subscribeByok, emptyByokSnapshot, type ByokCredentials } from "@/lib/byok-storage";
import type { ByokProvider } from "@/lib/ai";
export default function useByokCredentials(userId: string) {
  const subscribe = useCallback((listener: () => void) => subscribeByok(userId, listener), [userId]);
  const snapshot = useSyncExternalStore(subscribe, () => byokSnapshot(userId), emptyByokSnapshot);
  const credentials = useMemo(() => JSON.parse(snapshot) as ByokCredentials, [snapshot]);
  return { ...credentials, setKey: (key: string) => writeByok(userId, { key }),
    setProvider: (provider: ByokProvider) => writeByok(userId, { provider }),
    setRemember: (remember: boolean) => writeByok(userId, { remember }), clear: () => clearSavedByok(userId) };
}
