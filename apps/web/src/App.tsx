import { useCallback, useEffect, useState } from "react";
import { api, type ProjectInput, type TaskInput } from "./api";
import type { Activity, Member, Project, Status, Task, View } from "./types";
import { isOverdue, statusLabel } from "./lib/format";
import { ActivityView } from "./components/ActivityView";
import { Board } from "./components/Board";
import { ProjectDialog } from "./components/ProjectDialog";
import { Sidebar } from "./components/Sidebar";
import { TaskDialog } from "./components/TaskDialog";
import { TaskPanel } from "./components/TaskPanel";
import { PlusIcon } from "./components/icons";
import { EmptyState, ErrorNote } from "./components/ui";

type Toast = { id: number; message: string; tone: "ok" | "error" };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [view, setView] = useState<View>("board");

  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; status: Status }>({
    open: false,
    status: "todo",
  });
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const showToast = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [projectList, memberList] = await Promise.all([
          api.projects(),
          api.members(),
        ]);
        if (cancelled) return;
        setProjects(projectList);
        setMembers(memberList);
        setApiOnline(true);
        setError(null);
        setActiveProjectId((current) =>
          current && projectList.some((project) => project.id === current)
            ? current
            : (projectList[0]?.id ?? ""),
        );
      } catch (loadError) {
        if (cancelled) return;
        setError(messageOf(loadError));
        setApiOnline(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!activeProjectId) {
      setTasks([]);
      return;
    }

    let cancelled = false;
    setTasksLoading(true);
    api
      .tasks(activeProjectId)
      .then((items) => {
        if (cancelled) return;
        setTasks(items);
        setApiOnline(true);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(messageOf(loadError));
        setApiOnline(false);
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, refreshKey]);

  useEffect(() => {
    if (view !== "activity") return;

    let cancelled = false;
    setActivityLoading(true);
    setActivityError(null);
    api
      .activity(60)
      .then((items) => {
        if (!cancelled) setActivity(items);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setActivityError(messageOf(loadError));
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view, refreshKey]);

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const todoCount = tasks.filter((task) => task.status === "todo").length;
  const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const overdueCount = tasks.filter(
    (task) => task.status !== "done" && isOverdue(task.dueDate),
  ).length;

  async function createTask(input: TaskInput & { title: string }) {
    if (!activeProjectId) throw new Error("Choose a project first.");
    await api.createTask(activeProjectId, input);
    refresh();
    showToast("Task created.");
  }

  async function createProject(input: ProjectInput) {
    const project = await api.createProject(input);
    setProjects((current) => [...current, project]);
    setActiveProjectId(project.id);
    setView("board");
    refresh();
    showToast("Project created.");
  }

  async function moveTask(id: string, status: Status) {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === status) return;

    setTasks((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );

    try {
      await api.updateTask(id, { status });
      showToast(`Moved to ${statusLabel(status)}.`);
      refresh();
    } catch (moveError) {
      showToast(messageOf(moveError), "error");
      refresh();
    }
  }


  function selectProject(id: string) {
    setActiveProjectId(id);
    setSelectedTaskId(null);
    setView("board");
  }

  function openTaskDialog(status: Status) {
    if (!activeProjectId) {
      setProjectDialogOpen(true);
      return;
    }
    setTaskDialog({ open: true, status });
  }

  const primaryAction = (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() =>
        activeProject ? openTaskDialog("todo") : setProjectDialogOpen(true)
      }
    >
      <PlusIcon size={15} />
      {activeProject ? "New task" : "New project"}
    </button>
  );

  return (
    <div className="shell">
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        view={view}
        apiOnline={apiOnline}
        onSelectProject={selectProject}
        onNewProject={() => setProjectDialogOpen(true)}
        onChangeView={setView}
      />

      <div className="main">
        <header className="topbar">
          <div className="topbar-main">
            <span className="breadcrumb">
              {view === "board"
                ? `Projects / ${activeProject?.name ?? "None"}`
                : "Workspace"}
            </span>
            <h1>
              {view === "board" ? (activeProject?.name ?? "Taskline") : "Activity"}
            </h1>
            <p className="subtitle">
              {view === "board"
                ? (activeProject?.description ??
                  "Plan, assign, and ship work with your team.")
                : "Everything that changed across Taskline."}
            </p>
          </div>

          <div className="topbar-actions">
            {view === "board" && activeProject ? (
              <div className="stat-strip" aria-label="Project statistics">
                <div className="stat">
                  <strong>{todoCount}</strong>
                  <span>To do</span>
                </div>
                <div className="stat">
                  <strong>{inProgressCount}</strong>
                  <span>Doing</span>
                </div>
                <div className="stat">
                  <strong>{doneCount}</strong>
                  <span>Done</span>
                </div>
                <div className="stat" data-alert={overdueCount > 0}>
                  <strong>{overdueCount}</strong>
                  <span>Overdue</span>
                </div>
              </div>
            ) : null}

            {primaryAction}
          </div>
        </header>

        <main className="content">
          {error ? (
            <div className="content-error">
              <ErrorNote
                message={error}
                onRetry={() => {
                  setError(null);
                  refresh();
                }}
              />
            </div>
          ) : null}

          {loading && projects.length === 0 ? (
            <div className="page-loading">Loading Taskline…</div>
          ) : null}

          {!loading && view === "board" ? (
            activeProject ? (
              <Board
                tasks={tasks}
                loading={tasksLoading}
                onOpenTask={setSelectedTaskId}
                onMoveTask={(id, status) => void moveTask(id, status)}
                onAddTask={openTaskDialog}
              />
            ) : (
              <EmptyState
                title="No projects yet"
                detail="Create a project to start planning work with your team."
                action={
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setProjectDialogOpen(true)}
                  >
                    <PlusIcon size={15} />
                    Create a project
                  </button>
                }
              />
            )
          ) : null}

          {!loading && view === "activity" ? (
            <ActivityView
              activity={activity}
              loading={activityLoading}
              error={activityError}
              onRetry={refresh}
            />
          ) : null}

        </main>
      </div>

      {selectedTaskId ? (
        <TaskPanel
          taskId={selectedTaskId}
          projectName={activeProject?.name ?? ""}
          members={members}
          onClose={() => setSelectedTaskId(null)}
          onChanged={refresh}
          onDeleted={() => {
            setSelectedTaskId(null);
            refresh();
            showToast("Task deleted.");
          }}
          onToast={showToast}
        />
      ) : null}

      {taskDialog.open ? (
        <TaskDialog
          defaultStatus={taskDialog.status}
          members={members}
          onClose={() => setTaskDialog({ open: false, status: "todo" })}
          onCreate={createTask}
        />
      ) : null}

      {projectDialogOpen ? (
        <ProjectDialog
          onClose={() => setProjectDialogOpen(false)}
          onCreate={createProject}
        />
      ) : null}

      {toast ? (
        <div className="toast" data-tone={toast.tone} role="status">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
