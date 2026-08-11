import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { usePendingInvite } from "../../context/pending-invite-context";

export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { setPendingCode } = usePendingInvite();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (code) setPendingCode(code);
    setIsReady(true);
  }, [code, setPendingCode]);

  if (!isReady) return null;

  return <Redirect href="/" />;
}
