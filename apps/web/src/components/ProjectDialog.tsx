import { useState } from "react";
import type { FormEvent } from "react";
import type { ProjectInput } from "../api";
import { Modal } from "./Modal";
import { ProjectDot } from "./ui";

const COLORS = ["violet", "emerald", "amber", "sky", "rose", "stone"] as const;

export function ProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: ProjectInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<(typeof COLORS)[number]>("violet");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the project a name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not create the project.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New project"
      subtitle="A clean space for one body of work."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-project-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create project"}
          </button>
        </>
      }
    >
      <form id="new-project-form" className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="project-name">Name</label>
          <input
            id="project-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Billing cleanup"
            autoFocus
            maxLength={120}
          />
        </div>

        <div className="field">
          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            className="input textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="One sentence about the outcome."
            rows={3}
            maxLength={500}
          />
        </div>

        <div className="field">
          <span className="label">Color</span>
          <div className="color-row">
            {COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className="color-choice"
                data-active={color === option}
                onClick={() => setColor(option)}
                aria-label={option}
              >
                <ProjectDot color={option} />
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </Modal>
  );
}
