-- Tools Digital Finance Upgrade
-- Migração aditiva para recorrência, status, divisão, anexos e cartões.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS due_on date,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS split_group_id uuid,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('paid','pending','overdue','cancelled'));

CREATE INDEX IF NOT EXISTS transactions_family_period_idx ON public.transactions(family_id, occurred_on);
CREATE INDEX IF NOT EXISTS transactions_status_due_idx ON public.transactions(status, due_on);
CREATE INDEX IF NOT EXISTS transactions_split_group_idx ON public.transactions(split_group_id);

ALTER TABLE public.finance_accounts
  ADD COLUMN IF NOT EXISTS credit_limit_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closing_day smallint,
  ADD COLUMN IF NOT EXISTS due_day smallint;

ALTER TABLE public.finance_accounts DROP CONSTRAINT IF EXISTS finance_accounts_days_check;
ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_days_check
  CHECK ((closing_day IS NULL OR closing_day BETWEEN 1 AND 31)
     AND (due_day IS NULL OR due_day BETWEEN 1 AND 31));

CREATE TABLE IF NOT EXISTS public.finance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  family_id uuid NULL,
  name text NOT NULL,
  target_cents bigint NOT NULL DEFAULT 0,
  current_cents bigint NOT NULL DEFAULT 0,
  deadline date NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_goals_status_check CHECK (status IN ('active','completed','paused')),
  CONSTRAINT finance_goals_target_check CHECK (target_cents >= 0 AND current_cents >= 0)
);

CREATE INDEX IF NOT EXISTS finance_goals_owner_idx ON public.finance_goals(owner_id);
CREATE INDEX IF NOT EXISTS finance_goals_family_idx ON public.finance_goals(family_id);

-- Parâmetros para IA/agente de banco:
-- 1. Preservar owner_id, family_id, finance_member_id e personal_scope.
-- 2. Nunca transformar uma transação individual em familiar automaticamente.
-- 3. family só pode ser usado quando o usuário pertence ao family_id.
-- 4. Dados antigos recebem status=paid.
-- 5. Valores monetários permanecem em centavos.
-- 6. metadata pode armazenar receipt_url, reminder_enabled,
--    split_members, installment_number, installment_total e source.
