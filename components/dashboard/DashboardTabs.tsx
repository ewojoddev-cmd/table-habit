"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import LeaderboardPanel from "@/components/dashboard/LeaderboardPanel";
import ToDoListPanel from "@/components/dashboard/ToDoListPanel";
import TrackTableHabitsPanel from "@/components/dashboard/TrackTableHabitsPanel";
import TrackYourHabitsPanel from "@/components/dashboard/TrackYourHabitsPanel";

type Tab = {
  /** Stable id, used for the tab/panel pairing (`tab-<id>` / `panel-<id>`). */
  id: string;
  label: string;
  Panel: () => React.JSX.Element;
};

/** Tab order and labels. New tabs only need an entry here plus a panel file. */
const TABS: readonly Tab[] = [
  {
    id: "track-your-habits",
    label: "Track Your Habits",
    Panel: TrackYourHabitsPanel,
  },
  {
    id: "track-table-habits",
    label: "Track Table Habits",
    Panel: TrackTableHabitsPanel,
  },
  { id: "leaderboard", label: "Leaderboard", Panel: LeaderboardPanel },
  { id: "to-do-list", label: "To Do List", Panel: ToDoListPanel },
];

const DEFAULT_TAB_ID = "track-your-habits";

/**
 * The dashboard's section switcher: rounded box tabs at the top, one panel
 * below. Follows the ARIA tabs pattern — click to select, arrow keys /
 * Home / End to move selection, and only the active panel stays in the DOM.
 */
export default function DashboardTabs() {
  const [activeId, setActiveId] = useState(DEFAULT_TAB_ID);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeTab =
    TABS.find((tab) => tab.id === activeId) ??
    TABS.find((tab) => tab.id === DEFAULT_TAB_ID) ??
    TABS[0];
  const ActivePanel = activeTab.Panel;

  function selectTab(index: number) {
    const next = TABS[(index + TABS.length) % TABS.length];
    setActiveId(next.id);
    tabRefs.current[next.id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        selectTab(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        selectTab(index - 1);
        break;
      case "Home":
        event.preventDefault();
        selectTab(0);
        break;
      case "End":
        event.preventDefault();
        selectTab(TABS.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div
        role="tablist"
        aria-label="Dashboard sections"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {TABS.map((tab, index) => {
          const selected = tab.id === activeTab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-th-sky ${
                selected
                  ? "border-th-mariner bg-white text-th-prussian shadow-[0_10px_24px_-18px_rgba(0,31,77,0.9)]"
                  : "border-th-haze bg-white/50 text-th-orient/80 hover:bg-white hover:border-th-sky hover:text-th-cerulean"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <section
        key={activeTab.id}
        id={`panel-${activeTab.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab.id}`}
        tabIndex={0}
        className="mt-5 rounded-xl border border-th-haze bg-white/70 p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-th-sky"
      >
        <ActivePanel />
      </section>
    </div>
  );
}
