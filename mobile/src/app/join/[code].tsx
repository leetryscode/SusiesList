import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { setPendingInviteCode } from "../../lib/pending-invite";

export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!code) {
      setIsReady(true);
      return;
    }
    setPendingInviteCode(code).then(() => setIsReady(true));
  }, [code]);

  if (!isReady) return null;

  return <Redirect href="/" />;
}
