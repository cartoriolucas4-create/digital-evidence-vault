(() => {
  const state = { lastUrl: location.href, lastSignature: "" };
  const send = (type, payload = {}) => chrome.runtime.sendMessage({ type, ...payload }).catch(() => {});
  const clean = (value = "") => String(value).replace(/\s+/g, " ").trim();
  const norm = (value = "") => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visible = (el) => {
    if (!el || !(el instanceof Element)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function getQuestionIdFromHref(href = "") {
    try {
      const u = new URL(href, location.href);
      const path = u.pathname;
      const m = path.match(/\/questoes(?:-de-concursos)?\/questoes\/([^/?#]+)/i);
      if (m?.[1]) return decodeURIComponent(m[1]);
      const q = u.searchParams.get("question_id") || u.searchParams.get("questionId");
      if (q) return q;
    } catch {}
    return "";
  }

  function extractQuestionIdFromText(text = "") {
    const m = clean(text).match(/(?:^|\s)Q(\d{5,10})(?=\s|$|[.,:;!?])/i);
    return m ? m[1] : "";
  }

  function findFilterContainer() {
    const labels = [...document.querySelectorAll("body *")].filter(visible);
    const label = labels.find(el => {
      const t = clean(el.textContent);
      return /^Filtrar por:?$/i.test(t) || /^Filtros?$/i.test(t);
    });
    return label?.parentElement?.parentElement || label?.parentElement || null;
  }

  function extractFilters() {
    const result = { discipline: "", subjects: [] };
    const root = findFilterContainer();
    const source = root || document.body;
    const texts = [...source.querySelectorAll("*")]
      .filter(visible)
      .map(el => clean(el.textContent))
      .filter(v => v && v.length < 300);

    for (const value of texts) {
      const dm = value.match(/^Disciplina\s*:?\s*(.+)$/i);
      if (dm && dm[1].length < 180) {
        result.discipline = dm[1].trim();
        break;
      }
    }

    const subjectValues = texts
      .filter(v => /^Assunto\s*:?\s+/i.test(v))
      .map(v => v.replace(/^Assunto\s*:?\s+/i, "").trim())
      .filter(v => v && v.length < 500);

    if (subjectValues.length) {
      const raw = subjectValues.sort((a, b) => a.length - b.length)[0];
      result.subjects = raw.split(/\s+\|\s+|\s*›\s*|\s*•\s*|\s*,\s*(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
        .map(clean).filter(Boolean);
    }

    // Fallback: look for common visible filter/chip structures.
    if (!result.discipline) {
      const candidate = [...document.querySelectorAll("button,[role=button],a,span,div")]
        .filter(visible)
        .map(el => clean(el.textContent))
        .find(v => /^(Direito|Português|Raciocínio|Contabilidade|Informática|Constitucional|Administrativo|Penal|Processual)/i.test(v) && v.length < 120);
      if (candidate) result.discipline = candidate;
    }

    return result;
  }

  function getQuestionAnchors() {
    const anchors = [...document.querySelectorAll("a[href]")];
    const result = [];
    const seen = new Set();
    for (const a of anchors) {
      const id = getQuestionIdFromHref(a.href) || extractQuestionIdFromText(a.textContent);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      result.push({ id, element: a });
    }

    // QConcursos list pages often render the Q1234567 identifier as text.
    for (const el of [...document.querySelectorAll("body *")]) {
      if (!visible(el)) continue;
      const id = extractQuestionIdFromText(el.textContent);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      result.push({ id, element: el });
    }
    return result;
  }

  function resultKind(text = "") {
    const t = clean(text);
    // These are the attempt-result signals. "Revisar questão" and history are ignored.
    if (/Parabéns!\s*Você acertou!?/i.test(t) || /\bVocê acertou!?/i.test(t)) return "correct";
    if (/^Incorreta\.?$/i.test(t) || /\bVocê errou!?/i.test(t)) return "wrong";
    return "";
  }

  function findQuestionCard(element, questionId) {
    let best = null;
    let node = element;
    for (let level = 0; node && level < 9; level++, node = node.parentElement) {
      if (!visible(node)) continue;
      const text = clean(node.innerText || node.textContent || "");
      if (!text || text.length > 28000) continue;
      const hasId = text.includes(questionId) || new RegExp("\\bQ?" + questionId + "\\b", "i").test(text);
      if (!hasId) continue;
      const hasResult = /Parabéns!\s*Você acertou|Você acertou|^Incorreta\.?$|Você errou/i.test(text);
      if (hasResult) {
        best = node;
        // Prefer the smallest useful container with a result.
        if (text.length < 9000) break;
      }
    }
    return best || element.closest("article,li") || element.parentElement;
  }

  function getResultElements(card) {
    return [...card.querySelectorAll("*")]
      .filter(visible)
      .map(el => ({ el, text: clean(el.textContent) }))
      .filter(x => x.text && (
        /Parabéns!\s*Você acertou!?/i.test(x.text) ||
        /^Incorreta\.?$/i.test(x.text) ||
        /\bVocê errou!?/i.test(x.text)
      ));
  }

  function extractQuestion(card, id, filters) {
    const cardText = clean(card?.innerText || card?.textContent || "");
    if (!cardText) return null;

    const resultElements = getResultElements(card);
    let kind = "";
    if (resultElements.length) {
      // The last result signal in the card corresponds to the most recent attempt/result.
      kind = resultKind(resultElements[resultElements.length - 1].text);
    }
    if (!kind) kind = resultKind(cardText);
    if (!kind) return null;

    const topicCandidates = cardText.split(/\n+/).map(clean).filter(Boolean);
    const topicLine = topicCandidates.find(x =>
      x.length < 400 &&
      !/^(Parabéns|Você acertou|Você errou|Incorreta|Alternativas|Comentários|Estatísticas|Cadernos|Criar anotações)/i.test(x) &&
      /Direito|Constitucional|Penal|Processual|Administrativo|Português|Raciocínio|Contabilidade|Informática|Ética|Direitos/i.test(x)
    ) || "";

    const parts = topicLine.split(/\s*›\s*/).map(clean).filter(Boolean);
    const lowerTopic = norm(topicLine);
    const matched = filters.subjects.filter(s => lowerTopic.includes(norm(s)));
    const selectedSubject = matched[0] || filters.subjects[0] || "";

    return {
      questionId: String(id),
      correct: kind === "correct",
      answered: true,
      result: kind,
      discipline: parts[0] || filters.discipline,
      filterDiscipline: filters.discipline,
      filterSubject: selectedSubject,
      filterSubjects: filters.subjects,
      matchedFilterSubjects: matched,
      topicPath: parts.slice(1),
      studyDate: new Date().toISOString().slice(0, 10),
      url: location.href,
      selectionReason: "última questão da página com resultado da tentativa atual"
    };
  }

  function extractQuestions() {
    const filters = extractFilters();
    const anchors = getQuestionAnchors();
    const candidates = [];

    for (const item of anchors) {
      const card = findQuestionCard(item.element, item.id);
      const q = extractQuestion(card, item.id, filters);
      if (q) candidates.push(q);
    }

    // Fallback for a single-question page where the identifier is in the URL but not rendered.
    if (!candidates.length) {
      const urlId = getQuestionIdFromHref(location.href);
      if (urlId) {
        const q = extractQuestion(document.body, urlId, filters);
        if (q) candidates.push(q);
      }
    }

    // The required selection rule: last qualifying question in page order.
    const selected = candidates.length ? [candidates[candidates.length - 1]] : [];
    return { filters, questions: selected, detectedQuestions: candidates.length, url: location.href };
  }

  function emit(force = false) {
    const data = extractQuestions();
    const signature = JSON.stringify({
      url: data.url,
      filters: data.filters,
      questions: data.questions.map(q => [q.questionId, q.result])
    });
    if (!force && signature === state.lastSignature) return;
    state.lastSignature = signature;
    send("PAGE_STATE", { state: data });
  }

  function installFloating() {
    if (document.getElementById("msk-qc-floating")) return;
    const b = document.createElement("button");
    b.id = "msk-qc-floating";
    b.textContent = "MSK";
    Object.assign(b.style, {
      position:"fixed", right:"18px", bottom:"18px", zIndex:"2147483647",
      border:"1px solid rgba(255,255,255,.14)", borderRadius:"999px",
      background:"#15181d", color:"#f2c46d", padding:"9px 13px",
      font:"700 12px system-ui", boxShadow:"0 8px 28px rgba(0,0,0,.35)", cursor:"pointer"
    });
    b.title = "Abrir painel MSK";
    b.onclick = () => send("OPEN_PANEL");
    document.documentElement.appendChild(b);
  }

  function observe() {
    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => emit(), 450);
    };
    new MutationObserver(schedule).observe(document.body, { subtree:true, childList:true, characterData:true });
    window.addEventListener("popstate", schedule);
    window.addEventListener("hashchange", schedule);
    setInterval(() => {
      if (location.href !== state.lastUrl) {
        state.lastUrl = location.href;
        state.lastSignature = "";
        schedule();
      }
    }, 700);
  }

  installFloating();
  emit(true);
  observe();
})();