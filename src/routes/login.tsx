import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Orça" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    nav({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const redirect = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { nome }, emailRedirectTo: redirect } });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/dashboard` });
    if (r.error) toast.error("Falha ao entrar com Google");
    else if (!r.redirected) nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-10">
        <div className="flex items-center gap-2 font-semibold"><Building2 className="size-5 text-sidebar-primary" /> Orça</div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">Orçamentos de obra com a precisão que sua engenharia merece.</h2>
          <p className="mt-3 text-sidebar-foreground/70 max-w-md">SINAPI, DER, composições, BDI e cronograma físico-financeiro num único fluxo.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© Orça</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">Acessar plataforma</h1>
          <p className="text-sm text-muted-foreground mb-6">Entre com seus dados ou crie uma conta.</p>

          <Button variant="outline" className="w-full mb-4" onClick={google}>Continuar com Google</Button>
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

          <p className="mt-6 text-xs text-center text-muted-foreground">
            <Link to="/" className="hover:underline">Voltar ao início</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
