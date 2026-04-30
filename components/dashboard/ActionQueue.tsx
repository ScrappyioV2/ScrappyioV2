"use client";

type ActionItem = {
  label: string;
  count: number;
  status: string;
};

export default function ActionQueue({ data }: { data: ActionItem[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "danger":
        return "bg-red-100 text-red-800 border-red-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "error":
        return "bg-red-200 text-red-900 border-red-400";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "success":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-[#1a1a1a] text-gray-100 border-white/[0.1]";
    }
  };

  return (
    <div className="bg-[#111111] p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Action Queue</h2>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div
            key={index}
            className={`p-4 rounded border-l-4 flex justify-between items-center ${getStatusColor(
              item.status
            )}`}
          >
            <span className="font-medium">{item.label}</span>
            <span className="text-2xl font-bold">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
