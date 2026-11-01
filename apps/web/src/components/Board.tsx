import { useState } from "react";
import type { Status, Task } from "../types";
import { isOverdue, statusLabel } from "../lib/format";
import { CalendarIcon, CommentIcon, PlusIcon } from "./icons";
import { Avatar, PriorityBadge } from "./ui";

const COLUMNS: Array<{ status: Status; label: string; hint: string }> = [
  { status: "todo", label: "To do", hint: "Ready to pick up" },
  { status: "in_progress", label: "In progress", hint: "Being worked on" },
  { status: "done", label: "Done", hint: "Shipped and verified" },
];

export function Board({
  tasks,
  loading,
  onOpenTask,
  onMoveTask,
  onAddTask,
}: {
  tasks: Task[];
  loading: boolean;
  onOpenTask: (id: string) => void;
  onMoveTask: (id: string, status: Status) => void;
  onAddTask: (status: Status) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<Status | null>(null);

  return (
    <div className="board">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);

        return (
          <section
            key={column.status}
            className="board-column"
            data-over={overColumn === column.status}
            onDragOver={(event) => {
              event.preventDefault();
              setOverColumn(column.status);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain");
              setOverColumn(null);
              setDraggingId(null);
              if (id) onMoveTask(id, column.status);
            }}
          >
            <header className="column-head">
              <div className="column-title">
                <span className="status-dot" data-status={column.status} aria-hidden="true" />
                <strong>{column.label}</strong>
                <span className="column-count">{columnTasks.length}</span>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Add a task to ${column.label}`}
                title={`Add a task to ${column.label}`}
                onClick={() => onAddTask(column.status)}
              >
                <PlusIcon />
              </button>
            </header>
            <p className="column-hint">{column.hint}</p>

            <div className="column-cards">
              {loading && columnTasks.length === 0
                ? [0, 1].map((index) => (
                    <div className="skeleton-card" key={index} aria-hidden="true" />
                  ))
                : null}

              {columnTasks.map((task) => (
                <article
                  key={task.id}
                  className="task-card"
                  data-priority={task.priority}
                  data-dragging={draggingId === task.id}
                  draggable
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenTask(task.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenTask(task.id);
                    }
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", task.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDraggingId(task.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverColumn(null);
                  }}
                >
                  <div className="task-card-top">
                    <PriorityBadge priority={task.priority} />
                    {task.commentCount > 0 ? (
                      <span className="task-comment-count" title={`${task.commentCount} comments`}>
                        <CommentIcon size={13} />
                        {task.commentCount}
                      </span>
                    ) : null}
                  </div>

                  <h3>{task.title}</h3>
                  {task.description ? <p className="task-snippet">{task.description}</p> : null}

                  <footer className="task-card-foot">
                    {task.assigneeName ? (
                      <span className="task-assignee">
                        <Avatar name={task.assigneeName} color={task.assigneeColor} small />
                        {task.assigneeName}
                      </span>
                    ) : (
                      <span className="task-unassigned">Unassigned</span>
                    )}

                    {task.dueDate ? (
                      <span
                        className="task-due"
                        data-overdue={isOverdue(task.dueDate) && task.status !== "done"}
                      >
                        <CalendarIcon size={12} />
                        {formatDue(task.dueDate)}
                        {isOverdue(task.dueDate) && task.status !== "done" ? " · overdue" : ""}
                      </span>
                    ) : null}
                  </footer>
                </article>
              ))}

              {!loading && columnTasks.length === 0 ? (
                <button
                  type="button"
                  className="column-empty"
                  onClick={() => onAddTask(column.status)}
                >
                  <PlusIcon size={14} />
                  Add the first {statusLabel(column.status).toLowerCase()} task
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function formatDue(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}
