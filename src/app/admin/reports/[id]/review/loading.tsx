export default function ReviewLoading() {
  return (
    <div className="p-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-96 bg-gray-100 rounded" />
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-32 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
