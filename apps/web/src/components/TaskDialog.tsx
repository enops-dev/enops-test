import { useState } from "react";
import type { FormEvent } from "react";
import type { Priority, Status } from "../types";
import type { TaskInput } from "../api";
import { Modal } from "./Modal";
import { statusLabel } from "../lib/format";

export function TaskDialog({
  defaultStatus,
  members,
  onClose,
  onCreate,
}: {
  defaultStatus: Status;
  members: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreate: (input: TaskInput & { title: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [priority, setPriority] = useState<Priority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Give the task a title.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create the task.");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New task"
      subtitle="It appears on the board immediately."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-task-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create task"}
          </button>
        </>
      }
    >
      <form id="new-task-form" className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to happen?"
            autoFocus
            maxLength={200}
          />
        </div>

        <div className="field">
          <label htmlFor="task-description">Description</label>
          <textarea
            id="task-description"
            className="input textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add context, links, or acceptance criteria."
            rows={4}
            maxLength={5000}
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="task-status">Column</label>
            <select
              id="task-status"
              className="input"
              value={status}
              onChange={(event) => setStatus(event.target.value as Status)}
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="task-priority">Priority</label>
            <select
              id="task-priority"
              className="input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="task-assignee">Assignee</label>
            <select
              id="task-assignee"
              className="input"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
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
            <label htmlFor="task-due">Due date</label>
            <input
              id="task-due"
              type="date"
              className="input"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
        </div>

        <p className="form-hint">
          New tasks land in <strong>{statusLabel(status)}</strong>.
        </p>

        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </Modal>
  );
}
