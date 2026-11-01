import type { Activity } from "../types";
import { formatDate, formatRelative, parseDate } from "../lib/format";
import { Avatar, EmptyState, ErrorNote } from "./ui";

const ACTION_LABELS: Record<string, string> = {
  "task.created": "Created",
  "task.moved": "Moved",
  "task.updated": "Updated",
  "task.deleted": "Deleted",
  "comment.added": "Comment",
  "project.created": "Project",
  "project.updated": "Project",
};

export function ActivityView({
  activity,
  loading,
  error,
  onRetry,
}: {
  activity: Activity[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return <ErrorNote message={error} onRetry={onRetry} />;
  }

  if (loading && activity.length === 0) {
    return (
      <div className="activity-list">
        {[0, 1, 2, 3].map((index) => (
          <div className="activity-row" key={index} aria-hidden="true">
            <div className="skeleton-avatar" />
            <div>
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-short" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        detail="Create a project or move a task and it will show up here."
      />
    );
  }

  const groups: Array<{ label: string; items: Activity[] }> = [];
  for (const item of activity) {
    const label = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return (
    <div className="activity-wrap">
      {groups.map((group) => (
        <section className="activity-group" key={group.label}>
          <h2 className="activity-day">{group.label}</h2>
          <div className="activity-list">
            {group.items.map((item) => (
              <article className="activity-row" key={item.id}>
                <Avatar name={item.actorName} color={item.actorColor} />
                <div className="activity-copy">
                  <p className="activity-detail">{item.detail}</p>
                  <p className="activity-meta">
                    {item.projectName ?? "Taskline"}
                    {item.taskTitle ? ` · ${item.taskTitle}` : ""}
                    {" · "}
                    <span title={formatRelative(item.createdAt)}>
                      {formatRelative(item.createdAt)}
                    </span>
                  </p>
                </div>
                <span className="activity-action">
                  {ACTION_LABELS[item.action] ?? "Activity"}
                </span>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function dayLabel(value: string): string {
  const date = parseDate(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return formatDate(value);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
