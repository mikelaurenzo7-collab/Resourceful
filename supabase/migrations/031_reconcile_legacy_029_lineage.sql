-- 031_reconcile_legacy_029_lineage.sql
--
-- Two historical repository files shared version 029. A remote database may
-- therefore have recorded either the outcome-follow-up lease change or the
-- email-only RLS change under the same migration version. This forward-only,
-- idempotent reconciliation guarantees that both contracts exist regardless
-- of which legacy file a given environment applied.

-- Outcome follow-up worker lease ------------------------------------------------

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

-- Email-only authenticated access ----------------------------------------------

alter table public.attorney_referrals enable row level security;
alter table public.form_submissions enable row level security;

drop policy if exists "attorney_referrals_user_select" on public.attorney_referrals;

create policy "attorney_referrals_user_select"
  on public.attorney_referrals for select to authenticated
  using (
    report_id in (
      select id
      from public.reports
      where auth.uid() = user_id
         or (
           user_id is null
           and client_email is not null
           and (auth.jwt() ->> 'email') = client_email
         )
    )
  );

drop policy if exists "form_submissions_user_select" on public.form_submissions;

create policy "form_submissions_user_select"
  on public.form_submissions for select to authenticated
  using (
    report_id in (
      select id
      from public.reports
      where auth.uid() = user_id
         or (
           user_id is null
           and client_email is not null
           and (auth.jwt() ->> 'email') = client_email
         )
    )
  );
