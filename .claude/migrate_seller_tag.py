import os, glob

CHANGES = []

def edit(path, old, new, tag):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new, 1)
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(content)
        CHANGES.append("  [{}] {}".format(tag, path))
        return True
    CHANGES.append("  [SKIP-{}] {} (pattern not found)".format(tag, path))
    return False

def replace_all(path, old, new, tag):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if old in content:
        count = content.count(old)
        content = content.replace(old, new)
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(content)
        CHANGES.append("  [{}] {} ({} replacements)".format(tag, path, count))
        return True
    return False

IMPORT_OLD_UTILS = "import { ensureAbsoluteUrl } from '@/lib/utils';"
IMPORT_NEW_UTILS = "import { ensureAbsoluteUrl } from '@/lib/utils';\nimport { SELLER_STYLES } from '@/components/shared/SellerTag';"

IMPORT_OLD_LOGGER = "import { useActivityLogger } from '@/lib/hooks/useActivityLogger';"
IMPORT_NEW_LOGGER = "import { useActivityLogger } from '@/lib/hooks/useActivityLogger';\nimport { SELLER_STYLES } from '@/components/shared/SellerTag';"

IMPORT_OLD_SUPA = "import { supabase } from '@/lib/supabaseClient';"
IMPORT_NEW_SUPA = "import { supabase } from '@/lib/supabaseClient';\nimport { SELLER_STYLES } from '@/components/shared/SellerTag';"

# ====== GROUP A: India Purchases ======
fp = 'app/dashboard/india-selling/purchases/page.tsx'
edit(fp, IMPORT_OLD_UTILS, IMPORT_NEW_UTILS, 'A1')

A2_old = """                  const cleanTag = tag.trim();
                  let badgeColor = 'bg-[#1a1a1a] text-white';
                  if (cleanTag === 'GR') badgeColor = 'bg-yellow-500 text-black border border-yellow-600';
                  else if (cleanTag === 'RR') badgeColor = 'bg-slate-500 text-white border border-white/[0.1]';
                  else if (cleanTag === 'UB') badgeColor = 'bg-pink-500 text-white border border-pink-600';
                  else if (cleanTag === 'VV') badgeColor = 'bg-purple-500 text-white border border-purple-600';
                  else if (cleanTag === 'DE') badgeColor = 'bg-cyan-500 text-black border border-cyan-600';
                  else if (cleanTag === 'CV') badgeColor = 'bg-teal-500 text-white border border-teal-600';
                  else if (cleanTag === 'MV') badgeColor = 'bg-orange-600 text-white border border-orange-700';
                  else if (cleanTag === 'KL') badgeColor = 'bg-lime-500 text-black border border-lime-600';
                  return <span key={cleanTag} className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs ${badgeColor}`}>{cleanTag}</span>;"""
A2_new = """                  const cleanTag = tag.trim();
                  return <span key={cleanTag} className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs ${SELLER_STYLES[cleanTag] || 'bg-[#1a1a1a] text-white'}`}>{cleanTag}</span>;"""
edit(fp, A2_old, A2_new, 'A2')

A3_old = """        const qtyTagColors: Record<string, string> = {
          GR: 'bg-yellow-500 text-black border border-yellow-600',
          RR: 'bg-slate-500 text-white border border-white/[0.1]',
          UB: 'bg-pink-500 text-white border border-pink-600',
          VV: 'bg-purple-500 text-white border border-purple-600',
          DE: 'bg-cyan-500 text-black border border-cyan-600',
          CV: 'bg-teal-500 text-white border border-teal-600',
          MV: 'bg-orange-600 text-white border border-orange-700',
          KL: 'bg-lime-500 text-black border border-lime-600',
        };"""
A3_new = "        const qtyTagColors = SELLER_STYLES;"
edit(fp, A3_old, A3_new, 'A3')

# ====== GROUP B: India Admin-Validation ======
fp = 'app/dashboard/india-selling/admin-validation/page.tsx'
edit(fp, IMPORT_OLD_LOGGER, IMPORT_NEW_LOGGER, 'B1')

