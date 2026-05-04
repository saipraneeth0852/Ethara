import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { TaskCard } from "@/components/TaskCard";
import { ProjectCard } from "@/components/ProjectCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ListChecks, CircleDashed, Loader2, CheckCircle2, AlertTriangle, FolderKanban, Inbox } from "lucide-react";
import type { DashboardData } from "@/types";

const Dashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>("/dashboard")
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return <EmptyState title="Could not load dashboard" description="Please try again later." />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">An overview of all your work in one place.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={ListChecks} label="Total tasks" value={data.total_tasks} />
        <StatCard icon={CircleDashed} label="To do" value={data.todo_count} />
        <StatCard icon={Loader2} label="In progress" value={data.in_progress_count} tone="info" />
        <StatCard icon={CheckCircle2} label="Done" value={data.done_count} tone="success" />
        <StatCard icon={AlertTriangle} label="Overdue" value={data.overdue_count} tone="destructive" />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">My tasks</h2>
          {data.my_tasks.length === 0 ? (
            <EmptyState icon={Inbox} title="No tasks assigned" description="Tasks assigned to you will show here." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.my_tasks.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Recent projects</h2>
          {data.recent_projects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No projects yet" />
          ) : (
            <div className="space-y-3">
              {data.recent_projects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
