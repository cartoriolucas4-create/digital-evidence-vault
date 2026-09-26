import { parseBulkEdict, mapSubject } from "./core.js";

const BULK_PROMPT = "Você é responsável por transformar um edital de concurso no padrão de importação do Digital Evidence Vault.\n\nREGRAS OBRIGATÓRIAS:\n1. Identifique todas as disciplinas/matérias do edital.\n2. Identifique todos os assuntos e subassuntos cobrados.\n3. Preserve fielmente o conteúdo do edital. NÃO invente assuntos.\n4. Agrupe cada assunto dentro da disciplina correta.\n5. Remova apenas numerações hierárquicas desnecessárias (1., 1.1, 1.1.1 etc.).\n6. Não inclua explicações, comentários, resumos ou observações.\n7. Retorne SOMENTE neste formato:\n\nDISCIPLINA: Nome da disciplina\nASSUNTO: Nome do assunto\nASSUNTO: Nome do assunto\n\nDISCIPLINA: Outra disciplina\nASSUNTO: Nome do assunto\nASSUNTO: Nome do assunto\n\nEDITAL:\n[COLE AQUI O EDITAL COMPLETO]";

const $ = (selector) => document.querySelector(selector);
const send = (type, payload = {}) => chrome.runtime.sendMessage({ type, ...payload });

function parseBulk(text) {
  return parseBulkEdict(text);
}

function renderMapping(st) {
  const catalog = st.edital || [];
  const list = $("#mappingList");
  const groups = [...new Map(
    (st.sessionQueue || [])
      .filter(q => q.filterDiscipline && q.filterSubject)
      .map(q => [q.filterDiscipline + "\u0000" + q.filterSubject, q])
  ).values()];

  list.innerHTML = "";

  if (!catalog.length) {
    list.innerHTML = '<div class="mapping-empty">Cadastre o edital em lote para ativar a conferência automática.</div>';
    return;
  }

  if (!groups.length) {
    list.innerHTML = '<div class="mapping-empty">Os assuntos aparecerão aqui conforme as questões forem capturadas.</div>';
    return;
  }

  for (const q of groups) {
    const m = mapSubject(q.filterSubject, q.filterDiscipline, catalog);
    const key = q.filterDiscipline + "\u0000" + q.filterSubject;
    const override = st.mappingOverrides?.[key];
    const discipline = m.discipline;
    const options = discipline?.subjects || [];
    const suggested = m.subject?.name || m.subject || "";
    const selected = override || ((m.status === "exact" || m.status === "suggested") ? suggested : "");

    const row = document.createElement("div");
    row.className = "mapping-row";

    const label = document.createElement("div");
    label.className = "names";
    label.innerHTML = "<b>" + q.filterDiscipline + "</b><br><span>" + q.filterSubject +
      "</span> <span class=\"" + (selected ? "mapping-ok" : "mapping-warn") + "\">" +
      (selected ? "→ mapeado" : "→ confirmar") + "</span>";
    row.appendChild(label);

    const select = document.createElement("select");
    select.innerHTML =
      '<option value="">Selecione o assunto do edital…</option>' +
      options.map(x => {
        const n = x.name || x;
        const safe = String(n).replaceAll('"', "&quot;");
        return '<option value="' + safe + '" ' + (n === selected ? "selected" : "") + ">" + n + "</option>";
      }).join("");

    select.onchange = async () => {
      const next = { ...(st.mappingOverrides || {}) };
      if (select.value) next[key] = select.value;
      else delete next[key];
      const response = await send("SET_STATE", { patch: { mappingOverrides: next } });
      if (!response?.ok) {
        show(response?.error || "Não foi possível salvar o mapeamento.", true);
        return;
      }
      await render();
    };

    row.appendChild(select);
    list.appendChild(row);
  }
}

async function render() {
  try {
    const st = await send("GET_STATE");
    if (!st) return;

    const queue = st.sessionQueue || [];
    $("#total").textContent = queue.length;
    $("#answered").textContent = queue.filter(q => q.answered).length;
    $("#hits").textContent = queue.filter(q => q.correct).length;
    $("#sessionCount").textContent = queue.length;

    const session = st.activeSession;
    $("#sessionTitle").textContent = session?.discipline || "Nenhuma sessão";
    $("#sessionMeta").textContent = session?.subjects?.length
      ? "Filtro: " + session.subjects.join(" • ")
      : "Abra o QConcursos e resolva questões.";

    $("#capture").checked = st.captureEnabled !== false;
    $("#authBadge").textContent =
      st.authAccessToken && st.authExpiresAt > Date.now() + 30000
        ? "conectado"
        : "desconectado";

    const exportInfo = st.lastExport;
    if (exportInfo) {
      $("#exportResult").textContent =
        "Última exportação: " + exportInfo.ready + "/" + exportInfo.total +
        " questões processadas" +
        (exportInfo.skipped ? " • " + exportInfo.skipped + " pendentes." : ".");
    }

    const editalText = (st.edital || [])
      .map(d => "DISCIPLINA: " + d.name + "\n" + d.subjects.map(s => "ASSUNTO: " + s).join("\n"))
      .join("\n\n");

    if (document.activeElement !== $("#bulk")) {
      $("#bulk").value = editalText;
    }

    const parsed = parseBulk($("#bulk").value);
    $("#bulkCount").textContent = parsed.length
      ? parsed.length + " disciplinas • " + parsed.reduce((n, d) => n + d.subjects.length, 0) + " assuntos"
      : "Nenhum edital carregado";

    renderMapping(st);

    if (st.editalSavedAt) {
      const savedCount = (st.edital || []).reduce((n, d) => n + d.subjects.length, 0);
      $("#saveState").textContent = "✓ Edital salvo • " + (st.edital || []).length + " disciplinas • " + savedCount + " assuntos";
      $("#saveState").className = "save-state show";
    }
  } catch (error) {
    show(error?.message || "Erro ao atualizar o painel.", true);
  }
}

