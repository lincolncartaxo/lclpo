import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Building2, LayoutDashboard, FileSpreadsheet, LogOut, Database, Shield, CreditCard, LifeBuoy, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";

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
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/login" }); };
  const toggleSidebar = () => {
    setSidebarHidden((hidden) => {
      const nextHidden = !hidden;
      window.localStorage.setItem("lclplan-sidebar-hidden", String(nextHidden));
      return nextHidden;
    });
  };

  useEffect(() => {
    setSidebarHidden(window.localStorage.getItem("lclplan-sidebar-hidden") === "true");
  }, []);

  return (
    <div className={sidebarHidden ? "min-h-screen bg-background" : "min-h-screen grid grid-cols-[240px_1fr] bg-background"}>
      {!sidebarHidden && <aside className="bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <Brand tone="dark" />
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={toggleSidebar}
            aria-label="Ocultar menu lateral"
            title="Ocultar menu lateral"
          >
            <PanelLeftClose />
          </Button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <NavItem to="/dashboard" icon={LayoutDashboard}>Orçamentos</NavItem>
          <NavItem to="/bases" icon={Database}>Bases</NavItem>
          <NavItem to="/team" icon={Building2}>Minha Empresa</NavItem>
          <NavItem to="/planos" icon={CreditCard}>Planos</NavItem>
          <NavItem to="/suporte" icon={LifeBuoy}>Suporte</NavItem>
          <AdminLink />
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 py-2 text-xs text-sidebar-foreground/70 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={signOut}>
            <LogOut className="mr-2 size-4" /> Sair
          </Button>
        </div>
      </aside>}
      <main className="relative overflow-x-auto">
        {sidebarHidden && <Button
          variant="outline"
          size="icon"
          className="fixed left-4 top-4 z-30 bg-background shadow-sm"
          onClick={toggleSidebar}
          aria-label="Mostrar menu lateral"
          title="Mostrar menu lateral"
        >
          <PanelLeftOpen />
        </Button>}
        <Outlet />
      </main>
    </div>
  );
}

function AdminLink() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return setIsAdmin(false);
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);
  if (!isAdmin) return null;
  return <NavItem to="/admin" icon={Shield}>Administração</NavItem>;
}

function NavItem({ to, icon: Icon, children }: { to: string; icon: any; children: React.ReactNode }) {
  return (
    <Link to={to as any} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}>
      <Icon className="size-4" /> {children}
    </Link>
  );
}
