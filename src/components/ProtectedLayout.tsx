import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const ProtectedLayout = ({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen p-8 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/forbidden" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">{children}</main>
    </div>
  );
};
