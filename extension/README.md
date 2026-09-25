# MSK QConcursos → Digital Evidence Vault

Extensão Chrome MV3 para capturar sessões do QConcursos e registrar questões no Digital Evidence Vault sem inflar a contagem por múltiplos assuntos.

## Fluxo
1. Cadastre o edital em lote usando o mesmo prompt do site.
2. Abra o QConcursos e use normalmente os filtros de disciplina/assunto.
3. Resolva as questões. A extensão captura o contexto do filtro e o ID da questão quando disponível.
4. O painel lateral permanece disponível e a fila fica salva em `chrome.storage.local`, portanto fechar o painel não apaga a sessão.
5. Conecte ao Vault usando a sessão já aberta no site; a extensão não pede senha.
6. Confira e exporte. O banco usa `external_question_id + external_source` para impedir reimportação da mesma questão.

## Instalação local
Chrome → `chrome://extensions` → Modo do desenvolvedor → Carregar sem compactação → selecione esta pasta.

## Observação
O QConcursos pode alterar o HTML/estrutura da página. Os seletores desta versão usam heurísticas e múltiplos sinais (ID, filtro, resultado e observaão de mudanças), evitando depender de uma unica classe CSS.
