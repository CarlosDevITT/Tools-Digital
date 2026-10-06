-- Tools Digital · AI Operations v1
-- Apply to Neon after review. Source of truth for agents/tasks/runs/approvals/logs.
create table if not exists ai_agents (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, workspace_id uuid null,
 name text not null, role text not null, status text not null default 'idle' check(status in ('idle','working','approval','blocked','error')),
 autonomy text not null default 'manual' check(autonomy in ('manual','assisted','autonomous')),
 tools jsonb not null default '[]'::jsonb, config jsonb not null default '{}'::jsonb, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists ai_tasks (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, workspace_id uuid null, project_id uuid null,
 title text not null, description text not null default '', assigned_agent_id uuid references ai_agents(id) on delete set null,
 status text not null default 'backlog' check(status in ('backlog','running','approval','done','blocked','failed')),
 priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
 input jsonb not null default '{}'::jsonb, output jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz null
);
create table if not exists ai_runs (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, task_id uuid not null references ai_tasks(id) on delete cascade,
 agent_id uuid references ai_agents(id) on delete set null, status text not null default 'queued',
 started_at timestamptz, finished_at timestamptz, tool_calls jsonb not null default '[]'::jsonb,
 tokens_in bigint not null default 0, tokens_out bigint not null default 0, cost_cents bigint not null default 0, error text
);
create table if not exists ai_approvals (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, task_id uuid not null references ai_tasks(id) on delete cascade,
 action text not null, payload jsonb not null default '{}'::jsonb, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 decided_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists ai_activity_logs (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, workspace_id uuid null, agent_id uuid null references ai_agents(id) on delete set null,
 task_id uuid null references ai_tasks(id) on delete set null, event_type text not null, message text not null,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists ai_agents_owner_idx on ai_agents(owner_id,active);
create index if not exists ai_tasks_owner_status_idx on ai_tasks(owner_id,status,updated_at desc);
create index if not exists ai_runs_task_idx on ai_runs(task_id,started_at desc);
create index if not exists ai_approvals_owner_status_idx on ai_approvals(owner_id,status,created_at desc);
create index if not exists ai_activity_owner_idx on ai_activity_logs(owner_id,created_at desc);
-- RLS: Data API should expose these only after policies are applied using the auth-user expression used by this project's existing migrations.
alter table ai_agents enable row level security;
alter table ai_tasks enable row level security;
alter table ai_runs enable row level security;
alter table ai_approvals enable row level security;
alter table ai_activity_logs enable row level security;
