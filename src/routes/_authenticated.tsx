import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Building2, LayoutDashboard, FileSpreadsheet, LogOut, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Skip auth check during SSR/prerender — there's no localStorage on the server,
    // so the session would always appear missing and force a redirect loop.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = useAuth();
  const nav = useNavigate();
  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/login" }); };

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-background">
      <aside className="bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <Building2 className="size-5 text-sidebar-primary" />
          <span className="font-semibold tracking-tight">Orça</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <NavItem to="/dashboard" icon={LayoutDashboard}>Orçamentos</NavItem>
          <NavItem to="/bases" icon={Database}>Bases</NavItem>
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 py-2 text-xs text-sidebar-foreground/70 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={signOut}>
            <LogOut className="mr-2 size-4" /> Sair
          </Button>
        </div>
      </aside>
      <main className="overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, children }: { to: string; icon: any; children: React.ReactNode }) {
  return (
    <Link to={to as any} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}>
      <Icon className="size-4" /> {children}
    </Link>
  );
}
