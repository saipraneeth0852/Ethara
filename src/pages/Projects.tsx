import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ProjectCard } from "@/components/ProjectCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/types";

const Projects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Project[]>("/projects");
      setProjects(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || name.length > 80) {
      toast.error("Name required (max 80 chars)");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/projects", { name: name.trim(), description: description.trim() });
      toast.success("Project created");
      setOpen(false);
      setName(""); setDescription("");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">All projects you belong to.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="pname">Name</Label>
                  <Input id="pname" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdesc">Description</Label>
                  <Textarea id="pdesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create} disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" description={isAdmin ? "Create your first project to get started." : "An admin needs to add you to a project."} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
};

export default Projects;
