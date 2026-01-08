"use client";

type KpiItem = {
  label: string;
  value: number;
};

export default function KpiGrid({ data }: { data: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {data.map((kpi) => (
        <div
          key={kpi.label}
          className="border rounded-lg p-4 bg-white"
        >
          <p className="text-sm text-gray-500">{kpi.label}</p>
          <p className="text-2xl font-semibold mt-2">{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}
