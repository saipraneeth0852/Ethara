import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

const isOverdue = (t: Task) => t.due_date && t.status !== "done" && new Date(t.due_date) < new Date(new Date().toDateString());

export const TaskCard = ({ task, onClick }: { task: Task; onClick?: () => void }) => {
  const overdue = isOverdue(task);
  const initials = task.assignee?.name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-elegant hover:-translate-y-0.5 space-y-3",
        overdue && "border-destructive/50 bg-destructive/5"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-sm leading-snug line-clamp-2">{task.title}</h4>
        <PriorityBadge priority={task.priority} />
      </div>
      {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.due_date && (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive font-medium")}>
              {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
              {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
          <StatusBadge status={task.status} />
        </div>
        {task.assignee && (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </Card>
  );
};
