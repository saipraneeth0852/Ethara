import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone?: "default" | "info" | "warning" | "success" | "destructive";
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  default: "bg-accent text-accent-foreground",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
};

export const StatCard = ({ icon: Icon, label, value, tone = "default" }: Props) => (
  <Card className="p-5 hover:shadow-elegant transition-shadow">
    <div className="flex items-center gap-4">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", TONE[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</p>
      </div>
    </div>
  </Card>
);
