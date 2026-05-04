import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/Badges";
import { Trash2 } from "lucide-react";
import type { Member } from "@/types";

interface Props {
  member: Member;
  canRemove?: boolean;
  onRemove?: () => void;
}

export const MemberRow = ({ member, canRemove, onRemove }: Props) => {
  const initials = member.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors group">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{member.name}</p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      <RoleBadge role={member.project_role} />
      {canRemove && (
        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