$("#refresh").onclick = render;

$("#copyPrompt").onclick = async () => {
  try {
    await navigator.clipboard.writeText(BULK_PROMPT);
    show("Prompt copiado. Cole no ChatGPT junto com seu edital.");
  } catch {
    show("Não foi possível copiar automaticamente o prompt.", true);
  }
};

$("#bulk").addEventListener("input", () => {
  const parsed = parseBulk($("#bulk").value);
  $("#bulkCount").textContent = parsed.length
    ? parsed.length + " disciplinas • " + parsed.reduce((n, d) => n + d.subjects.length, 0) + " assuntos"
    : "Nenhum edital carregado";
  $("#saveState").className = "save-state";
});

$("#saveBulk").onclick = async () => {
  const button = $("#saveBulk");
  const stateEl = $("#saveState");
  const raw = $("#bulk").value;
  const parsed = parseBulk(raw);

  if (!parsed.length) {
    stateEl.textContent = "✕ Não foi possível salvar. Use o formato DISCIPLINA: / ASSUNTO:.";
    stateEl.className = "save-state show";
    show("Cole o edital no formato exigido antes de salvar.", true);
    return;
  }

  const totalSubjects = parsed.reduce((n, d) => n + d.subjects.length, 0);
  button.disabled = true;
  stateEl.textContent = "Salvando edital…";
  stateEl.className = "save-state show";

  try {
    const response = await send("SET_STATE", {
      patch: {
        edital: parsed,
        mappingOverrides: {},
        editalSavedAt: new Date().toISOString()
      }
    });

    if (!response?.ok) {
      throw new Error(response?.error || "A extensão não confirmou a gravação.");
    }

    const verify = await send("GET_STATE");
    const savedDisciplines = verify?.edital?.length || 0;
    const savedSubjects = (verify?.edital || []).reduce((n, d) => n + d.subjects.length, 0);

    if (savedDisciplines !== parsed.length || savedSubjects !== totalSubjects) {
      throw new Error("A verificação encontrou diferença na quantidade salva.");
    }

    stateEl.textContent = "✓ Edital salvo com sucesso • " + savedDisciplines +
      " disciplinas • " + savedSubjects + " assuntos";
    stateEl.className = "save-state show";
    show("✓ Edital salvo e confirmado.");
    await render();
  } catch (error) {
    stateEl.textContent = "✕ Falha ao salvar: " + (error?.message || error);
    stateEl.className = "save-state show";
    show(error?.message || "Falha ao salvar o edital.", true);
  } finally {
    button.disabled = false;
  }
};

$("#capture").onchange = async (event) => {
  const response = await send("SET_STATE", { patch: { captureEnabled: event.target.checked } });
  if (!response?.ok) {
    show(response?.error || "Não foi possível alterar a captura.", true);
  }
};

$("#connect").onclick = async () => {
  show("Conectando ao Vault…");
  const response = await send("REQUEST_SITE_SESSION");
  if (!response?.ok) {
    show(response?.error || "Não foi possível conectar ao Vault.", true);
    return;
  }
  setTimeout(render, 1000);
  setTimeout(render, 2500);
};

$("#export").onclick = async () => {
  show("Exportando questões únicas…");
  const response = await send("EXPORT");
  if (response?.ok) {
    show("✓ Exportação concluída: " + response.ready + " questões.");
  } else {
    show(response?.error || "Falha na exportação.", true);
  }
  await render();
};

function show(message, error = false) {
  const el = $("#status");
  el.textContent = message;
  el.className = "status show";
  el.style.borderColor = error ? "#6b3b3b" : "#3d4652";
  el.style.color = error ? "#ff9d9d" : "#bfc6d0";
  clearTimeout(show.timer);
  show.timer = setTimeout(() => el.className = "status", 5000);
}

$("#version").textContent = "v1.1.0";
render();
setInterval(render, 3000);
chrome.storage.onChanged.addListener(render);