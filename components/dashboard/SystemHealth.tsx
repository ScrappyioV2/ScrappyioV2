"use client";

export default function SystemHealth({ data }: any) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <HealthBar label="Seller Scraping Progress" value={data.scraping} />
      <HealthBar label="Copy Progress" value={data.copy} />
      <div className="border rounded-lg p-4">
        <p className="text-sm text-gray-500">Automation Status</p>
        <p className="text-lg font-semibold mt-2">{data.automationStatus}</p>
      </div>
    </div>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="w-full bg-gray-200 rounded h-2 mt-3">
        <div className="bg-black h-2 rounded" style={{ width: `${value}%` }} />
      </div>
      <p className="text-xs mt-2">{value}% Complete</p>
    </div>
  );
}
