import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Project } from "@/types";

export const ProjectCard = ({ project }: { project: Project }) => {
  const total = project.task_count ?? 0;
  const done = project.done_count ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link to={`/projects/${project.id}`}>
      <Card className="p-6 h-full cursor-pointer transition-all hover:shadow-elegant hover:-translate-y-1 hover:border-primary/40 group">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">{project.name}</h3>
            {project.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{done}/{total} done</span>
              <span className="font-medium text-foreground">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>

          <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{project.member_count ?? 0} members</span>
          </div>
        </div>
      </Card>
    </Link>
  );
};
