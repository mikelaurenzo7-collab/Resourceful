---
name: debug-report
description: Diagnose a stuck or failed report pipeline. Fetches report state from the database, identifies the failing stage, and proposes a fix.
argument-hint: "[report-id]"
model: sonnet
---

Diagnose the report pipeline for report ID: $ARGUMENTS

## Steps

1. **Fetch report state** — run this query via the Supabase CLI or check the code:
   ```sql
   select id, status, pipeline_last_completed_stage, pipeline_error_log, property_address
   from reports
   where id = '<report-id>';
   ```

2. **Identify the stage** — `pipeline_last_completed_stage` tells us where it stopped. The NEXT stage is where the failure likely occurred.

   | Stage Key | File |
   |-----------|------|
   | `stage-1-data` | `src/lib/pipeline/stages/stage1-data-collection.ts` |
   | `stage-2-comps` | `src/lib/pipeline/stages/stage2-comparables.ts` |
   | `stage-3-income` | `src/lib/pipeline/stages/stage3-income-analysis.ts` |
   | `stage-4-photos` | `src/lib/pipeline/stages/stage4-photo-analysis.ts` |
   | `stage-5-narratives` | `src/lib/pipeline/stages/stage5-narratives.ts` |
   | `stage-6-filing` | `src/lib/pipeline/stages/stage6-filing-guide.ts` |
   | `stage-7-pdf` | `src/lib/pipeline/stages/stage7-pdf-assembly.ts` |
   | `stage-8-delivery` | `src/lib/pipeline/stages/stage8-delivery.ts` |

3. **Read `pipeline_error_log`** — parse the JSON for `error`, `stage`, `timestamp`, and `details`

4. **Read the failing stage source file** — look for the specific function that threw

5. **Check the relevant service** in `src/lib/services/` for external API issues

6. **Propose a fix** with:
   - The exact file and function to change
   - Whether the pipeline can be resumed (it can resume from `pipeline_last_completed_stage + 1`)
   - Any env var or external dependency that may need attention

## Common Issues

| Error Pattern | Likely Cause | Fix |
|---------------|--------------|-----|
| `ATTOM_ERROR` | API quota / bad address | Check `ATTOM_API_KEY` env var; verify address format |
| `AI_ERROR: JSON` | Model returned non-JSON | Add defensive JSON parsing with markdown stripping |
| `AI_ERROR: tokens` | Token limit exceeded | Increase `AI_TOKEN_LIMITS.*` or truncate input |
| `STORAGE_ERROR` | Supabase Storage upload failed | Check `SUPABASE_SERVICE_ROLE_KEY`; verify bucket exists |
| `PDF_ERROR` | Chromium OOM or template error | Check memory limits; validate HTML template for missing data |
| `LOCK_ERROR` | Pipeline lock not released | Check for orphaned lock in `pipeline_locks` table |
