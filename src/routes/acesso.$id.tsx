import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getPublicCase } from "@/lib/cases.functions";
import { collectBrowserInfo, sha256Hex } from "@/lib/browser-info";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Camera, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/acesso/$id")({
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title ? `${loaderData.title}` : "Acesso" },
      { name: "description", content: loaderData?.description ?? "Acesso registrado." },
      { property: "og:title", content: loaderData?.title ?? "Acesso" },
      { property: "og:description", content: loaderData?.description ?? "" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const c = await getPublicCase({ data: { id: params.id } });
    return c ? { title: c.title, description: c.description ?? "" } : { title: "Indisponível", description: "" };
  },
  component: PublicAccess,
});

function makeSessionId() {
  return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function PublicAccess() {
  const { id } = useParams({ from: "/acesso/$id" });
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "error">("idle");
  const [camStatus, setCamStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "error" | "captured">("idle");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await getPublicCase({ data: { id } });
        setCaseData(c);
      } finally {
        setLoading(false);
      }
      const sessionId = makeSessionId();
      const browser = collectBrowserInfo();
      try {
        const res = await fetch("/api/public/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            caseId: id,
            sessionId,
            clientTimestamp: new Date().toISOString(),
            browser,
          }),
        });
        const j = await res.json();
        if (j.eventId) setEventId(j.eventId);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [id]);

  async function requestGeolocation() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      toast.error("API de geolocalização indisponível neste navegador.");
      return;
    }
    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoStatus("granted");
        if (!eventId) return;
        await fetch("/api/public/geo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            eventId,
            geolocation: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude,
              altitudeAccuracy: pos.coords.altitudeAccuracy,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
              deviceTimestamp: new Date(pos.timestamp).toISOString(),
            },
          }),
        });
        toast.success("Localização registrada.");
      },
      (err) => {
        setGeoStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
        toast.error("Não foi possível obter a localização.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function requestCamera(f: "user" | "environment" = facing) {
    setFacing(f);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamStatus("error");
      toast.error("Câmera indisponível.");
      return;
    }
    setCamStatus("requesting");
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: f } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamStatus("granted");
    } catch (e: any) {
      setCamStatus(e?.name === "NotAllowedError" ? "denied" : "error");
      toast.error("Não foi possível acessar a câmera.");
    }
  }

  async function capture() {
    if (!videoRef.current || !eventId) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return;
    const buf = await blob.arrayBuffer();
    const hash = await sha256Hex(buf);
    const form = new FormData();
    form.set("eventId", eventId);
    form.set("caseId", id);
    form.set("facing", facing);
    form.set("width", String(canvas.width));
    form.set("height", String(canvas.height));
    form.set("clientTimestamp", new Date().toISOString());
    form.set("file", new File([blob], `capture-${hash.slice(0, 12)}.jpg`, { type: "image/jpeg" }));
    const res = await fetch("/api/public/upload", { method: "POST", body: form });
    const j = await res.json();
    if (j.ok) {
      setCamStatus("captured");
      toast.success("Imagem registrada. SHA-256: " + hash.slice(0, 16) + "…");
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } else {
      toast.error("Falha ao enviar imagem.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Este acesso está sendo registrado tecnicamente para fins de investigação legítima.
        </div>

        {loading ? (
          <div className="text-muted-foreground">Carregando…</div>
        ) : !caseData ? (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            Link indisponível.
          </div>
        ) : (
          <>
            {caseData.image_url ? (
              <img src={caseData.image_url} alt="" className="mb-6 w-full rounded-lg border object-cover" />
            ) : null}
            <h1 className="text-2xl font-semibold">{caseData.title}</h1>
            {caseData.description ? (
              <p className="mt-2 text-muted-foreground">{caseData.description}</p>
            ) : null}
            {caseData.content ? (
              <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{caseData.content}</div>
            ) : null}

            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" /> Localização (opcional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  A localização só é obtida se você autorizar no navegador.
                </p>
                <Button onClick={requestGeolocation} disabled={geoStatus === "requesting" || geoStatus === "granted"}>
                  {geoStatus === "granted" ? (<><CheckCircle2 className="mr-2 h-4 w-4" />Autorizada</>) : "Autorizar localização"}
                </Button>
                {geoStatus === "denied" && <StatusRow ok={false} label="Permissão negada" />}
                {geoStatus === "error" && <StatusRow ok={false} label="Erro ao obter localização" />}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="h-4 w-4" /> Câmera (opcional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  A câmera só é ativada após sua autorização; a captura exige clique explícito.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => requestCamera("environment")}>Câmera traseira</Button>
                  <Button variant="outline" onClick={() => requestCamera("user")}>Câmera frontal</Button>
                </div>
                <div className="overflow-hidden rounded-md border bg-muted/40" style={{ minHeight: 200 }}>
                  <video ref={videoRef} playsInline muted className="w-full" />
                </div>
                {camStatus === "granted" && (
                  <Button onClick={capture}>Capturar imagem</Button>
                )}
                {camStatus === "captured" && <StatusRow ok={true} label="Imagem enviada" />}
                {camStatus === "denied" && <StatusRow ok={false} label="Permissão negada" />}
                {camStatus === "error" && <StatusRow ok={false} label="Erro ao acessar câmera" />}
              </CardContent>
            </Card>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              ID da sessão registrado no servidor.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${ok ? "text-emerald-600" : "text-destructive"}`}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {label}
    </div>
  );
}
