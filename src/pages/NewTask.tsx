import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { Member, TaskPriority } from "@/types";

const schema = z.object({
  title: z.string().trim().min(1, "Title required").max(100, "Max 100 chars"),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "medium", "high"]),
  due_date: z.string().optional(),
  assignee_id: z.string().optional(),
});

const NewTask = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<Member[]>(`/projects/${id}/members`).then(({ data }) => setMembers(data)).catch(() => {});
  }, [id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ title, description, priority, due_date: dueDate, assignee_id: assigneeId });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/projects/${id}/tasks`, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId || null,
      });
      toast.success("Task created");
      navigate(`/projects/${id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to={`/projects/${id}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" />Back to project
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New task</h1>
        <p className="text-muted-foreground mt-1">Add a task to this project.</p>
      </div>
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Design new landing hero" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">Due date</Label>
              <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate(`/projects/${id}`)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create task"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default NewTask;
