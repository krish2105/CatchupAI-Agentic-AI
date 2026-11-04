-- Model fallback chain (batch A): when the primary model hits its daily quota, is overloaded or times out,
-- the run is retried once on a second model. agent_runs.model then names the model that produced the result;
-- these columns record which model was tried first and why it was abandoned.
-- agent_runs stays server-written: students keep table-level SELECT through the existing owner-only policy
-- and still have no INSERT/UPDATE grant, so they can read but never forge these values.
alter table public.agent_runs
  add column fallback_from text check (fallback_from is null or char_length(fallback_from) between 1 and 100),
  add column fallback_reason text check (
    fallback_reason is null
    or fallback_reason in ('model_quota', 'model_busy', 'model_overloaded', 'provider_timeout', 'attempt_timeout')
  ),
  add constraint agent_runs_fallback_pair check ((fallback_from is null) = (fallback_reason is null));
