'use client';

import React from 'react';

// ─── Seller Tag Styles (all 8 sellers) ─────────────────────────────────
export const SELLER_STYLES: Record<string, string> = {
  GR: 'bg-yellow-500 text-white border border-yellow-600',
  RR: 'bg-slate-500 text-white border border-white/[0.1]',
  UB: 'bg-pink-500 text-white border border-pink-600',
  VV: 'bg-purple-500 text-white border border-purple-600',
  DE: 'bg-cyan-500 text-white border border-cyan-600',
  CV: 'bg-teal-500 text-white border border-teal-600',
  MV: 'bg-orange-600 text-white border border-orange-700',
  KL: 'bg-lime-500 text-white border border-lime-600',
};

// ─── Seller Tag Filter Styles (gradient for filter buttons) ────────────
export const SELLER_FILTER_STYLES: Record<string, string> = {
  GR: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg',
  RR: 'bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-lg',
  UB: 'bg-gradient-to-br from-pink-400 to-pink-600 text-white shadow-lg',
  VV: 'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg',
  DE: 'bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-lg',
  CV: 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-lg',
  MV: 'bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-lg',
  KL: 'bg-gradient-to-br from-lime-400 to-lime-600 text-white shadow-lg',
};

// ─── Funnel Styles ─────────────────────────────────────────────────────
export const FUNNEL_STYLES: Record<string, string> = {
  RS: 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30',
  DP: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg border border-amber-500/30',
  HD: 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30',
  LD: 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg border border-blue-600/30',
};

// ─── SellerTagBadge ────────────────────────────────────────────────────
interface SellerTagBadgeProps {
  tag: string;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}

export const SellerTagBadge: React.FC<SellerTagBadgeProps> = ({ tag, className, title, children }) => {
  const cleanTag = tag.trim().toUpperCase();
  return (
    <span
      title={title ?? cleanTag}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-lg font-bold text-xs ${SELLER_STYLES[cleanTag] || 'bg-[#1a1a1a] text-white'} ${className ?? ''}`}
    >
      {children ?? cleanTag}
    </span>
  );
};

// ─── SellerTagList ─────────────────────────────────────────────────────
interface SellerTagListProps {
  sellerTag: string | null | undefined;
  className?: string;
  badgeClassName?: string;
  renderBadge?: (tag: string) => React.ReactNode;
}

export const SellerTagList: React.FC<SellerTagListProps> = ({ sellerTag, className, badgeClassName, renderBadge }) => {
  if (!sellerTag) return <span className="text-gray-500">-</span>;

  const tags = sellerTag.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

  return (
    <div className={`flex flex-wrap gap-1.5 justify-center ${className ?? ''}`}>
      {tags.map(tag =>
        renderBadge ? (
          <React.Fragment key={tag}>{renderBadge(tag)}</React.Fragment>
        ) : (
          <SellerTagBadge key={tag} tag={tag} className={badgeClassName} />
        )
      )}
    </div>
  );
};

// ─── FunnelBadge ───────────────────────────────────────────────────────
interface FunnelBadgeProps {
  funnel: string | null | undefined;
  className?: string;
}

export const FunnelBadge: React.FC<FunnelBadgeProps> = ({ funnel, className }) => {
  if (!funnel) return <span className="text-gray-500">-</span>;

  const tag = funnel.trim().toUpperCase();

  return (
    <span className={`w-8 h-8 inline-flex items-center justify-center rounded-lg font-bold text-sm ${FUNNEL_STYLES[tag] ?? 'bg-gray-400 text-white'} ${className ?? ''}`}>
      {tag}
    </span>
  );
};