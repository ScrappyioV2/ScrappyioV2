"use client";

type ProgressItem = {
  country: string;
  copied: number;
  total: number;
};

export default function ScrapingProgressList({
  data,
}: {
  data: ProgressItem[];
}) {
  return (
    <div className="bg-[#111111] p-6 rounded-lg shadow mt-6">
      <h2 className="text-xl font-semibold mb-4">Scraping Progress</h2>
      <div className="space-y-4">
        {data.map((item) => {
          const percent = Math.round((item.copied / item.total) * 100);
          return (
            <div key={item.country}>
              <div className="flex justify-between mb-1">
                <span className="font-medium">{item.country}</span>
                <span className="text-sm text-gray-500">
                  {item.copied} / {item.total} ({percent}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
