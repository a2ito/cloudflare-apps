"use client";

import { useEffect } from "react";
import {
  loadRecentGroups,
  rememberGroup,
  saveRecentGroups,
} from "@/lib/recent-groups";

/** 開いたグループを、トップの「最近のグループ」に出すために端末へ覚えておく */
export function RememberGroup({ id, name }: { id: string; name: string }) {
  useEffect(() => {
    saveRecentGroups(
      rememberGroup(loadRecentGroups(), { id, name, visitedAt: Date.now() }),
    );
  }, [id, name]);

  return null;
}
