import type { ReactNode } from "react";
import { AlertTriangle, Check, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstadoSync } from "@/lib/surco-data";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)] gap-4 border-b border-border pb-5 sm:flex sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="label-field">{eyebrow}</p>
        <h1 className="mt-1 truncate text-2xl sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <p className="label-field truncate">{children}</p>
      {aside ? <div className="shrink-0 text-xs text-muted-foreground">{aside}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: "default" | "warn" | "ok" | "danger";
}) {
  const toneRing = {
    default: "border-border",
    warn: "border-warn/60",
    ok: "border-ok/50",
    danger: "border-destructive/50",
  }[tone];
  const toneText = {
    default: "text-foreground",
    warn: "text-warn",
    ok: "text-ok",
    danger: "text-destructive",
  }[tone];

  return (
    <div className={cn("rounded-md border bg-card p-4", toneRing)}>
      <p className="label-field truncate">{label}</p>
      <p className={cn("num mt-2 text-2xl leading-none sm:text-3xl", toneText)}>
        {value}
        {unit ? <span className="ml-1 text-sm text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SyncBadge({ estado }: { estado: EstadoSync }) {
  const map = {
    sincronizado: { icon: Check, text: "Sincronizado", cls: "border-ok/40 text-ok" },
    pendiente: { icon: CloudOff, text: "En cola", cls: "border-warn/50 text-warn" },
    conflicto: { icon: AlertTriangle, text: "Conflicto", cls: "border-destructive/50 text-destructive" },
  }[estado];
  const Icon = map.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold",
        map.cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {map.text}
    </span>
  );
}

export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ink" | "warn" | "ok" | "danger" | "field";
}) {
  const cls = {
    neutral: "bg-secondary text-secondary-foreground",
    ink: "bg-surface-ink text-surface-ink-foreground",
    warn: "bg-warn text-warn-foreground",
    ok: "bg-ok text-ok-foreground",
    danger: "bg-destructive text-destructive-foreground",
    field: "bg-field text-field-foreground",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        cls,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function SyncSpinner() {
  return <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
}
