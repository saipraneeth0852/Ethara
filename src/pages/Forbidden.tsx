import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

const Forbidden = () => (
  <div className="min-h-screen flex items-center justify-center p-6 gradient-subtle">
    <div className="text-center space-y-4 max-w-md">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">403 — Forbidden</h1>
      <p className="text-muted-foreground">You don't have permission to access this page. Members can't perform admin actions.</p>
      <Button asChild><Link to="/dashboard">Back to dashboard</Link></Button>
    </div>
  </div>
);

export default Forbidden;
