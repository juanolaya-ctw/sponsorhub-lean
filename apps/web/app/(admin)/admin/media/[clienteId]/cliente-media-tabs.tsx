"use client";

import { useState, type ReactNode } from "react";
import { cn } from "cn";

type TabId = "assets" | "topups" | "timeline";

export function ClienteMediaTabs({
  assets,
  topups,
  timeline,
  assetsCount,
  topupsCount,
}: {
  assets: ReactNode;
  topups: ReactNode;
  timeline: ReactNode;
  assetsCount: number;
  topupsCount: number;
}) {
  const [tab, setTab] = useState<TabId>("assets");

  const tabs: { id: TabId; label: string }[] = [
    { id: "assets", label: `Assets (${assetsCount})` },
    { id: "topups", label: `Top-ups (${topupsCount})` },
    { id: "timeline", label: "Timeline" },
  ];

  const content =
    tab === "assets" ? assets : tab === "topups" ? topups : timeline;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div key={tab}>{content}</div>
    </div>
  );
}
