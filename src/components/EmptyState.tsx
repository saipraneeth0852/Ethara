import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon: Icon = Inbox, title, description, action }: Props) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-dashed bg-secondary/30">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground mb-4">
      <Icon className="h-6 w-6" />
    </div>
    <h3 className="font-semibold">{title}</h3>
    {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
