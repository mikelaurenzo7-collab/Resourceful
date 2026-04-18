---
name: new-stage
description: Scaffold a new pipeline stage following the established pattern. Creates the stage file, updates the orchestrator registry, and generates a basic test file.
argument-hint: "[stage-number] [stage-name]"
model: sonnet
---

Scaffold a new pipeline stage: $ARGUMENTS

## What I'll Create

Given `$ARGUMENTS` (e.g., `9 county-appeal-filing`):

1. **Stage file**: `src/lib/pipeline/stages/stage9-county-appeal-filing.ts`
2. **Test file**: `src/lib/pipeline/stages/stage9-county-appeal-filing.test.ts`
3. **Update orchestrator**: Add entry to `STAGES` array in `src/lib/pipeline/orchestrator.ts`

## Stage File Template

Follow the exact pattern of existing stages:

```typescript
// ─── Stage N: [Name] ─────────────────────────────────────────────────────────
// [One-line description of what this stage does]

import { createAdminClient } from '@/lib/supabase/admin';
import type { StageResult } from '../orchestrator';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export async function run[PascalCaseName](
  reportId: string,
  supabase: SupabaseAdmin
): Promise<StageResult> {
  try {
    // TODO: implement stage logic

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

## Orchestrator Update

Add to the `STAGES` array in `src/lib/pipeline/orchestrator.ts`:

```typescript
{
  number: N,
  name: 'stage-N-[kebab-name]',
  // skipWhen: (propertyType) => propertyType === 'residential', // if conditional
  run: run[PascalCaseName],
},
```

## Rules to Follow
- Stage function signature must be `(reportId: string, supabase: SupabaseAdmin): Promise<StageResult>`
- All errors must be caught and returned as `{ success: false, error: string }`
- Never throw from a stage — the orchestrator expects a `StageResult` return
- If this stage calls an AI model, use `AI_MODELS.*` from `src/config/ai.ts`
- If this stage calls an external API, create a typed service function in `src/lib/services/`
- The stage key in `name` must be unique and follow the `stage-N-[description]` pattern

## Steps

1. Read `src/lib/pipeline/stages/stage1-data-collection.ts` for the current pattern
2. Read `src/lib/pipeline/orchestrator.ts` to find the STAGES array
3. Create the stage file with the template above
4. Update the STAGES array in the orchestrator
5. Create a minimal test file following the pattern in `src/lib/pipeline/orchestrator.test.ts`
