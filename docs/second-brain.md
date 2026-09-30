# Segundo Cérebro — Tools Digital V5

## Arquitetura
O módulo evolui a tabela `notes` existente e usa o Neon Data API autenticado como camada REST. Não existe um backend paralelo: as operações em `src/services/neon.js` validam sessão e o RLS do PostgreSQL garante isolamento por usuário.

## Dados
- `notes.type`: concept, book, event, project, moc
- `notes.properties`: JSONB com propriedades específicas do tipo
- `notes.tags`: array existente, indexado por GIN
- `note_links`: relações source/target únicas com FKs e cascade
- busca: índice GIN full-text em título + conteúdo

## Frontend
- `second-brain.js`: workspace/editor/backlinks/autocomplete
- `wikilinks.js`: parser e rename seguro
- `markdown.js`: preview Markdown seguro sem HTML arbitrário
- `knowledge-graph.js`: D3 carregado sob demanda somente na tela do grafo
- `note-templates.js`: tipos, templates e propriedades

## Testes
Requer Node 20+:

```bash
npm test
```

Os testes cobrem extração/rename/autocomplete de wikilinks e o contrato `{nodes, links}` do grafo.

## Uso
Digite `[[` no editor para localizar ou criar uma nota conectada. Salvar atualiza `note_links`. O painel **Citada por** consulta backlinks. A aba **Grafo** mostra o grafo global; **Grafo local** no editor restringe à nota atual e vizinhos diretos.

## Dependências
Não foi adicionado framework nem bundler. D3 v7 é a única biblioteca nova e é importada dinamicamente apenas quando o grafo é aberto.
