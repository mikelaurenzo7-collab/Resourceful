-- Replace advisory locks with row-level pipeline locking.
-- Advisory locks are session-scoped and unreliable with connection poolers.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS pipeline_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_lock_owner text;

-- Atomic lock acquisition: only succeeds if not currently locked or lock is stale (>15 min)
CREATE OR REPLACE FUNCTION acquire_pipeline_lock_v2(p_report_id uuid, p_owner text DEFAULT 'pipeline')
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  locked boolean;
BEGIN
  UPDATE reports
  SET pipeline_locked_at = now(),
      pipeline_lock_owner = p_owner
  WHERE id = p_report_id
    AND (pipeline_locked_at IS NULL OR pipeline_locked_at < now() - interval '15 minutes')
  RETURNING true INTO locked;

  RETURN COALESCE(locked, false);
END;
$$;

-- Release lock
CREATE OR REPLACE FUNCTION release_pipeline_lock_v2(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE reports
  SET pipeline_locked_at = NULL,
      pipeline_lock_owner = NULL
  WHERE id = p_report_id;
END;
$$;
