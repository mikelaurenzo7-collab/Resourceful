import type { ApprovalEvent } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';

const actionLabels: Record<string, { label: string; color: string }> = {
  approved: { label: 'Approved', color: 'text-green-700 bg-green-50' },
  rejected: { label: 'Rejected', color: 'text-red-700 bg-red-50' },
  regenerate_section: { label: 'Regenerated Section', color: 'text-blue-700 bg-blue-50' },
  edit_section: { label: 'Edited Section', color: 'text-indigo-700 bg-indigo-50' },
  rerun_pipeline: { label: 'Reran Pipeline', color: 'text-purple-700 bg-purple-50' },
};

interface ApprovalAuditTrailProps {
  events: ApprovalEvent[];
}

export default function ApprovalAuditTrail({ events }: ApprovalAuditTrailProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No approval events yet.</p>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, idx) => {
          const config = actionLabels[event.action] ?? {
            label: event.action,
            color: 'text-gray-700 bg-gray-50',
          };
          const isLast = idx === events.length - 1;

          return (
            <li key={event.id}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a2744] ring-4 ring-white">
                      <span className="text-xs text-white font-medium">
                        {event.action[0].toUpperCase()}
                      </span>
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-0.5">
                    <div>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
                      >
                        {config.label}
                      </span>
                      {event.section_name && (
                        <span className="ml-2 text-xs text-gray-500">
                          Section: {event.section_name}
                        </span>
                      )}
                      {event.notes && (
                        <p className="mt-1 text-sm text-gray-600">{event.notes}</p>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-xs text-gray-500">
                      <time dateTime={event.created_at}>
                        {formatDistanceToNow(new Date(event.created_at), {
                          addSuffix: true,
                        })}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
