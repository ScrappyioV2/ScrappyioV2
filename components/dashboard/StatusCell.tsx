"use client";

import { useRouter } from "next/navigation";

type Props = {
  seller: string;
  stage: string;
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
};

export default function StatusCell({
  seller,
  stage,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: Props) {
  const router = useRouter();

  function go(status: string) {
    router.push(
      `/dashboard/details?seller=${encodeURIComponent(
        seller
      )}&stage=${stage}&status=${status}`
    );
  }

  return (
    <div className="border rounded p-3 text-xs bg-white">
      <div className="flex justify-between border-b pb-1 mb-2 text-gray-600">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      <div className="flex justify-between font-semibold">
        <button
          onClick={() => go(leftLabel.toLowerCase())}
          className="text-green-600 hover:underline"
        >
          {leftValue}
        </button>

        <button
          onClick={() => go(rightLabel.toLowerCase())}
          className="text-amber-600 hover:underline"
        >
          {rightValue}
        </button>
      </div>
    </div>
  );
}