B2_old = """                  const cleanTag = tag.trim();
                  let badgeColor = 'bg-slate-600 text-white';
                  if (cleanTag === 'GR') badgeColor = 'bg-yellow-500 text-black';
                  else if (cleanTag === 'RR') badgeColor = 'bg-slate-500 text-white';
                  else if (cleanTag === 'UB') badgeColor = 'bg-pink-500 text-white';
                  else if (cleanTag === 'VV') badgeColor = 'bg-purple-500 text-white';
                  else if (cleanTag === 'DE') badgeColor = 'bg-cyan-500 text-black';
                  else if (cleanTag === 'CV') badgeColor = 'bg-teal-500 text-white';
                  else if (cleanTag === 'MV') badgeColor = 'bg-orange-600 text-white';
                  else if (cleanTag === 'KL') badgeColor = 'bg-lime-500 text-black';
                  return (
                    <span key={cleanTag} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${badgeColor}`}>
                      {cleanTag}
                    </span>
                  );"""
B2_new = """                  const cleanTag = tag.trim();
                  return (
                    <span key={cleanTag} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${SELLER_STYLES[cleanTag] || 'bg-slate-600 text-white'}`}>
                      {cleanTag}
                    </span>
                  );"""
edit(fp, B2_old, B2_new, 'B2')

# ====== GROUP C: USA/UK/UAE/Flipkart Purchases ======
C2_old = """                              const cleanTag = tag.trim();
                              let badgeColor = 'bg-[#1a1a1a] text-white';
                              if (cleanTag === 'GR') badgeColor = 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
                              else if (cleanTag === 'RR') badgeColor = 'bg-slate-600 text-gray-100 border border-slate-500';
                              else if (cleanTag === 'UB') badgeColor = 'bg-pink-500/20 text-pink-300 border border-pink-500/30';
                              else if (cleanTag === 'VV') badgeColor = 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
                              return <span key={cleanTag} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${badgeColor}`}>{cleanTag}</span>"""
C2_new = """                              const cleanTag = tag.trim();
                              return <span key={cleanTag} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${SELLER_STYLES[cleanTag] || 'bg-[#1a1a1a] text-white'}`}>{cleanTag}</span>"""

for mp in ['usa-selling', 'uk-selling', 'uae-selling', 'flipkart']:
    fp = 'app/dashboard/{}/purchases/page.tsx'.format(mp)
    edit(fp, IMPORT_OLD_UTILS, IMPORT_NEW_UTILS, 'C1-' + mp)
    edit(fp, C2_old, C2_new, 'C2-' + mp)

# ====== GROUP D: USA/UK/UAE/Flipkart Admin-Validation ======
D2_old = """                              const cleanTag = tag.trim();
                              let badgeColor = 'bg-[#1a1a1a] text-white';
                              if (cleanTag === 'GR') badgeColor = 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
                              else if (cleanTag === 'RR') badgeColor = 'bg-slate-600 text-gray-100 border border-slate-500';
                              else if (cleanTag === 'UB') badgeColor = 'bg-pink-500/20 text-pink-300 border border-pink-500/30';
                              else if (cleanTag === 'VV') badgeColor = 'bg-purple-500/20 text-purple-300 border border-purple-500/30';

                              return (
                                <span
                                  key={cleanTag}
                                  className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${badgeColor}`}
                                >
                                  {cleanTag}"""
D2_new = """                              const cleanTag = tag.trim();

                              return (
                                <span
                                  key={cleanTag}
                                  className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${SELLER_STYLES[cleanTag] || 'bg-[#1a1a1a] text-white'}`}
                                >
                                  {cleanTag}"""

for mp in ['usa-selling', 'uk-selling', 'uae-selling', 'flipkart']:
    fp = 'app/dashboard/{}/admin-validation/page.tsx'.format(mp)
    edit(fp, IMPORT_OLD_LOGGER, IMPORT_NEW_LOGGER, 'D1-' + mp)
    edit(fp, D2_old, D2_new, 'D2-' + mp)

# ====== GROUP E: BoxesTab.tsx ======
fp = 'app/dashboard/india-selling/tracking/components/BoxesTab.tsx'
edit(fp, IMPORT_OLD_SUPA, IMPORT_NEW_SUPA, 'E1')
E2_old = """const SELLER_TAG_COLORS: Record<string, string> = {
    GR: 'bg-yellow-400 text-black',
    RR: 'bg-gray-400 text-black',
    UB: 'bg-pink-500 text-white',
    VV: 'bg-purple-600 text-white',
    DE: 'bg-orange-500 text-white',
    CV: 'bg-green-600 text-white',
};
"""
edit(fp, E2_old, "", 'E2')
replace_all(fp, "SELLER_TAG_COLORS[", "SELLER_STYLES[", 'E3')

