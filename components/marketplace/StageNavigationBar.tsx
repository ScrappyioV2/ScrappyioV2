"use client";

import { useRouter } from "next/navigation";

type Props = {
  country: string;
};

const stages = [
  { label: "Brand Checking", slug: "brand-checking", color: "bg-blue-600" },
  { label: "Validation", slug: "validation", color: "bg-purple-600" },
  { label: "Admin Validation", slug: "admin-validation", color: "bg-orange-500/100" },
  { label: "Listing", slug: "listing", color: "bg-green-600" },
  { label: "Purchasing", slug: "purchasing", color: "bg-orange-600" },
  { label: "Reorder", slug: "reorder", color: "bg-red-600" },
];

export default function StageNavigationBar({ country }: Props) {
  const router = useRouter();

  return (
    <div className="bg-[#111111] p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Navigate by Stage</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stages.map((stage) => (
          <button
            key={stage.slug}
            onClick={() => router.push(`/dashboard/${country}/${stage.slug}`)}
            className={`${stage.color} text-white px-4 py-3 rounded-lg hover:opacity-90 transition font-medium`}
          >
            {stage.label}
          </button>
        ))}
      </div>
    </div>
  );
}
