# Parâmetros para atualização do banco financeiro

Use migrations/finance-upgrade.sql como migração aditiva.

Regras obrigatórias:

- Não apagar, duplicar ou reclassificar transações existentes.
- Valores monetários são armazenados em centavos.
- owner_id representa a conta que criou o lançamento.
- family_id representa o workspace familiar.
- personal_scope=individual aparece apenas para a pessoa responsável.
- personal_scope=family aparece no total familiar.
- Dados antigos recebem status=paid.
- Recorrência deve criar novos lançamentos com novos IDs e manter metadata.source.
- Parcelamentos devem usar o mesmo split_group_id.
- Apenas membros autorizados do mesmo family_id podem ler lançamentos familiares.
- Toda alteração deve atualizar updated_at.

Campos previstos: status, recurrence, due_on, attachment_url,
split_group_id, notes, credit_limit_cents, closing_day e due_day.
