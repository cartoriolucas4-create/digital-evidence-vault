import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, FileSearch } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Registro Técnico de Evidências Digitais" },
      { name: "description", content: "Plataforma para preservação técnica de evidências digitais em investigações legítimas." },
      { property: "og:title", content: "Registro Técnico de Evidências Digitais" },
      { property: "og:description", content: "Preservação técnica de evidências digitais para investigação policial legítima." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5" />
            Registro Técnico de Evidências
          </div>
          <Link to="/auth" className="text-sm underline underline-offset-4">Painel administrativo</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">
          Preservação técnica de evidências digitais
        </h1>
        <p className="mt-4 text-muted-foreground">
          Sistema destinado a registro técnico confiável de metadados de acesso HTTP,
          informações do navegador, geolocalização e captura de imagem — sempre por meio
          das APIs oficiais do navegador e mediante autorização explícita do usuário.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Feature icon={<FileSearch className="h-5 w-5" />} title="Cadeia de custódia">
            UUID único, hash SHA-256 dos arquivos e dos metadados, log de auditoria.
          </Feature>
          <Feature icon={<Lock className="h-5 w-5" />} title="Sem invenção de dados">
            Cada campo indica sua origem. Dados indisponíveis são explicitamente marcados.
          </Feature>
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Somente com autorização">
            Câmera e localização exigem consentimento explícito via APIs padrão do navegador.
          </Feature>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          Uso restrito a investigação legítima e documentação técnica.
        </p>
      </main>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 font-medium">{icon}{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
