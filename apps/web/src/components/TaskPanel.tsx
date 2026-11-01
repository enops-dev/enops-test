import { useEffect, useState } from "react";
import { api, type TaskInput } from "../api";
import type { Member, TaskDetail } from "../types";
import { formatDateTime, formatRelative, statusLabel } from "../lib/format";
import { CalendarIcon, CloseIcon, CommentIcon, TrashIcon } from "./icons";
import { Avatar, ErrorNote, StatusPill } from "./ui";

const STATUSES = ["todo", "in_progress", "done"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export function TaskPanel({
  taskId,
  projectName,
  members,
  onClose,
  onChanged,
  onDeleted,
  onToast,
}: {
  taskId: string;
  projectName: string;
  members: Member[];
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
  onToast: (message: string, tone?: "ok" | "error") => void;
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentAuthorId, setCommentAuthorId] = useState(members[0]?.id ?? "");
  const [postingComment, setPostingComment] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setConfirmingDelete(false);

    api
      .task(taskId)
      .then((task) => {
        if (cancelled) return;
        setDetail(task);
        setTitle(task.title);
        setDescription(task.description);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load the task.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  async function patch(input: TaskInput, message?: string) {
    if (!detail) return;
    const previous = detail;
    setDetail({ ...detail, ...input });
    try {
      const updated = await api.updateTask(detail.id, input);
      setDetail((current) => (current ? { ...current, ...updated } : current));
      onChanged();
      if (message) onToast(message);
    } catch (patchError) {
      setDetail(previous);
      onToast(
        patchError instanceof Error ? patchError.message : "Could not save the change.",
        "error",
      );
    }
  }

  function saveTitle() {
    if (!detail) return;
    const next = title.trim();
    if (!next) {
      setTitle(detail.title);
      return;
    }
    if (next === detail.title) return;
    setTitle(next);
    void patch({ title: next }, "Title saved.");
  }

  function saveDescription() {
    if (!detail) return;
    if (description === detail.description) return;
    void patch({ description }, "Description saved.");
  }

  async function addComment() {
    if (!detail || !commentBody.trim()) return;
    setPostingComment(true);
    try {
      const comment = await api.addComment(
        detail.id,
        commentBody.trim(),
        commentAuthorId || undefined,
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              comments: [...current.comments, comment],
              commentCount: current.commentCount + 1,
            }
          : current,
      );
      setCommentBody("");
      onChanged();
    } catch (commentError) {
      onToast(
        commentError instanceof Error ? commentError.message : "Could not add the comment.",
        "error",
      );
    } finally {
      setPostingComment(false);
    }
  }

  async function deleteTask() {
    if (!detail) return;
    setDeleting(true);
    try {
      await api.deleteTask(detail.id);
      onDeleted();
      onClose();
    } catch (deleteError) {
      onToast(
        deleteError instanceof Error ? deleteError.message : "Could not delete the task.",
        "error",
      );
      setDeleting(false);
    }
  }

  return (
    <div
      className="drawer-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Task details">
        <header className="drawer-head">
          <div className="drawer-heading">
            <span className="eyebrow">Task</span>
            <span className="drawer-project">{projectName}</span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close task">
            <CloseIcon />
          </button>
        </header>

        {loading ? <div className="drawer-loading">Loading task…</div> : null}

        {!loading && error ? (
          <div className="drawer-body">
            <ErrorNote message={error} onRetry={() => window.location.reload()} />
          </div>
        ) : null}

        {!loading && detail ? (
          <div className="drawer-body">
            <div className="task-title-row">
              <input
                className="task-title-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
                aria-label="Task title"
                maxLength={200}
              />
              <StatusPill status={detail.status} />
            </div>

            <div className="status-switch" role="group" aria-label="Task status">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className="status-choice"
                  data-active={detail.status === status}
                  onClick={() => void patch({ status }, `Moved to ${statusLabel(status)}.`)}
                >
                  <span className="status-dot" data-status={status} aria-hidden="true" />
                  {statusLabel(status)}
                </button>
              ))}
            </div>

            <div className="detail-grid">
              <div className="field">
                <label htmlFor="detail-priority">Priority</label>
                <select
                  id="detail-priority"
                  className="input"
                  value={detail.priority}
                  onChange={(event) =>
                    void patch({
                      priority: event.target.value as (typeof PRIORITIES)[number],
                    })
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="detail-assignee">Assignee</label>
                <select
                  id="detail-assignee"
                  className="input"
                  value={detail.assigneeId ?? ""}
                  onChange={(event) =>
                    void patch({ assigneeId: event.target.value || null }, "Assignee updated.")
                  }
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="detail-due">Due date</label>
                <div className="input-with-icon">
                  <CalendarIcon size={14} />
                  <input
                    id="detail-due"
                    type="date"
                    className="input"
                    value={detail.dueDate ?? ""}
                    onChange={(event) =>
                      void patch({ dueDate: event.target.value || null }, "Due date updated.")
                    }
                  />
                </div>
              </div>
            </div>

            <section className="drawer-section">
              <h3>Description</h3>
              <textarea
                className="input textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onBlur={saveDescription}
                placeholder="Add context, links, or acceptance criteria."
                rows={5}
                maxLength={5000}
              />
              <p className="field-hint">Saves when you click away.</p>
            </section>

            <section className="drawer-section">
              <div className="section-heading">
                <h3>
                  Comments <span className="count">{detail.comments.length}</span>
                </h3>
              </div>

              <div className="comment-list">
                {detail.comments.map((comment) => (
                  <article className="comment" key={comment.id}>
                    <Avatar name={comment.authorName} color={comment.authorColor} small />
                    <div>
                      <div className="comment-meta">
                        <strong>{comment.authorName ?? "Unknown"}</strong>
                        <span title={formatDateTime(comment.createdAt)}>
                          {formatRelative(comment.createdAt)}
                        </span>
                      </div>
                      <p>{comment.body}</p>
                    </div>
                  </article>
                ))}
                {detail.comments.length === 0 ? (
                  <p className="muted-copy">No comments yet. Add the first one below.</p>
                ) : null}
              </div>

              <div className="comment-form">
                <textarea
                  className="input textarea"
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Write a comment…"
                  rows={3}
                  maxLength={2000}
                />
                <div className="comment-form-row">
                  <select
                    className="input input-compact"
                    value={commentAuthorId}
                    onChange={(event) => setCommentAuthorId(event.target.value)}
                    aria-label="Comment author"
                  >
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void addComment()}
                    disabled={postingComment || !commentBody.trim()}
                  >
                    <CommentIcon size={14} />
                    {postingComment ? "Adding…" : "Comment"}
                  </button>
                </div>
              </div>
            </section>

            <div className="drawer-actions">
              {confirmingDelete ? (
                <div className="confirm-row">
                  <span>Delete this task and its comments?</span>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => void deleteTask()}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <TrashIcon size={14} />
                  Delete task
                </button>
              )}
            </div>

            <p className="drawer-meta">
              Created {formatDateTime(detail.createdAt)} · Updated {formatRelative(detail.updatedAt)}
            </p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
