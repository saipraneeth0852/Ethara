export type Role = "admin" | "member";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at?: string;
  member_count?: number;
  task_count?: number;
  done_count?: number;
}

export interface Member extends User {
  project_role: Role;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  project_id: string;
  assignee_id?: string | null;
  assignee?: Pick<User, "id" | "name" | "email"> | null;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardData {
  total_tasks: number;
  todo_count: number;
  in_progress_count: number;
  done_count: number;
  overdue_count: number;
  my_tasks: Task[];
  recent_projects: Project[];
}
