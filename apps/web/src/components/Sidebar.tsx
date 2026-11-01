import type { Project, View } from "../types";
import {
  ActivityIcon,
  BoardIcon,
  PlusIcon,
} from "./icons";
import { ProjectDot } from "./ui";

export function Sidebar({
  projects,
  activeProjectId,
  view,
  apiOnline,
  onSelectProject,
  onNewProject,
  onChangeView,
}: {
  projects: Project[];
  activeProjectId: string;
  view: View;
  apiOnline: boolean;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onChangeView: (view: View) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          T
        </div>
        <div className="brand-text">
          <strong>Taskline</strong>
          <span>Team tasks</span>
        </div>
      </div>

      <nav className="nav" aria-label="Views">
        <button
          type="button"
          className="nav-item"
          data-active={view === "board"}
          onClick={() => onChangeView("board")}
        >
          <BoardIcon />
          Board
        </button>
        <button
          type="button"
          className="nav-item"
          data-active={view === "activity"}
          onClick={() => onChangeView("activity")}
        >
          <ActivityIcon />
          Activity
        </button>
      </nav>

      <div className="sidebar-projects">
        <div className="sidebar-heading">
          <span>Projects</span>
          <button
            type="button"
            className="icon-btn"
            onClick={onNewProject}
            aria-label="New project"
            title="New project"
          >
            <PlusIcon />
          </button>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className="project-link"
              data-active={project.id === activeProjectId}
              onClick={() => onSelectProject(project.id)}
            >
              <ProjectDot color={project.color} />
              <span className="project-link-name">{project.name}</span>
              <span className="project-link-count">{project.taskCount}</span>
            </button>
          ))}
          {projects.length === 0 ? (
            <p className="sidebar-empty">No projects yet.</p>
          ) : null}
        </div>
      </div>

      <div className="sidebar-foot">
        <div className="api-state">
          <span className="api-dot" data-online={apiOnline} aria-hidden="true" />
          {apiOnline ? "API connected" : "API offline"}
          <span className="api-port">:4101</span>
        </div>
        <span className="version">v0.1 · SQLite</span>
      </div>
    </aside>
  );
}
