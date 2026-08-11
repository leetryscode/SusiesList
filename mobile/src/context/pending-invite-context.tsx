import {
  createContext,
  use,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import {
  clearPendingInviteCode,
  getPendingInviteCode,
  setPendingInviteCode,
} from "../lib/pending-invite";

type PendingInviteContextValue = {
  pendingCode: string | null;
  isLoading: boolean;
  setPendingCode: (code: string) => void;
  clearPendingCode: () => void;
};

const PendingInviteContext = createContext<PendingInviteContextValue | null>(
  null
);

export function usePendingInvite() {
  const value = use(PendingInviteContext);
  if (!value) {
    throw new Error(
      "usePendingInvite must be used within a PendingInviteProvider"
    );
  }
  return value;
}

/** Holds the deep-link-stashed invite code in memory (so a warm-app tap on
 * susieslist://join/CODE is picked up immediately, not just on cold start)
 * while still persisting it to AsyncStorage so it survives a relaunch. */
export function PendingInviteProvider({ children }: PropsWithChildren) {
  const [pendingCode, setPendingCodeState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getPendingInviteCode().then((code) => {
      setPendingCodeState(code);
      setIsLoading(false);
    });
  }, []);

  function setPendingCode(code: string) {
    setPendingCodeState(code);
    setPendingInviteCode(code);
  }

  function clearPendingCode() {
    setPendingCodeState(null);
    clearPendingInviteCode();
  }

  return (
    <PendingInviteContext
      value={{ pendingCode, isLoading, setPendingCode, clearPendingCode }}
    >
      {children}
    </PendingInviteContext>
  );
}
