-- Prevent overlapping cron workers from sending the same outcome follow-up.
-- A claim is a short-lived lease, not proof that an email was sent.

alter table public.reports
  add column if not exists outcome_followup_claimed_at timestamptz;

comment on column public.reports.outcome_followup_claimed_at is
  'Short-lived worker lease for outcome follow-up delivery. Cleared after success or a handled failure; stale leases may be reclaimed.';

create index if not exists reports_outcome_followup_due_idx
  on public.reports (delivered_at)
  where status = 'delivered'
    and service_type = 'tax_appeal'
    and outcome_reported_at is null
    and outcome_followup_sent_at is null;
