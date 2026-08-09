import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { setPendingInviteCode } from "../../lib/pending-invite";

export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [isStashed, setIsStashed] = useState(false);

  useEffect(() => {
    if (!code) return;
    setPendingInviteCode(code).then(() => setIsStashed(true));
  }, [code]);

  if (!isStashed) return null;

  return <Redirect href="/" />;
}
