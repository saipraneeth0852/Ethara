import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskCard } from "@/components/TaskCard";
import { MemberRow } from "@/components/MemberRow";
import { EmptyState } from "@/components/EmptyState";
import { StatusDropdown } from "@/components/StatusDropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PriorityBadge } from "@/components/Badges";
import { Plus, UserPlus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Member, Project, Task, TaskStatus } from "@/types";

interface DetailResponse {
  project: Project;
  members: Member[];
  tasks: Task[];
}

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const isAdmin = user?.role === "admin";

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get<DetailResponse>(`/projects/${id}`);
      setData(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const addMember = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    try {
      await api.post(`/projects/${id}/members`, { email: addEmail.trim() });
      toast.success("Member added");
      setAddEmail("");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await api.delete(`/projects/${id}/members/${userId}`);
      toast.success("Member removed");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to remove");
    }
  };

  const updateStatus = async (task: Task, status: TaskStatus) => {
    try {
      await api.patch(`/tasks/${task.id}/status`, { status });
      toast.success("Status updated");
      setData((d) => d ? { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, status } : t) } : d);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to update");
    }
  };

  const removeTask = async (taskId: string) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success("Task deleted");
      setActiveTask(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed");
    }
  };

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    data?.tasks.forEach((t) => map[t.status].push(t));
    return map;
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 lg:grid-cols-4">
          <Skeleton className="h-96 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (!data) return <EmptyState title="Project not found" />;

  const { project, members, tasks } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />Back to projects
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            {project.description && <p className="text-muted-foreground mt-1 max-w-2xl">{project.description}</p>}
          </div>
          {isAdmin && (
            <Button asChild><Link to={`/projects/${project.id}/tasks/new`}><Plus className="h-4 w-4 mr-2" />New task</Link></Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="p-5 lg:col-span-1 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Members</h2>
            <span className="text-xs text-muted-foreground">{members.length}</span>
          </div>
          {isAdmin && (
            <div className="flex gap-2 mb-4">
              <Input placeholder="email@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} className="h-9" />
              <Button size="icon" onClick={addMember} disabled={adding} className="h-9 w-9 shrink-0">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="space-y-1 -mx-2">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} canRemove={isAdmin && m.id !== project.owner_id} onRemove={() => removeMember(m.id)} />
            ))}
          </div>
        </Card>

        <div className="lg:col-span-3 grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{grouped[col.key].length}</span>
              </div>
              <div className="space-y-3 min-h-[200px] p-2 rounded-xl bg-secondary/40">
                {grouped[col.key].length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                ) : grouped[col.key].map((t) => (
                  <TaskCard key={t.id} task={t} onClick={() => setActiveTask(t)} />
                ))}
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="md:col-span-3">
              <EmptyState title="No tasks yet" description={isAdmin ? "Create your first task to get started." : "Tasks will appear here once added."} />
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!activeTask} onOpenChange={(o) => !o && setActiveTask(null)}>
        <DialogContent>
          {activeTask && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-start justify-between gap-3">
                  <span>{activeTask.title}</span>
                  <PriorityBadge priority={activeTask.priority} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {activeTask.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activeTask.description}</p>}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Assignee</p>
                    <p className="font-medium">{activeTask.assignee?.name ?? "Unassigned"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Due date</p>
                    <p className="font-medium">{activeTask.due_date ? new Date(activeTask.due_date).toLocaleDateString() : "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-2">Status</p>
                  <StatusDropdown
                    value={activeTask.status}
                    disabled={!isAdmin && activeTask.assignee_id !== user?.id}
                    onChange={(s) => updateStatus(activeTask, s)}
                  />
                </div>
              </div>
              <DialogFooter>
                {isAdmin && <Button variant="destructive" onClick={() => removeTask(activeTask.id)}>Delete</Button>}
                <Button variant="ghost" onClick={() => setActiveTask(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;