# ====== GROUP F: BoxTrackingTable.tsx ======
fp = 'app/dashboard/india-selling/tracking/components/BoxTrackingTable.tsx'
edit(fp, IMPORT_OLD_SUPA, IMPORT_NEW_SUPA, 'F1')
F2_old = """    const SELLER_TAG_COLORS: Record<string, string> = {
        GR: 'bg-yellow-400 text-black',
        RR: 'bg-gray-400 text-black',
        UB: 'bg-pink-500 text-white',
        VV: 'bg-purple-600 text-white',
        DE: 'bg-orange-500 text-white',
        CV: 'bg-green-600 text-white',
    };
"""
edit(fp, F2_old, "", 'F2')
replace_all(fp, "SELLER_TAG_COLORS[", "SELLER_STYLES[", 'F3')

# ====== GROUP G: CheckingTable.tsx ======
fp = 'app/dashboard/india-selling/tracking/components/CheckingTable.tsx'
G1_old = "import { getIndiaTrackingTableName, SELLER_TAG_MAPPING, SellerTag } from '@/lib/utils';"
G1_new = G1_old + "\nimport { SELLER_STYLES } from '@/components/shared/SellerTag';"
edit(fp, G1_old, G1_new, 'G1')
G2_old = """  const SELLER_TAG_COLORS: Record<string, string> = {
    GR: 'bg-yellow-400 text-black',
    RR: 'bg-gray-400 text-black',
    UB: 'bg-pink-500 text-white',
    VV: 'bg-purple-600 text-white',
    DE: 'bg-orange-500 text-white',
    CV: 'bg-green-600 text-white',
    MV: 'bg-orange-600 text-white',
    KL: 'bg-lime-500 text-black',
  };
"""
edit(fp, G2_old, "", 'G2')
replace_all(fp, "SELLER_TAG_COLORS[", "SELLER_STYLES[", 'G3')

# ====== GROUP H: VyaparBoxForm.tsx ======
fp = 'app/dashboard/india-selling/tracking/components/VyaparBoxForm.tsx'
edit(fp, IMPORT_OLD_SUPA, IMPORT_NEW_SUPA, 'H1')
H2_old = """const SELLER_TAG_COLORS: Record<string, string> = {
    GR: "bg-yellow-400 text-black",
    RR: "bg-gray-400 text-black",
    UB: "bg-pink-500 text-white",
    VV: "bg-purple-600 text-white",
    DE: "bg-orange-500 text-white",
    CV: "bg-green-600 text-white",
};
"""
edit(fp, H2_old, "", 'H2')
replace_all(fp, "SELLER_TAG_COLORS[", "SELLER_STYLES[", 'H3')

# ====== GROUP I: InboundTable.tsx ======
fp = 'app/dashboard/india-selling/tracking/components/InboundTable.tsx'
edit(fp, IMPORT_OLD_SUPA, IMPORT_NEW_SUPA, 'I1')

I2_old = """        const tagColors: Record<string, string> = {
            GR: 'bg-yellow-400 text-black',
            RR: 'bg-gray-400 text-black',
            UB: 'bg-pink-500 text-white',
            VV: 'bg-purple-600 text-white',
            DE: 'bg-orange-500 text-white',
            CV: 'bg-green-600 text-white',
            MV: 'bg-orange-600 text-white',
            KL: 'bg-lime-500 text-black',
        };"""
I2_new = "        const tagColors = SELLER_STYLES;"
edit(fp, I2_old, I2_new, 'I2')

I3_old = """                                        const tagColors: Record<string, string> = {
                                            GR: 'bg-yellow-500 text-black border border-yellow-600',
                                            RR: 'bg-slate-500 text-white border border-white/[0.1]',
                                            UB: 'bg-pink-500 text-white border border-pink-600',
                                            VV: 'bg-purple-500 text-white border border-purple-600',
                                            DE: 'bg-cyan-500 text-black border border-cyan-600',
                                            CV: 'bg-teal-500 text-white border border-teal-600',
                                            MV: 'bg-orange-600 text-white border border-orange-700',
                                            KL: 'bg-lime-500 text-black border border-lime-600',
                                        };"""
I3_new = "                                        const tagColors = SELLER_STYLES;"
edit(fp, I3_old, I3_new, 'I3')

print("\n=== {} entries ===".format(len(CHANGES)))
for c in CHANGES:
    print(c)
