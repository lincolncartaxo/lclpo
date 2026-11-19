import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { pageMetadata } from "@/lib/route-metadata";
import { LegalLinks } from "@/components/LegalLayout";

export const Route = createFileRoute("/login")({
  head: () => pageMetadata("Entrar", "Acesse sua conta LclPlan e os orçamentos de engenharia da sua empresa.", "/login"),
  component: LoginPage,
});

function safeNextPath() {
  if (typeof window === "undefined") return "/dashboard";
  const target = new URLSearchParams(window.location.search).get("next")?.trim();
  return target && target.startsWith("/") && !target.startsWith("//") ? target : "/dashboard";
}

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_IN") void nav({ to: safeNextPath() as any });
    });
    return () => data.subscription.unsubscribe();
  }, [nav]);
  const AUTH_TIMEOUT_MS = 15000;

  const withAuthTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error("O serviço de autenticação demorou mais que o esperado. Verifique sua conexão e tente novamente.")), AUTH_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const { error } = await withAuthTimeout(supabase.auth.signInWithPassword({ email, password }));
      if (error) return toast.error(error.message);
      await nav({ to: safeNextPath() as any });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const redirect = `${window.location.origin}/login?next=${encodeURIComponent(safeNextPath())}`;
      const { error } = await withAuthTimeout(supabase.auth.signUp({ email, password, options: { data: { nome }, emailRedirectTo: redirect } }));
      if (error) return toast.error(error.message);
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    try {
      const r = await withAuthTimeout(lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/login?next=${encodeURIComponent(safeNextPath())}` }));
      if (r.error) toast.error(r.error.message || "Falha ao entrar com Google");
      else if (!r.redirected) await nav({ to: safeNextPath() as any });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao entrar com Google.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) return toast.error("Informe seu e-mail para recuperar a senha.");
    setLoading(true);
    try {
      const { error } = await withAuthTimeout(supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login?next=${encodeURIComponent(safeNextPath())}` }));
      if (error) throw error;
      toast.success("Se houver uma conta com este e-mail, você receberá um link para redefinir a senha.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível solicitar a recuperação.");
    } finally { setLoading(false); }
  };
  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const { error } = await withAuthTimeout(supabase.auth.updateUser({ password }));
      if (error) throw error;
      setRecovering(false); setPassword("");
      toast.success("Senha atualizada.");
      await nav({ to: safeNextPath() as any });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a senha."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-10">
        <Brand tone="dark" />
        <div>
          <h2 className="text-3xl font-bold leading-tight">Orçamentos de obra com a precisão que sua engenharia merece.</h2>
          <p className="mt-3 text-sidebar-foreground/70 max-w-md">SINAPI, DER, composições, BDI e cronograma físico-financeiro num único fluxo.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© LclPlan</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">Acessar plataforma</h1>
          <p className="text-sm text-muted-foreground mb-6">Entre com seus dados ou crie uma conta.</p>

          {recovering ? <form onSubmit={savePassword} className="space-y-3">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input id="new-password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" className="w-full" disabled={loading}>Salvar nova senha</Button>
          </form> : <>
          <Button variant="outline" className="w-full mb-4" onClick={google} disabled={loading}>Continuar com Google</Button>
          <div className="relative my-4 text-center text-xs text-muted-foreground"><span className="bg-background px-2 relative z-10">ou com e-mail</span><div className="absolute inset-x-0 top-1/2 border-t" /></div>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-3 mt-4">
                <div><Label>E-mail</Label><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
                <div><Label>Senha</Label><Input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading?"Entrando…":"Entrar"}</Button>
                <Button type="button" variant="link" className="w-full" onClick={resetPassword} disabled={loading}>Esqueci minha senha</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-3 mt-4">
                <div><Label>Nome</Label><Input required value={nome} onChange={(e)=>setNome(e.target.value)} /></div>
                <div><Label>E-mail</Label><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
                <div><Label>Senha</Label><Input type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading?"Criando…":"Criar conta"}</Button>
              </form>
            </TabsContent>
          </Tabs>
          </>}

          <p className="mt-6 text-xs text-center text-muted-foreground">
            <Link to="/" className="hover:underline">Voltar ao início</Link>
          </p>
          <div className="mt-4"><LegalLinks /></div>
        </div>
      </div>
    </div>
  );
}
