'use server';

import { isFounderEmail } from '@/config/founders';
import { runJurisdictionOperationsReconciliation } from '@/lib/operations/jurisdiction-operations';
import {
  createOperationsAdminClient,
  type OperationsTaskInsert,
} from '@/lib/operations/types';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const taskMutationSchema = z.object({
  taskId: z.string().uuid(),
  action: z.enum(['start', 'block', 'snooze', 'resolve', 'dismiss', 'reopen']),
});

type AdminActor = {
  userId: string;
  email: string;
};

async function requireAdminActor(): Promise<AdminActor> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user || !user.email) throw new Error('Not authenticated');

  const { data: admin } = await authClient
    .from('admin_users')
    .select('email')
    .eq('user_id', user.id)
    .maybeSingle();

  const normalizedSessionEmail = user.email.toLowerCase().trim();
  const normalizedAdminEmail = admin?.email?.toLowerCase().trim();
  const founder = isFounderEmail(normalizedSessionEmail);

  if (!founder && (!normalizedAdminEmail || normalizedAdminEmail !== normalizedSessionEmail)) {
    throw new Error('Not authorized — admin access required');
  }

  return { userId: user.id, email: normalizedSessionEmail };
}

export async function runJurisdictionScanAction(): Promise<void> {
  await requireAdminActor();
  await runJurisdictionOperationsReconciliation();
  revalidatePath('/admin/operations');
  revalidatePath('/admin/counties');
}

export async function mutateOperationsTaskAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const parsed = taskMutationSchema.safeParse({
    taskId: formData.get('taskId'),
    action: formData.get('action'),
  });

  if (!parsed.success) throw new Error('Invalid operations task action');

  const now = new Date();
  const actorFields: Pick<
    OperationsTaskInsert,
    'last_actor_type' | 'last_actor_id' | 'last_actor_email' | 'automation_run_id'
  > = {
    last_actor_type: 'admin',
    last_actor_id: actor.userId,
    last_actor_email: actor.email,
    automation_run_id: null,
  };

  let update: Partial<OperationsTaskInsert>;
  switch (parsed.data.action) {
    case 'start':
      update = {
        status: 'in_progress',
        resolved_at: null,
        resolution_code: null,
        resolution_notes: null,
        snoozed_until: null,
        ...actorFields,
      };
      break;
    case 'block':
      update = {
        status: 'blocked',
        resolved_at: null,
        resolution_code: null,
        resolution_notes: null,
        snoozed_until: null,
        ...actorFields,
      };
      break;
    case 'snooze':
      update = {
        status: 'snoozed',
        snoozed_until: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        resolved_at: null,
        resolution_code: null,
        resolution_notes: null,
        ...actorFields,
      };
      break;
    case 'resolve':
      update = {
        status: 'resolved',
        resolved_at: now.toISOString(),
        resolution_code: 'admin_resolved',
        resolution_notes: 'Resolved from the operations console.',
        snoozed_until: null,
        ...actorFields,
      };
      break;
    case 'dismiss':
      update = {
        status: 'dismissed',
        resolved_at: now.toISOString(),
        resolution_code: 'admin_dismissed',
        resolution_notes: 'Dismissed from the operations console.',
        snoozed_until: null,
        ...actorFields,
      };
      break;
    case 'reopen':
      update = {
        status: 'open',
        resolved_at: null,
        resolution_code: null,
        resolution_notes: null,
        snoozed_until: null,
        ...actorFields,
      };
      break;
    default:
      throw new Error('Unsupported operations task action');
  }

  const supabase = createOperationsAdminClient();
  const { data: updatedTask, error } = await supabase
    .from('operations_tasks')
    .update(update)
    .eq('id', parsed.data.taskId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Failed to update operations task: ${error.message}`);
  if (!updatedTask) throw new Error('Operations task not found');

  revalidatePath('/admin/operations');
}
