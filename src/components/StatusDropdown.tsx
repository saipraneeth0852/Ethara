import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TaskStatus } from "@/types";

interface Props {
  value: TaskStatus;
  disabled?: boolean;
  onChange: (s: TaskStatus) => void;
}

export const StatusDropdown = ({ value, disabled, onChange }: Props) => (
  <Select value={value} disabled={disabled} onValueChange={(v) => onChange(v as TaskStatus)}>
    <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="todo">Todo</SelectItem>
      <SelectItem value="in_progress">In Progress</SelectItem>
      <SelectItem value="done">Done</SelectItem>
    </SelectContent>
  </Select>
);
