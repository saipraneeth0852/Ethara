import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus, Role } from "@/types";

const PRIORITY: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning/15 text-warning border-warning/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
};

const STATUS: Record<TaskStatus, string> = {
  todo: "bg-secondary text-secondary-foreground border-border",
  in_progress: "bg-info/15 text-info border-info/30",
  done: "bg-success/15 text-success border-success/30",
};

const ROLE: Record<Role, string> = {
  admin: "bg-accent text-accent-foreground border-primary/30",
  member: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};

export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => (
  <Badge variant="outline" className={cn("capitalize font-medium", PRIORITY[priority])}>{priority}</Badge>
);

export const StatusBadge = ({ status }: { status: TaskStatus }) => (
  <Badge variant="outline" className={cn("font-medium", STATUS[status])}>{STATUS_LABEL[status]}</Badge>
);

export const RoleBadge = ({ role }: { role: Role }) => (
  <Badge variant="outline" className={cn("uppercase text-[10px] tracking-wide font-semibold", ROLE[role])}>{role}</Badge>
);
