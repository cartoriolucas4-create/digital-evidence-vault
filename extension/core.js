const STOPWORDS = new Set(['de','da','do','das','dos','e','em','no','na','nos','nas','a','o','as','os','para','por','com','sem','um','uma','ao','aos','à','às']);

export function normalizeText(value='') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
}

export function compactText(value='') {
  return normalizeText(value).replace(/[^a-z0-9]+/g,' ').trim();
}

export function tokenize(value='') {
  return compactText(value).split(' ').filter(Boolean).filter(t => !STOPWORDS.has(t));
}

export function similarity(a,b) {
  const A=new Set(tokenize(a)), B=new Set(tokenize(b));
  if(!A.size || !B.size) return 0;
  let inter=0; for(const t of A) if(B.has(t)) inter++;
  return inter / new Set([...A,...B]).size;
}

export function slug(value='') { return compactText(value).replace(/ /g,'-'); }

export function parseBulkEdict(text='') {
  const disciplines=[]; let current=null;
  for(const raw of text.split(/\r?\n/)) {
    const line=raw.trim().replace(/^[-*•\s]+/,'').replace(/^\*\*(.*?)\*\*$/,'$1').trim();
    if(!line) continue;
    const dm=line.match(/^DISCIPLINA\s*:\s*(.+)$/i);
    const sm=line.match(/^ASSUNTO\s*:\s*(.+)$/i);
    if(dm){ current={name:dm[1].trim(), subjects:[]}; disciplines.push(current); }
    else if(sm && current) current.subjects.push(sm[1].trim());
  }
  return disciplines.filter(d=>d.name && d.subjects.length).map(d=>({...d,subjects:[...new Set(d.subjects)]}));
}

export function mapSubject(subjectName, disciplineName, catalog) {
  const d = catalog.find(x => similarity(x.name, disciplineName) >= 0.8 || normalizeText(x.name)===normalizeText(disciplineName));
  if(!d) return {status:'unmatched',score:0,discipline:null,subject:null};
  const exactName=d.subjects.find(s=>normalizeText(s.name||s)===normalizeText(subjectName));
  if(exactName) return {status:'exact',score:1,discipline:d,subject:exactName};
  let best=null;
  for(const raw of d.subjects){ const subject=raw.name||raw; const score=similarity(subject,subjectName); if(!best||score>best.score) best={subject:raw,score}; }
  if(best && best.score>=0.55) return {status:'suggested',score:best.score,discipline:d,subject:best.subject};
  return {status:'unmatched',score:best?.score||0,discipline:d,subject:best?.subject||null};
}

export const BULK_PROMPT = `Você é responsável por transformar um edital de concurso no padrão de importação do Digital Evidence Vault.

REGRAS OBRIGATÓRIAS:
1. Identifique todas as disciplinas/matérias do edital.
2. Identifique todos os assuntos e subassuntos cobrados.
3. Preserve fielmente o conteúdo do edital. NÃO invente assuntos.
4. Agrupe cada assunto dentro da disciplina correta.
5. Remova apenas numerações hierárquicas desnecessárias (1., 1.1, 1.1.1 etc.).
6. Não inclua explicações, comentários, resumos ou observações.
7. Retorne SOMENTE neste formato:

DISCIPLINA: Nome da disciplina
ASSUNTO: Nome do assunto
ASSUNTO: Nome do assunto

DISCIPLINA: Outra disciplina
ASSUNTO: Nome do assunto
ASSUNTO: Nome do assunto

EDITAL:
[COLE AQUI O EDITAL COMPLETO]`;