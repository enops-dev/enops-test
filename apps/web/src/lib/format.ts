import type { Priority, Status } from "../types";

function parse(value: string): Date {
  if (value.includes("T")) return new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  return new Date(`${value.replace(" ", "T")}Z`);
}

export function parseDate(value: string): Date {
  return parse(value);
}

export function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(parse(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parse(value));
}

export function formatRelative(value: string): string {
  const date = parse(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;

  return formatDate(value);
}

export function isOverdue(value: string | null): boolean {
  if (!value) return false;
  return value < new Date().toISOString().slice(0, 10);
}

export function statusLabel(status: Status): string {
  if (status === "todo") return "To do";
  if (status === "in_progress") return "In progress";
  return "Done";
}

export function priorityLabel(priority: Priority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}
