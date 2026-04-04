"use client";

const actions = [
  "Add Seller",
  "Bulk Upload",
  "Dropship Products",
  "Manage Badges",
  "Export Reports"
];

export default function QuickActions() {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action}
            className="border rounded px-3 py-2 text-sm hover:bg-[#111111]"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
