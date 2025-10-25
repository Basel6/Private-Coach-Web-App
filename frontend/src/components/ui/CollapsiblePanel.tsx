// src/components/ui/CollapsiblePanel.tsx
import * as React from "react";

type Props = React.PropsWithChildren<{
  title: string;
  count?: number;
  defaultOpen?: boolean;
  panelId?: string;
}>;

export default function CollapsiblePanel({
  title,
  count,
  defaultOpen = true,
  panelId,
  children,
}: Props) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = panelId ?? `panel-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-slate-900">{title}</span>
          {typeof count === "number" && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {count}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={id}
          className="group inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] rounded-md px-2 py-1"
        >
          <span className="select-none">{open ? "Hide" : "Show"}</span>
          {/* Fixed-size chevron, never grows because of shrink-0 and fixed w/h */}
          <svg
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {open && (
        <div id={id} role="region" className="border-t border-slate-100 px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
