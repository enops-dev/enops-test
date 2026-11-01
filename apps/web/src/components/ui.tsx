import type { ReactNode } from "react";
import type { Priority, Status } from "../types";
import { initials, priorityLabel, statusLabel } from "../lib/format";

export function Avatar({
  name,
  color = "stone",
  small = false,
}: {
  name: string | null;
  color?: string | null;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar${small ? " avatar-small" : ""}`}
      data-color={color ?? "stone"}
      title={name ?? "Unassigned"}
    >
      {initials(name)}
    </span>
  );
}

export function ProjectDot({ color }: { color: string }) {
  return <span className="project-dot" data-color={color} aria-hidden="true" />;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className="priority-badge" data-priority={priority}>
      {priorityLabel(priority)}
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="status-pill" data-status={status}>
      <span className="status-dot" data-status={status} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      <p className="empty-detail">{detail}</p>
      {action}
    </div>
  );
}

export function ErrorNote({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-note" role="alert">
      <div>
        <strong>Something went wrong.</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
