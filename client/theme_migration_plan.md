# Theme Centralization — Complete Step-by-Step Plan

> **102 files • 1,601 hardcoded hex colors** need to be replaced with `COLORS` tokens from `src/theme/colors.ts`.
> 
> Each step = 1 file. Follow the instructions, make the changes, check off the step.
>
> **Rule**: Only change color values. Do NOT modify layout, logic, or functionality.

---

## Token Reference (src/theme/colors.ts)

| Token | Current Value | Use For |
|-------|--------------|---------|
| `COLORS.primary` | `#2563EB` | Brand buttons, active states, links |
| `COLORS.primaryGradient` | `['#3B82F6', '#1D4ED8']` | Gradient buttons |
| `COLORS.primaryLight` | `#EFF6FF` | Light brand tint backgrounds |
| `COLORS.primaryBorder` | `#BFDBFE` | Brand-tinted borders |
| `COLORS.background` | `#FFFFFF` | Page/screen backgrounds |
| `COLORS.surface` | `#F8F9FA` | Cards, off-white sections |
| `COLORS.card` | `#FFFFFF` | Card backgrounds |
| `COLORS.inputBg` | `#F0F2F5` | Input fields, placeholders bg |
| `COLORS.border` | `#E5E7EB` | Borders, dividers, separators |
| `COLORS.textPrimary` | `#111827` | Main text (#000, #111, #222, #333) |
| `COLORS.textSecondary` | `#6B7280` | Secondary text (#444, #666) |
| `COLORS.textMuted` | `#9CA3AF` | Muted text (#888, #999, #aaa, #bbb) |
| `COLORS.textLight` | `#FFFFFF` | White text on dark/colored bg |
| `COLORS.white` | `#FFFFFF` | White for borders, backgrounds |
| `COLORS.black` | `#000000` | Pure black |
| `COLORS.accent` | `#1E40AF` | Secondary brand accent |
| `COLORS.danger` | `#FF3B30` | Errors, delete, destructive |
| `COLORS.dangerLight` | `#FFF0F0` | Light danger backgrounds |
| `COLORS.success` | `#10B981` | Success states |
| `COLORS.info` | `#0095F6` | Info, iOS blue (#007aff) |
| `COLORS.warning` | `#FF9500` | Warnings |
| `COLORS.badgeYellow` | `#2563EB` | Badge/payout buttons |

---

## Step 1: app/passport.tsx

**Hex count**: 85 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L595 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-left" size={20} color="#000" /&gt;` |
| L606 | `"#000"` | `COLORS.black` | `&lt;Feather name="search" size={20} color="#000" /&gt;` |
| L617 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="check" size={10} color="#fff" /&gt;` |
| L622 | `"#000"` | `COLORS.black` | `&lt;Feather name="shield" size={12} color="#000" style={{ marginRight:` |
| L629 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="navigation" size={14} color="#FF8D00" style={{ margi` |
| L654 | `"#FF8D00"` | `COLORS.primary` | `&lt;Ionicons name="close" size={18} color="#FF8D00" /&gt;` |
| L669 | `"#000"` | `COLORS.black` | `&lt;Feather name="map" size={20} color="#000" /&gt;` |
| L680 | `"#CCC"` | `COLORS.border` | `&lt;Feather name="chevron-right" size={20} color="#CCC" style={{ margi` |
| L711 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator style={{ marginTop: 50 }} color="#FF8D00" /&gt;` |
| L738 | `"#666"` | `COLORS.textSecondary` | `&lt;Feather name="map-pin" size={10} color="#666" /&gt;` |
| L742 | `"#000"` | `COLORS.black` | `&lt;Feather name="calendar" size={10} color="#000" /&gt;` |
| L757 | `"#ddd"` | `COLORS.border` | `&lt;Feather name="map" size={40} color="#ddd" /&gt;` |
| L793 | `'#FBBC04'` | `COLORS.primary (or keep in primaryGradient)` | `colors={['#FBBC04', '#FF8D00']}` |
| L793 | `'#FF8D00'` | `COLORS.primary` | `colors={['#FBBC04', '#FF8D00']}` |
| L798 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="locate" size={18} color="#fff" /&gt;` |
| L936 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1013 | `'#f9f9f9'` | `COLORS.surface` | `backgroundColor: '#f9f9f9',` |
| L1016 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L1035 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1037 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L1046 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1051 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |
| L1057 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L1061 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L1068 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1084 | `'#f9f9f9'` | `COLORS.surface` | `backgroundColor: '#f9f9f9',` |
| L1096 | `'#fff'` | `COLORS.textLight` | `counterText: { fontSize: 10, fontWeight: '800', color: '#fff' },` |
| L1110 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1116 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L1117 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1123 | `'#333'` | `COLORS.textPrimary` | `pillText: { fontSize: 13, color: '#333', fontWeight: '500' },` |
| L1129 | `'#F8F9FA'` | `COLORS.surface` | `backgroundColor: '#F8F9FA',` |
| L1133 | `'#F0F0F0'` | `COLORS.inputBg` | `borderColor: '#F0F0F0',` |
| L1143 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1147 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L1149 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1155 | `'#999'` | `COLORS.textMuted` | `emptyText: { fontSize: 14, color: '#999', marginTop: 10 },` |
| L1167 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1182 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1194 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1202 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1211 | `'#eee'` | `COLORS.border` | `borderBottomColor: '#eee',` |
| L1218 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |
| L1225 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1234 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |
| L1244 | `'#f5f7fa'` | `COLORS.surface` | `backgroundColor: '#f5f7fa',` |
| L1247 | `'#eef0f2'` | `COLORS.border` | `borderColor: '#eef0f2',` |
| L1252 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1262 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L1272 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L1292 | `'#f9f9f9'` | `COLORS.surface` | `backgroundColor: '#f9f9f9',` |
| L1295 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L1298 | `'#f0f4f8'` | `COLORS.surface` | `backgroundColor: '#f0f4f8',` |
| L1299 | `'#1E63D7'` | `COLORS.primary` | `borderColor: '#1E63D7',` |
| L1309 | `'#1E63D7'` | `COLORS.primary` | `color: '#1E63D7',` |
| L1316 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L1321 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L1327 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1339 | `'#f9f9f9'` | `COLORS.surface` | `backgroundColor: '#f9f9f9',` |
| L1342 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L1345 | `'#f0f4f8'` | `COLORS.surface` | `backgroundColor: '#f0f4f8',` |
| L1346 | `'#FF8D00'` | `COLORS.primary` | `borderColor: '#FF8D00',` |
| L1357 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1362 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L1370 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1375 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L1382 | `'#ddd'` | `COLORS.border` | `borderColor: '#ddd',` |
| L1388 | `'#FF8D00'` | `COLORS.primary` | `borderColor: '#FF8D00',` |
| L1389 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L1399 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1409 | `'#E0E0E0'` | `COLORS.border` | `backgroundColor: '#E0E0E0',` |
| L1423 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1428 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L1436 | `'#F5F5F5'` | `COLORS.surface` | `backgroundColor: '#F5F5F5',` |
| L1447 | `'#F8F9FA'` | `COLORS.surface` | `backgroundColor: '#F8F9FA',` |
| L1452 | `'#F0F0F0'` | `COLORS.inputBg` | `borderColor: '#F0F0F0',` |
| L1457 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1470 | `'#F0F0F0'` | `COLORS.inputBg` | `borderBottomColor: '#F0F0F0',` |
| L1476 | `'#F0F4F8'` | `COLORS.surface` | `backgroundColor: '#F0F4F8',` |
| L1487 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1491 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L1503 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L1508 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L1521 | `'#F9F9F9'` | `COLORS.surface` | `backgroundColor: '#F9F9F9',` |
| L1528 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |

---

## Step 2: src/_components/profile/SubscriptionModal.tsx

**Hex count**: 80 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L436 | `"#8e8e93"` | `COLORS.textMuted` | `placeholderTextColor="#8e8e93"` |
| L448 | `"#8e8e93"` | `COLORS.textMuted` | `placeholderTextColor="#8e8e93"` |
| L462 | `"#8e8e93"` | `COLORS.textMuted` | `placeholderTextColor="#8e8e93"` |
| L475 | `"#fff"` | `COLORS.textLight` | `{createGroupChat && &lt;Ionicons name="checkmark" size={14} color="#ff` |
| L489 | `"#8e8e93"` | `COLORS.textMuted` | `&lt;Feather name="x" size={16} color="#8e8e93" /&gt;` |
| L499 | `"#8e8e93"` | `COLORS.textMuted` | `placeholderTextColor="#8e8e93"` |
| L506 | `"#007aff"` | `COLORS.info` | `&lt;Feather name="check" size={18} color="#007aff" /&gt;` |
| L509 | `"#ff3b30"` | `COLORS.danger` | `&lt;Feather name="x" size={18} color="#ff3b30" /&gt;` |
| L517 | `"#007aff"` | `COLORS.info` | `&lt;Feather name="plus" size={14} color="#007aff" style={{ marginRight` |
| L560 | `"#007aff"` | `COLORS.info` | `color={createGroupChat ? "#007aff" : "#8e8e93"}` |
| L560 | `"#8e8e93"` | `COLORS.textMuted` | `color={createGroupChat ? "#007aff" : "#8e8e93"}` |
| L572 | `"#007aff"` | `COLORS.info` | `&lt;Feather name="check" size={12} color="#007aff" style={{ marginRigh` |
| L585 | `"#fff"` | `COLORS.textLight` | `&lt;ActivityIndicator color="#fff" size="small" /&gt;` |
| L615 | `'#34c759'` | `COLORS.success` | `!isSel && isSub && { borderColor: '#34c759', borderWidth: 1 }` |
| L629 | `'#34c759'` | `COLORS.success` | `!isSel && isSub && { color: '#34c759' }` |
| L638 | `'#f0f0f5'` | `COLORS.inputBg` | `style={[styles.tierChip, { backgroundColor: '#f0f0f5', borderColor: '#` |
| L638 | `'#ddd'` | `COLORS.border` | `style={[styles.tierChip, { backgroundColor: '#f0f0f5', borderColor: '#` |
| L649 | `'#007aff'` | `COLORS.info` | `&lt;Text style={[styles.tierChipText, { color: '#007aff' }]}&gt;+ Add ` |
| L662 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="check" size={14} color="#fff" style={{ marginRight: ` |
| L672 | `"#FFD60A"` | `COLORS.warning` | `&lt;Feather name="info" size={14} color="#FFD60A" style={{ marginRight` |
| L690 | `"#fff"` | `COLORS.textLight` | `&lt;ActivityIndicator color={isSelectedTierSubscribed ? "#fff" : "#000` |
| L690 | `"#000"` | `COLORS.black` | `&lt;ActivityIndicator color={isSelectedTierSubscribed ? "#fff" : "#000` |
| L693 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name={isSelectedTierSubscribed ? "check" : "star"} size={1` |
| L693 | `"#000"` | `COLORS.black` | `&lt;Feather name={isSelectedTierSubscribed ? "check" : "star"} size={1` |
| L788 | `"#000"` | `COLORS.black` | `&lt;Feather name="x" size={20} color="#000" /&gt;` |
| L794 | `"#007aff"` | `COLORS.info` | `&lt;ActivityIndicator size="large" color="#007aff" /&gt;` |
| L817 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L834 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L851 | `'#8e8e93'` | `COLORS.textMuted` | `color: '#8e8e93',` |
| L859 | `'#8e8e93'` | `COLORS.textMuted` | `color: '#8e8e93',` |
| L865 | `'#e5e5ea'` | `COLORS.border` | `borderColor: '#e5e5ea',` |
| L870 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L871 | `'#fafafa'` | `COLORS.surface` | `backgroundColor: '#fafafa',` |
| L888 | `'#7a828a'` | `COLORS.textSecondary` | `borderColor: '#7a828a',` |
| L891 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L895 | `'#111827'` | `COLORS.textPrimary` | `backgroundColor: '#111827',` |
| L896 | `'#111827'` | `COLORS.textPrimary` | `borderColor: '#111827',` |
| L900 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L910 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L917 | `'#f5f5f7'` | `COLORS.surface` | `backgroundColor: '#f5f5f7',` |
| L925 | `'#1c1c1e'` | `COLORS.textPrimary` | `color: '#1c1c1e',` |
| L938 | `'#e5e5ea'` | `COLORS.border` | `borderColor: '#e5e5ea',` |
| L943 | `'#fafafa'` | `COLORS.surface` | `backgroundColor: '#fafafa',` |
| L960 | `'#007aff'` | `COLORS.info` | `color: '#007aff',` |
| L964 | `'#000'` | `COLORS.black` | `backgroundColor: '#000',` |
| L972 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L982 | `'#ddd'` | `COLORS.border` | `borderColor: '#ddd',` |
| L986 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L992 | `'#e5e5ea'` | `COLORS.border` | `borderColor: '#e5e5ea',` |
| L996 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1000 | `'#000'` | `COLORS.black` | `borderColor: '#000',` |
| L1001 | `'#000'` | `COLORS.black` | `backgroundColor: '#000',` |
| L1006 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L1011 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1014 | `'#00a2ff'` | `COLORS.info` | `backgroundColor: '#00a2ff',` |
| L1021 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1040 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1045 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1059 | `'#FFD60A'` | `COLORS.warning` | `color: '#FFD60A',` |
| L1063 | `'#FFD60A'` | `COLORS.warning` | `backgroundColor: '#FFD60A',` |
| L1071 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1076 | `'#34c759'` | `COLORS.success` | `backgroundColor: '#34c759',` |
| L1079 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1082 | `'#000'` | `COLORS.black` | `backgroundColor: '#000',` |
| L1089 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1099 | `'#ff3b30'` | `COLORS.danger` | `color: '#ff3b30',` |
| L1110 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1115 | `'#8e8e93'` | `COLORS.textMuted` | `color: '#8e8e93',` |
| L1119 | `'#e5e5ea'` | `COLORS.border` | `borderColor: '#e5e5ea',` |
| L1123 | `'#fafafa'` | `COLORS.surface` | `backgroundColor: '#fafafa',` |
| L1128 | `'#8e8e93'` | `COLORS.textMuted` | `color: '#8e8e93',` |
| L1135 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1141 | `'#8e8e93'` | `COLORS.textMuted` | `color: '#8e8e93',` |
| L1147 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L1154 | `'#8e8e93'` | `COLORS.textMuted` | `color: '#8e8e93',` |
| L1161 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1171 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L1176 | `'#e5e5ea'` | `COLORS.border` | `borderTopColor: '#e5e5ea',` |
| L1182 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L1192 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |

---

## Step 3: src/_components/ReelItem.tsx

**Hex count**: 65 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L752 | `'#000'` | `COLORS.black` | `&lt;View style={{ width: SCREEN_WIDTH, height: containerHeight, backgr` |
| L776 | `'#000'` | `COLORS.black` | `&lt;View style={[StyleSheet.absoluteFill, { justifyContent: 'center', ` |
| L777 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff' }}&gt;No Image Available&lt;/Text&gt;` |
| L801 | `'#000'` | `COLORS.black` | `&lt;View style={[StyleSheet.absoluteFill, { justifyContent: 'center', ` |
| L802 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff' }}&gt;No Video Available&lt;/Text&gt;` |
| L830 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={36} color="#fff" /&gt;` |
| L845 | `"#ffffff"` | `COLORS.textLight` | `color="#ffffff"` |
| L873 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="contract" size={24} color="#ffffff" /&gt;` |
| L885 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="arrow-undo" size={26} color="#ffffff" /&gt;` |
| L893 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="chatbubbles" size={24} color="#ffffff" /&gt;` |
| L914 | `'#D1D5DB'` | `COLORS.border` | `colors={creatorStoriesSeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#DD` |
| L914 | `'#D1D5DB'` | `COLORS.border` | `colors={creatorStoriesSeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#DD` |
| L914 | `'#F58529'` | `COLORS.surface` | `colors={creatorStoriesSeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#DD` |
| L914 | `'#DD2A7B'` | `COLORS.surface` | `colors={creatorStoriesSeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#DD` |
| L914 | `'#8134AF'` | `COLORS.surface` | `colors={creatorStoriesSeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#DD` |
| L951 | `"#4cd964"` | `COLORS.surface` | `color={isFollowing ? "#4cd964" : "#ffffff"}` |
| L951 | `"#ffffff"` | `COLORS.textLight` | `color={isFollowing ? "#4cd964" : "#ffffff"}` |
| L953 | `"#4cd964"` | `COLORS.surface` | `&lt;Text style={[styles.actionText, isFollowing && { color: "#4cd964" ` |
| L961 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="chatbubbles" size={28} color="#ffffff" /&gt;` |
| L970 | `"#ff3b30"` | `COLORS.danger` | `color={isLiked ? "#ff3b30" : "#ffffff"}` |
| L970 | `"#ffffff"` | `COLORS.textLight` | `color={isLiked ? "#ff3b30" : "#ffffff"}` |
| L980 | `"#f1c40f"` | `COLORS.surface` | `color={isSaved ? "#f1c40f" : "#ffffff"}` |
| L980 | `"#ffffff"` | `COLORS.textLight` | `color={isSaved ? "#f1c40f" : "#ffffff"}` |
| L987 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="arrow-redo" size={28} color="#ffffff" /&gt;` |
| L996 | `"#ffffff"` | `COLORS.textLight` | `color="#ffffff"` |
| L1002 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="ellipsis-horizontal" size={26} color="#ffffff" /&gt` |
| L1023 | `'#D1D5DB'` | `COLORS.border` | `colors={isFollowedStorySeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#D` |
| L1023 | `'#D1D5DB'` | `COLORS.border` | `colors={isFollowedStorySeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#D` |
| L1023 | `'#F58529'` | `COLORS.surface` | `colors={isFollowedStorySeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#D` |
| L1023 | `'#DD2A7B'` | `COLORS.surface` | `colors={isFollowedStorySeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#D` |
| L1023 | `'#8134AF'` | `COLORS.surface` | `colors={isFollowedStorySeen ? ['#D1D5DB', '#D1D5DB'] : ['#F58529', '#D` |
| L1201 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="edit-3" size={20} color="#333" /&gt;` |
| L1220 | `"#ff3b30"` | `COLORS.danger` | `&lt;Feather name="flag" size={20} color="#ff3b30" /&gt;` |
| L1221 | `'#ff3b30'` | `COLORS.danger` | `&lt;Text style={[styles.menuItemText, { color: '#ff3b30' }]}&gt;Report` |
| L1245 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="checkmark-circle" size={20} color="#fff" /&gt;` |
| L1250 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="chevron-right" size={16} color="#fff" /&gt;` |
| L1281 | `"#FFD60A"` | `COLORS.warning` | `&lt;Ionicons name="lock-closed" size={32} color="#FFD60A" /&gt;` |
| L1490 | `'#ffffff'` | `COLORS.textLight` | `borderColor: '#ffffff',` |
| L1512 | `'#000'` | `COLORS.black` | `backgroundColor: '#000',` |
| L1524 | `'#0095f6'` | `COLORS.info` | `backgroundColor: '#0095f6',` |
| L1531 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff'` |
| L1538 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L1560 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L1568 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L1599 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1613 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff'` |
| L1618 | `'#ddd'` | `COLORS.border` | `backgroundColor: '#ddd',` |
| L1622 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1632 | `'#ddd'` | `COLORS.border` | `backgroundColor: '#ddd',` |
| L1646 | `'#333'` | `COLORS.textPrimary` | `color: '#333'` |
| L1656 | `'#0095f6'` | `COLORS.info` | `color: '#0095f6'` |
| L1716 | `'#fbbc04'` | `COLORS.primary (or keep in primaryGradient)` | `borderColor: '#fbbc04',` |
| L1720 | `'#e74c3c'` | `COLORS.surface` | `borderColor: '#e74c3c',` |
| L1726 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L1744 | `'#ffffff'` | `COLORS.background` | `backgroundColor: '#ffffff',` |
| L1763 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1775 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1785 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1804 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1836 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1842 | `'#bbb'` | `COLORS.textMuted` | `color: '#bbb',` |
| L1848 | `'#FFD60A'` | `COLORS.warning` | `backgroundColor: '#FFD60A',` |
| L1852 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1859 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1891 | `'#000'` | `COLORS.black` | `borderColor: '#000',` |

---

## Step 4: src/_components/CreatePost/PostDetailsForm.tsx

**Hex count**: 42 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L39 | `'#fff'` | `COLORS.background` | `&lt;View style={{ flex: 1, backgroundColor: '#fff' }}&gt;` |
| L43 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="align-justify" size={18} color="#333" style={{ margi` |
| L45 | `'#000'` | `COLORS.black` | `style={{ flex: 1, fontSize: 14, color: '#000', fontWeight: '500' }}` |
| L47 | `"#333"` | `COLORS.textPrimary` | `placeholderTextColor="#333"` |
| L56 | `'#f5f5f5'` | `COLORS.surface` | `&lt;View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBot` |
| L59 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="image" size={18} color="#FF8D00" style={{ marginRigh` |
| L61 | `'#000'` | `COLORS.black` | `&lt;Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}&gt` |
| L62 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}&gt;` |
| L70 | `'#e0e0e0'` | `COLORS.border` | `&lt;Image source={{ uri: customThumbnailUri }} style={{ width: 36, hei` |
| L71 | `'#f0f0f0'` | `COLORS.inputBg` | `&lt;TouchableOpacity onPress={onSelectCustomThumbnail} style={{ backgr` |
| L72 | `'#333'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}&gt` |
| L74 | `'#ffebee'` | `COLORS.surface` | `&lt;TouchableOpacity onPress={onRemoveCustomThumbnail} style={{ backgr` |
| L75 | `"#d32f2f"` | `COLORS.surface` | `&lt;Feather name="trash-2" size={14} color="#d32f2f" /&gt;` |
| L79 | `'#FF8D00'` | `COLORS.primary` | `&lt;TouchableOpacity onPress={onSelectCustomThumbnail} style={{ backgr` |
| L80 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}&gt` |
| L90 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="hash" size={18} color="#333" style={{ marginRight: 1` |
| L92 | `'#000'` | `COLORS.black` | `style={{ flex: 1, fontSize: 14, color: '#000', fontWeight: '500' }}` |
| L94 | `"#888"` | `COLORS.textMuted` | `placeholderTextColor="#888"` |
| L109 | `'#f0f0f0'` | `COLORS.inputBg` | `&lt;View key={tag} style={{ backgroundColor: '#f0f0f0', paddingHorizon` |
| L110 | `'#333'` | `COLORS.textPrimary` | `&lt;Text style={{ color: '#333', fontSize: 12 }}&gt;#{tag}&lt;/Text&gt` |
| L112 | `"#666"` | `COLORS.textSecondary` | `&lt;Feather name="x" size={12} color="#666" /&gt;` |
| L122 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="bookmark" size={18} color="#333" style={{ marginRigh` |
| L124 | `'#000'` | `COLORS.black` | `&lt;Text style={{ fontSize: 14, fontWeight: '500', color: selectedCate` |
| L124 | `'#333'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 14, fontWeight: '500', color: selectedCate` |
| L132 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="map-pin" size={18} color="#333" style={{ marginRight` |
| L137 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L144 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0'` |
| L146 | `"#666"` | `COLORS.textSecondary` | `&lt;Feather name="map-pin" size={12} color="#666" style={{ marginRight` |
| L147 | `'#333'` | `COLORS.textPrimary` | `&lt;Text style={{ color: '#333', fontSize: 14, fontWeight: '500' }}&gt` |
| L151 | `'#333'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 14, fontWeight: '500', color: '#333' }}&gt` |
| L158 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="eye" size={18} color="#333" style={{ marginRight: 15` |
| L162 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: visibility === 'Everyone' ? '#f5f5f5' : '#E3F2FD',` |
| L162 | `'#E3F2FD'` | `COLORS.surface` | `backgroundColor: visibility === 'Everyone' ? '#f5f5f5' : '#E3F2FD',` |
| L169 | `'#e0e0e0'` | `COLORS.border` | `borderColor: visibility === 'Everyone' ? '#e0e0e0' : '#90CAF9',` |
| L169 | `'#90CAF9'` | `COLORS.surface` | `borderColor: visibility === 'Everyone' ? '#e0e0e0' : '#90CAF9',` |
| L175 | `'#666'` | `COLORS.textSecondary` | `color={visibility === 'Everyone' ? '#666' : '#1976D2'}` |
| L175 | `'#1976D2'` | `COLORS.surface` | `color={visibility === 'Everyone' ? '#666' : '#1976D2'}` |
| L179 | `'#333'` | `COLORS.textPrimary` | `color: visibility === 'Everyone' ? '#333' : '#1976D2',` |
| L179 | `'#1976D2'` | `COLORS.surface` | `color: visibility === 'Everyone' ? '#333' : '#1976D2',` |
| L192 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="user-plus" size={18} color="#333" style={{ marginRig` |
| L194 | `'#000'` | `COLORS.black` | `&lt;Text style={{ fontSize: 14, fontWeight: '500', color: taggedUsers.` |
| L194 | `'#333'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 14, fontWeight: '500', color: taggedUsers.` |

---

## Step 5: app/(tabs)/_layout.tsx

**Hex count**: 41 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L235 | `'#000'` | `COLORS.black` | `&lt;View style={{ flex: 1, backgroundColor: '#000' }}&gt;` |
| L251 | `'#000'` | `COLORS.black` | `backgroundColor: '#000',` |
| L474 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="settings" size={ICON_SIZE} color="#FF8D00" /&gt;` |
| L477 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="chevron-right" size={CHEVRON_SIZE} color="#ccc" styl` |
| L494 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="bookmark" size={ICON_SIZE} color="#FF8D00" /&gt;` |
| L497 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="chevron-right" size={CHEVRON_SIZE} color="#ccc" styl` |
| L514 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="shield" size={ICON_SIZE} color="#FF8D00" /&gt;` |
| L517 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="chevron-right" size={CHEVRON_SIZE} color="#ccc" styl` |
| L533 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="file-text" size={ICON_SIZE} color="#FF8D00" /&gt;` |
| L536 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="chevron-right" size={CHEVRON_SIZE} color="#ccc" styl` |
| L562 | `'#fee'` | `COLORS.surface` | `&lt;View style={[styles.iconContainer, { backgroundColor: '#fee' }]}&g` |
| L563 | `"#e74c3c"` | `COLORS.surface` | `&lt;Feather name="log-out" size={ICON_SIZE} color="#e74c3c" /&gt;` |
| L643 | `'#ffffff'` | `COLORS.textLight` | `borderColor: '#ffffff',` |
| L648 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L773 | `"#000"` | `COLORS.black` | `&lt;Feather name="users" size={20} color="#000" /&gt;` |
| L827 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L861 | `'#f8f9fa'` | `COLORS.surface` | `backgroundColor: '#f8f9fa',` |
| L867 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L881 | `'#d1d5db'` | `COLORS.border` | `backgroundColor: '#d1d5db',` |
| L888 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L892 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L903 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L915 | `'#1f2937'` | `COLORS.surface` | `color: '#1f2937',` |
| L924 | `'#e5e7eb'` | `COLORS.border` | `backgroundColor: '#e5e7eb',` |
| L932 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L935 | `'#e74c3c'` | `COLORS.surface` | `shadowColor: '#e74c3c',` |
| L943 | `'#e74c3c'` | `COLORS.surface` | `color: '#e74c3c',` |
| L948 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L952 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L959 | `'#6b7280'` | `COLORS.textSecondary` | `color: '#6b7280',` |
| L965 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L975 | `'#eee'` | `COLORS.border` | `borderBottomColor: '#eee',` |
| L980 | `'#1f2937'` | `COLORS.surface` | `color: '#1f2937',` |
| L991 | `'#f0f0f0'` | `COLORS.inputBg` | `borderBottomColor: '#f0f0f0',` |
| L999 | `'#1f2937'` | `COLORS.surface` | `color: '#1f2937',` |
| L1004 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |
| L1010 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L1016 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L1028 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L1039 | `'#000'` | `COLORS.black` | `backgroundColor: '#000',` |
| L1040 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |

---

## Step 6: src/_components/MessageBubble.tsx

**Hex count**: 41 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L586 | `'#1e1e1e'` | `COLORS.surface` | `&lt;View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1` |
| L610 | `'#fff'` | `COLORS.textLight` | `color={isSelf ? '#fff' : '#111'}` |
| L610 | `'#111'` | `COLORS.textPrimary` | `color={isSelf ? '#fff' : '#111'}` |
| L633 | `'#ffffff'` | `COLORS.white` | `? (isFilled ? '#ffffff' : 'rgba(255,255,255,0.45)')` |
| L634 | `'#111111'` | `COLORS.surface` | `: (isFilled ? '#111111' : 'rgba(0,0,0,0.14)')` |
| L675 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="copy-outline" size={12} color="#fff" /&gt;` |
| L727 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={14} color="#fff" /&gt;` |
| L733 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="aperture" size={12} color="#fff" /&gt;` |
| L744 | `"#aaa"` | `COLORS.textMuted` | `&lt;Feather name="loader" size={24} color="#aaa" /&gt;` |
| L755 | `"#999"` | `COLORS.textMuted` | `&lt;Feather name="camera-off" size={28} color="#999" /&gt;` |
| L781 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="checkmark-done" size={14} color="#fff" /&gt;` |
| L807 | `"#262626"` | `COLORS.surface` | `&lt;Ionicons name="paper-plane-outline" size={18} color="#262626" /&gt` |
| L819 | `'#000'` | `COLORS.black` | `&lt;View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'c` |
| L824 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="close" size={30} color="#fff" /&gt;` |
| L830 | `"#FF8D00"` | `COLORS.primary` | `color="#FF8D00"` |
| L892 | `'#efefef'` | `COLORS.surface` | `backgroundColor: '#efefef',` |
| L977 | `'#666'` | `COLORS.textSecondary` | `replyText: { fontSize: 12, color: '#666' },` |
| L988 | `'#000'` | `COLORS.black` | `backgroundColor: '#000',` |
| L1008 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff',` |
| L1026 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1054 | `'#8e8e8e'` | `COLORS.surface` | `color: '#8e8e8e',` |
| L1057 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1062 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L1063 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1078 | `'#262626'` | `COLORS.surface` | `sharedPostAuthorName: { fontSize: 14, fontWeight: '700', color: '#2626` |
| L1093 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1104 | `'#000'` | `COLORS.black` | `backgroundColor: '#000',` |
| L1147 | `'#E1306C'` | `COLORS.surface` | `borderColor: '#E1306C',` |
| L1160 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1197 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1202 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0',` |
| L1206 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0',` |
| L1212 | `'#e8e8e8'` | `COLORS.surface` | `backgroundColor: '#e8e8e8',` |
| L1220 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L1225 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L1234 | `'#1f2937'` | `COLORS.textPrimary` | `color: '#1f2937',` |
| L1239 | `'#111827'` | `COLORS.textPrimary` | `color: '#111827',` |
| L1245 | `'#f2f2f2'` | `COLORS.surface` | `backgroundColor: '#f2f2f2',` |
| L1254 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1259 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L1261 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |

---

## Step 7: src/_components/profile/ProfileHeader.tsx

**Hex count**: 38 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L99 | `'#F58529'` | `COLORS.surface` | `colors={['#F58529', '#DD2A7B', '#8134AF']}` |
| L99 | `'#DD2A7B'` | `COLORS.surface` | `colors={['#F58529', '#DD2A7B', '#8134AF']}` |
| L99 | `'#8134AF'` | `COLORS.surface` | `colors={['#F58529', '#DD2A7B', '#8134AF']}` |
| L115 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="lock-closed" size={28} color="#fff" /&gt;` |
| L130 | `'#007aff'` | `COLORS.info` | `colors={['#007aff', '#0055ff']}` |
| L130 | `'#0055ff'` | `COLORS.surface` | `colors={['#007aff', '#0055ff']}` |
| L135 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="plus" size={12} color="#fff" style={{ zIndex: 1 }} /` |
| L192 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="settings" size={14} color="#fff" style={{ marginRigh` |
| L197 | `'#FFD60A'` | `COLORS.warning` | `style={[styles.actionBtnBlack, { backgroundColor: '#FFD60A' }]}` |
| L200 | `"#000"` | `COLORS.black` | `&lt;Feather name="star" size={14} color="#000" style={{ marginRight: 6` |
| L201 | `'#000'` | `COLORS.black` | `&lt;Text style={[styles.actionBtnText, { color: '#000' }]}&gt;Manage S` |
| L214 | `"#fff"` | `COLORS.textLight` | `color="#fff"` |
| L227 | `'#ff3b30'` | `COLORS.danger` | `? { backgroundColor: '#ff3b30' }` |
| L228 | `'#FFD60A'` | `COLORS.warning` | `: { backgroundColor: '#FFD60A' }` |
| L235 | `"#fff"` | `COLORS.textLight` | `color={isSubscribed ? "#fff" : "#000"}` |
| L235 | `"#000"` | `COLORS.black` | `color={isSubscribed ? "#fff" : "#000"}` |
| L238 | `"#fff"` | `COLORS.textLight` | `&lt;Text style={[styles.actionBtnText, { color: isSubscribed ? "#fff" ` |
| L238 | `"#000"` | `COLORS.black` | `&lt;Text style={[styles.actionBtnText, { color: isSubscribed ? "#fff" ` |
| L267 | `"#007aff"` | `COLORS.info` | `&lt;Feather name="link" size={12} color="#007aff" style={{ marginRight` |
| L274 | `"#666"` | `COLORS.textSecondary` | `&lt;Feather name="map-pin" size={12} color="#666" style={{ marginRight` |
| L287 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L309 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L313 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff',` |
| L335 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff',` |
| L336 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L351 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L356 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L368 | `'#f5f5f7'` | `COLORS.surface` | `backgroundColor: '#f5f5f7',` |
| L374 | `'#e5e5ea'` | `COLORS.border` | `borderColor: '#e5e5ea',` |
| L379 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L383 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L396 | `'#111'` | `COLORS.textPrimary` | `backgroundColor: '#111',` |
| L402 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L407 | `'#00a2ff'` | `COLORS.info` | `backgroundColor: '#00a2ff',` |
| L415 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L432 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L442 | `'#007aff'` | `COLORS.info` | `color: '#007aff',` |
| L452 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |

---

## Step 8: src/_components/ShareModal.tsx

**Hex count**: 38 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L431 | `"#0095f6"` | `COLORS.info` | `&lt;Ionicons name="checkmark-circle" size={24} color="#0095f6" /&gt;` |
| L437 | `'#8e8e8e'` | `COLORS.surface` | `&lt;Text style={{ fontSize: 10, color: '#8e8e8e', marginTop: 2, textAl` |
| L457 | `"#8e8e8e"` | `COLORS.surface` | `&lt;Feather name="search" size={16} color="#8e8e8e" /&gt;` |
| L461 | `"#8e8e8e"` | `COLORS.surface` | `placeholderTextColor="#8e8e8e"` |
| L485 | `"#6b7280"` | `COLORS.textSecondary` | `&lt;Ionicons name="people-outline" size={22} color="#6b7280" /&gt;` |
| L491 | `"#0095f6"` | `COLORS.info` | `&lt;ActivityIndicator size="small" color="#0095f6" style={{ marginTop:` |
| L517 | `"#111827"` | `COLORS.textPrimary` | `&lt;Ionicons name="add-circle-outline" size={24} color="#111827" /&gt;` |
| L528 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="logo-whatsapp" size={24} color="#fff" /&gt;` |
| L539 | `"#111827"` | `COLORS.textPrimary` | `&lt;Ionicons name="link-outline" size={24} color="#111827" /&gt;` |
| L550 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="refresh-circle-outline" size={24} color="#fff" /&gt` |
| L561 | `"#111827"` | `COLORS.textPrimary` | `&lt;Ionicons name="share-social-outline" size={24} color="#111827" /&g` |
| L570 | `'#cccccc'` | `COLORS.surface` | `style={[styles.sendBtn, sendingMessage && { backgroundColor: '#cccccc'` |
| L597 | `"#8e8e8e"` | `COLORS.surface` | `&lt;Feather name="search" size={16} color="#8e8e8e" /&gt;` |
| L601 | `"#8e8e8e"` | `COLORS.surface` | `placeholderTextColor="#8e8e8e"` |
| L625 | `"#6b7280"` | `COLORS.textSecondary` | `&lt;Ionicons name="people-outline" size={22} color="#6b7280" /&gt;` |
| L631 | `"#0095f6"` | `COLORS.info` | `&lt;ActivityIndicator size="small" color="#0095f6" style={{ marginTop:` |
| L657 | `"#111827"` | `COLORS.textPrimary` | `&lt;Ionicons name="add-circle-outline" size={24} color="#111827" /&gt;` |
| L668 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="logo-whatsapp" size={24} color="#fff" /&gt;` |
| L679 | `"#111827"` | `COLORS.textPrimary` | `&lt;Ionicons name="link-outline" size={24} color="#111827" /&gt;` |
| L690 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="refresh-circle-outline" size={24} color="#fff" /&gt` |
| L701 | `"#111827"` | `COLORS.textPrimary` | `&lt;Ionicons name="share-social-outline" size={24} color="#111827" /&g` |
| L710 | `'#cccccc'` | `COLORS.surface` | `style={[styles.sendBtn, sendingMessage && { backgroundColor: '#cccccc'` |
| L732 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L741 | `'#dbdbdb'` | `COLORS.surface` | `backgroundColor: '#dbdbdb',` |
| L765 | `'#efefef'` | `COLORS.surface` | `backgroundColor: '#efefef',` |
| L774 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L781 | `'#efefef'` | `COLORS.surface` | `backgroundColor: '#efefef',` |
| L807 | `'#eee'` | `COLORS.border` | `backgroundColor: '#eee',` |
| L813 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L819 | `'#262626'` | `COLORS.surface` | `color: '#262626',` |
| L826 | `'#8e8e8e'` | `COLORS.surface` | `color: '#8e8e8e',` |
| L830 | `'#ececec'` | `COLORS.surface` | `borderTopColor: '#ececec',` |
| L831 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L837 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L846 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L863 | `'#f3f4f6'` | `COLORS.surface` | `backgroundColor: '#f3f4f6',` |
| L869 | `'#22c55e'` | `COLORS.surface` | `backgroundColor: '#22c55e',` |
| L873 | `'#262626'` | `COLORS.surface` | `color: '#262626',` |

---

## Step 9: app/podium.tsx

**Hex count**: 37 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L332 | `'#FFD700'` | `COLORS.surface` | `let bgColor = '#FFD700';` |
| L335 | `'#C0C0C0'` | `COLORS.surface` | `bgColor = '#C0C0C0';` |
| L338 | `'#CD7F32'` | `COLORS.surface` | `bgColor = '#CD7F32';` |
| L354 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L359 | `"#000"` | `COLORS.black` | `&lt;Feather name="message-square" size={22} color="#000" /&gt;` |
| L368 | `"#000"` | `COLORS.black` | `&lt;Feather name="bell" size={22} color="#000" /&gt;` |
| L406 | `"#888"` | `COLORS.textMuted` | `&lt;Ionicons name="close-circle" size={18} color="#888" /&gt;` |
| L426 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="podium" size={14} color="#ffffff" style={{ marginRi` |
| L482 | `"#000000"` | `COLORS.black` | `&lt;ActivityIndicator size="large" color="#000000" /&gt;` |
| L498 | `'#C0C0C0'` | `COLORS.surface` | `&lt;ExpoImage source={{ uri: normalizeMediaUrl(top2.creator.avatar) \|` |
| L503 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={14} color="#fff" /&gt;` |
| L516 | `'#3DC3FF'` | `COLORS.surface` | `&lt;LinearGradient colors={['#3DC3FF', '#0095f6']} style={[styles.pede` |
| L516 | `'#0095f6'` | `COLORS.info` | `&lt;LinearGradient colors={['#3DC3FF', '#0095f6']} style={[styles.pede` |
| L530 | `'#FFD700'` | `COLORS.surface` | `&lt;ExpoImage source={{ uri: normalizeMediaUrl(top1.creator.avatar) \|` |
| L535 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={16} color="#fff" /&gt;` |
| L548 | `'#59E094'` | `COLORS.surface` | `&lt;LinearGradient colors={['#59E094', '#00A36C']} style={[styles.pede` |
| L548 | `'#00A36C'` | `COLORS.surface` | `&lt;LinearGradient colors={['#59E094', '#00A36C']} style={[styles.pede` |
| L562 | `'#CD7F32'` | `COLORS.surface` | `&lt;ExpoImage source={{ uri: normalizeMediaUrl(top3.creator.avatar) \|` |
| L567 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={14} color="#fff" /&gt;` |
| L580 | `'#6CE5FF'` | `COLORS.surface` | `&lt;LinearGradient colors={['#6CE5FF', '#00B4D8']} style={[styles.pede` |
| L580 | `'#00B4D8'` | `COLORS.surface` | `&lt;LinearGradient colors={['#6CE5FF', '#00B4D8']} style={[styles.pede` |
| L649 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={18} color="#fff" /&gt;` |
| L731 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="settings" size={20} color="#FF8D00" /&gt;` |
| L734 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="chevron-right" size={18} color="#ccc" style={styles.` |
| L751 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="bookmark" size={20} color="#FF8D00" /&gt;` |
| L754 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="chevron-right" size={18} color="#ccc" style={styles.` |
| L771 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="shield" size={20} color="#FF8D00" /&gt;` |
| L774 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="chevron-right" size={18} color="#ccc" style={styles.` |
| L790 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="file-text" size={20} color="#FF8D00" /&gt;` |
| L793 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="chevron-right" size={18} color="#ccc" style={styles.` |
| L815 | `'#fee'` | `COLORS.surface` | `&lt;View style={[styles.iconContainer, { backgroundColor: '#fee' }]}&g` |
| L816 | `"#e74c3c"` | `COLORS.surface` | `&lt;Feather name="log-out" size={20} color="#e74c3c" /&gt;` |
| L841 | `'#FFD500'` | `COLORS.surface` | `backgroundColor: '#FFD500', // Figma Yellow Background` |
| L1101 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1241 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1266 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1326 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |

---

## Step 10: app/notifications.tsx

**Hex count**: 36 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L63 | `'#FF6B00'` | `COLORS.surface` | `case 'like': return '#FF6B00';` |
| L64 | `'#007aff'` | `COLORS.info` | `case 'comment': return '#007aff';` |
| L65 | `'#FF6B00'` | `COLORS.surface` | `case 'follow': return '#FF6B00';` |
| L66 | `'#FF6B00'` | `COLORS.surface` | `case 'follow-request': return '#FF6B00';` |
| L67 | `'#007aff'` | `COLORS.info` | `case 'follow-approved': return '#007aff';` |
| L68 | `'#FF6B00'` | `COLORS.surface` | `case 'new-follower': return '#FF6B00';` |
| L69 | `'#8b5cf6'` | `COLORS.surface` | `case 'mention': return '#8b5cf6';` |
| L71 | `'#007aff'` | `COLORS.info` | `case 'message': return '#007aff';` |
| L72 | `'#FF6B00'` | `COLORS.surface` | `case 'story-mention': return '#FF6B00';` |
| L73 | `'#007aff'` | `COLORS.info` | `case 'story-reply': return '#007aff';` |
| L74 | `'#FF6B00'` | `COLORS.surface` | `case 'tag': return '#FF6B00';` |
| L75 | `'#666'` | `COLORS.textSecondary` | `default: return '#666';` |
| L137 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: 36, height: 36, borderRadius: 18, backgroundC` |
| L138 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: 44, height: 44, borderRadius: 22, backgroundC` |
| L140 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: '60%', height: 16, borderRadius: 6, backgroun` |
| L141 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: '40%', height: 13, borderRadius: 6, backgroun` |
| L159 | `"#007aff"` | `COLORS.info` | `&lt;Feather name="arrow-left" size={20} color="#007aff" /&gt;` |
| L168 | `"#000"` | `COLORS.black` | `&lt;Feather name="briefcase" size={20} color="#000" /&gt;` |
| L175 | `'#007aff'` | `COLORS.info` | `style={{ backgroundColor: '#007aff', padding: 8, borderRadius: 8 }}` |
| L185 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: 'bold' }}&gt;Mark All Rea` |
| L188 | `'#FF3B30'` | `COLORS.danger` | `style={{ backgroundColor: '#FF3B30', padding: 8, borderRadius: 8 }}` |
| L198 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: 'bold' }}&gt;Clear All&lt` |
| L204 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="bell-off" size={64} color="#ccc" /&gt;` |
| L240 | `'#FF6B00'` | `COLORS.surface` | `&lt;Text style={{ fontWeight: '700', color: '#FF6B00' }}&gt;{String(it` |
| L241 | `'#444'` | `COLORS.textSecondary` | `&lt;Text style={{ fontWeight: '400', color: '#444' }}&gt; {getNotifica` |
| L268 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff'` |
| L277 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L282 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L293 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L298 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L307 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L310 | `'#f0f8ff'` | `COLORS.surface` | `backgroundColor: '#f0f8ff',` |
| L330 | `'#007aff'` | `COLORS.info` | `backgroundColor: '#007aff',` |
| L335 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L340 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L344 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0',` |

---

## Step 11: app/edit-profile.tsx

**Hex count**: 35 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L330 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="large" color="#FF8D00" /&gt;` |
| L331 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ marginTop: 16, color: '#666', fontSize: 14 }}&gt;Loa` |
| L354 | `"#333"` | `COLORS.textPrimary` | `&lt;Ionicons name="close" size={20} color="#333" /&gt;` |
| L378 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L390 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L403 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L414 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L425 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L463 | `"#667eea"` | `COLORS.surface` | `&lt;Ionicons name="lock-closed-outline" size={22} color="#667eea" styl` |
| L476 | `'#ddd'` | `COLORS.border` | `trackColor={{ false: '#ddd', true: '#667eea' }}` |
| L476 | `'#667eea'` | `COLORS.surface` | `trackColor={{ false: '#ddd', true: '#667eea' }}` |
| L477 | `"#fff"` | `COLORS.textLight` | `thumbColor="#fff"` |
| L549 | `'#FBBC04'` | `COLORS.primary (or keep in primaryGradient)` | `colors={['#FBBC04', '#FF8D00']}` |
| L549 | `'#FF8D00'` | `COLORS.primary` | `colors={['#FBBC04', '#FF8D00']}` |
| L562 | `'#fff'` | `COLORS.background` | `&lt;View style={{ backgroundColor: '#fff', borderRadius: 12, padding: ` |
| L563 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="large" color="#FF8D00" /&gt;` |
| L564 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ marginTop: 12, color: '#666', fontSize: 14 }}&gt;Loa` |
| L572 | `'#FF8D00'` | `COLORS.primary` | `const PRIMARY = '#FF8D00';` |
| L573 | `'#111'` | `COLORS.textPrimary` | `const SECONDARY = '#111';` |
| L576 | `'#fff'` | `COLORS.background` | `safe: { flex: 1, backgroundColor: '#fff' },` |
| L585 | `'#e0e0e0'` | `COLORS.border` | `borderBottomColor: '#e0e0e0'` |
| L594 | `'#ddd'` | `COLORS.border` | `borderColor: '#ddd',` |
| L599 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L605 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L625 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5'` |
| L635 | `'#444'` | `COLORS.textSecondary` | `color: '#444',` |
| L643 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L644 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L652 | `'#e0245e'` | `COLORS.surface` | `color: '#e0245e',` |
| L660 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L677 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L682 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L692 | `'#e0e0e0'` | `COLORS.border` | `borderTopColor: '#e0e0e0'` |
| L700 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L713 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |

---

## Step 12: app/map.tsx

**Hex count**: 35 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L512 | `'#c00'` | `COLORS.surface` | `&lt;Text style={{ color: '#c00', fontWeight: 'bold' }}&gt;` |
| L547 | `"#FF8D00"` | `COLORS.primary` | `&lt;Ionicons name="search" size={20} color="#FF8D00" /&gt;` |
| L577 | `"#111"` | `COLORS.textPrimary` | `&lt;Ionicons name="close" size={18} color="#111" /&gt;` |
| L587 | `"#777"` | `COLORS.surface` | `placeholderTextColor="#777"` |
| L618 | `"#111"` | `COLORS.textPrimary` | `&lt;Ionicons name="search" size={20} color="#111" /&gt;` |
| L652 | `"#111"` | `COLORS.textPrimary` | `&lt;ActivityIndicator size="small" color="#111" /&gt;` |
| L659 | `"#111"` | `COLORS.textPrimary` | `&lt;ActivityIndicator size="small" color="#111" /&gt;` |
| L661 | `'#c00'` | `COLORS.surface` | `&lt;Text style={{ color: '#c00' }}&gt;{locationError}&lt;/Text&gt;` |
| L663 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ color: '#666' }}&gt;No posts found&lt;/Text&gt;` |
| L678 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ color: '#666' }}&gt;No locations found&lt;/Text&gt;` |
| L714 | `'#fff'` | `COLORS.background` | `container: { flex: 1, backgroundColor: '#fff' },` |
| L717 | `'#c00'` | `COLORS.surface` | `errorText: { position: 'absolute', bottom: 20, color: '#c00', backgrou` |
| L726 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L729 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L751 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L768 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L771 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L783 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L794 | `'#d9d9d9'` | `COLORS.surface` | `backgroundColor: '#d9d9d9',` |
| L802 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L807 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L808 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L817 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L837 | `'#f0f0f0'` | `COLORS.inputBg` | `borderBottomColor: '#f0f0f0',` |
| L844 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L850 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L858 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L864 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L880 | `'#ffa726'` | `COLORS.surface` | `borderColor: '#ffa726',` |
| L881 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0',` |
| L885 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L895 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0',` |
| L909 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L936 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L958 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |

---

## Step 13: app/inbox.tsx

**Hex count**: 34 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L1157 | `'#111827'` | `COLORS.textPrimary` | `shadowColor: '#111827',` |
| L1356 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L1363 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |
| L1373 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1382 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L1395 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L1402 | `'#ff3b30'` | `COLORS.danger` | `color: '#ff3b30',` |
| L1407 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L1411 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L1417 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1424 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L1429 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L1443 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L1447 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L1450 | `'#ff3b30'` | `COLORS.danger` | `backgroundColor: '#ff3b30',` |
| L1454 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1461 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L1473 | `'#FF8D00'` | `COLORS.primary` | `borderColor: '#FF8D00'` |
| L1479 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0'` |
| L1499 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1504 | `'#000'` | `COLORS.black` | `color: '#000'` |
| L1507 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L1512 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L1517 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1521 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L1530 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1535 | `'#ff3b30'` | `COLORS.danger` | `backgroundColor: '#ff3b30',` |
| L1542 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1557 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L1565 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L1571 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L1577 | `'#FFB800'` | `COLORS.surface` | `backgroundColor: '#FFB800',` |
| L1584 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L1599 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |

---

## Step 14: src/_components/passport/LocationPickerModal.tsx

**Hex count**: 34 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L83 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="search" size={18} color="#FF8D00" style={{ marginRig` |
| L87 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L99 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="large" color="#FF8D00" /&gt;` |
| L117 | `"#fff"` | `COLORS.textLight` | `{includeCityStamp ? &lt;Feather name="check" size={16} color="#fff" /&` |
| L129 | `"#FF8D00"` | `COLORS.primary` | `{locationLoading && &lt;ActivityIndicator size="small" color="#FF8D00"` |
| L133 | `"#ddd"` | `COLORS.border` | `&lt;Feather name="map-pin" size={36} color="#ddd" /&gt;` |
| L154 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="map-pin" size={18} color="#FF8D00" /&gt;` |
| L169 | `"#fff"` | `COLORS.textLight` | `{selectedLocation?.placeId === place.placeId && &lt;Feather name="chec` |
| L189 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L202 | `'#f0f0f0'` | `COLORS.inputBg` | `borderBottomColor: '#f0f0f0',` |
| L207 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L215 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |
| L220 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L226 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L233 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L244 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L255 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L265 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L273 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L275 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L281 | `'#FF8D00'` | `COLORS.primary` | `borderColor: '#FF8D00',` |
| L282 | `'#F0F6FA'` | `COLORS.surface` | `backgroundColor: '#F0F6FA',` |
| L290 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |
| L298 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L302 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L311 | `'#eee'` | `COLORS.border` | `borderBottomColor: '#eee',` |
| L314 | `'#fafafa'` | `COLORS.surface` | `backgroundColor: '#fafafa',` |
| L325 | `'#F0F6FA'` | `COLORS.surface` | `backgroundColor: '#F0F6FA',` |
| L337 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L342 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L349 | `'#ddd'` | `COLORS.border` | `borderColor: '#ddd',` |
| L354 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L355 | `'#FF8D00'` | `COLORS.primary` | `borderColor: '#FF8D00',` |
| L365 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |

---

## Step 15: src/_components/profile/UploadStoryModal.tsx

**Hex count**: 30 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L75 | `'#fff'` | `COLORS.background` | `&lt;SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}&gt;` |
| L82 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="x" size={24} color="#333" /&gt;` |
| L126 | `"#007aff"` | `COLORS.info` | `&lt;Feather name="edit-2" size={16} color="#007aff" /&gt;` |
| L140 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L150 | `"#666"` | `COLORS.textSecondary` | `&lt;Feather name="map-pin" size={18} color="#666" /&gt;` |
| L156 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L176 | `"#007aff"` | `COLORS.info` | `&lt;Feather name="map-pin" size={16} color="#007aff" style={{ marginRi` |
| L192 | `"#007aff"` | `COLORS.info` | `&lt;ActivityIndicator size="small" color="#007aff" style={{ marginBott` |
| L264 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L269 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L279 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L290 | `'#007aff'` | `COLORS.info` | `color: '#007aff',` |
| L303 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L308 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L313 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0',` |
| L314 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L319 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L323 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0',` |
| L330 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L340 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L347 | `'#e0e0e0'` | `COLORS.border` | `backgroundColor: '#e0e0e0',` |
| L353 | `'#007aff'` | `COLORS.info` | `backgroundColor: '#007aff',` |
| L358 | `'#007aff'` | `COLORS.info` | `backgroundColor: '#007aff',` |
| L364 | `'#ccc'` | `COLORS.border` | `backgroundColor: '#ccc',` |
| L367 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L376 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L379 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0',` |
| L389 | `'#f0f0f0'` | `COLORS.inputBg` | `borderBottomColor: '#f0f0f0',` |
| L392 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L397 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |

---

## Step 16: app/new-group.tsx

**Hex count**: 29 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L215 | `"#fff"` | `COLORS.textLight` | `{checked ? &lt;Ionicons name="checkmark" size={20} color="#fff" /&gt; ` |
| L230 | `"#111"` | `COLORS.textPrimary` | `&lt;Feather name="arrow-left" size={30} color="#111" /&gt;` |
| L241 | `"#7b7b7b"` | `COLORS.surface` | `placeholderTextColor="#7b7b7b"` |
| L247 | `"#a3a3a3"` | `COLORS.surface` | `&lt;Feather name="search" size={34} color="#a3a3a3" style={{ marginRig` |
| L252 | `"#8e8e8e"` | `COLORS.surface` | `placeholderTextColor="#8e8e8e"` |
| L265 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="close" size={20} color="#fff" /&gt;` |
| L276 | `"#4f60f2"` | `COLORS.surface` | `&lt;ActivityIndicator style={{ marginTop: 24 }} size="small" color="#4` |
| L306 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L325 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L335 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L337 | `'#c8c8c8'` | `COLORS.surface` | `borderBottomColor: '#c8c8c8',` |
| L344 | `'#f1f2f7'` | `COLORS.surface` | `backgroundColor: '#f1f2f7',` |
| L353 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L370 | `'#efefef'` | `COLORS.surface` | `backgroundColor: '#efefef',` |
| L379 | `'#23262b'` | `COLORS.surface` | `backgroundColor: '#23262b',` |
| L383 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff',` |
| L389 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L395 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L407 | `'#ececec'` | `COLORS.surface` | `backgroundColor: '#ececec',` |
| L420 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L426 | `'#6f6f6f'` | `COLORS.textSecondary` | `color: '#6f6f6f',` |
| L433 | `'#7a828a'` | `COLORS.textSecondary` | `borderColor: '#7a828a',` |
| L436 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L439 | `'#111827'` | `COLORS.textPrimary` | `backgroundColor: '#111827',` |
| L440 | `'#111827'` | `COLORS.textPrimary` | `borderColor: '#111827',` |
| L447 | `'#efefef'` | `COLORS.surface` | `borderTopColor: '#efefef',` |
| L448 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L455 | `'#4f60f2'` | `COLORS.surface` | `backgroundColor: '#4f60f2',` |
| L461 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |

---

## Step 17: src/_components/profile/ProfileSubscriptions.tsx

**Hex count**: 28 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L59 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={[styles.avatar, { backgroundColor: '#e5e5ea' }]} /&gt;` |
| L61 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={{ width: 120, height: 16, backgroundColor: '#e5e5ea', ` |
| L62 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={{ width: 180, height: 12, backgroundColor: '#e5e5ea', ` |
| L63 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={{ width: 80, height: 12, backgroundColor: '#e5e5ea', b` |
| L67 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={[styles.btnSeeProfile, { backgroundColor: '#e5e5ea', w` |
| L68 | `'#d1d1d6'` | `COLORS.surface` | `&lt;View style={{ width: 60, height: 12, backgroundColor: '#d1d1d6', b` |
| L70 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={[styles.btnCancel, { backgroundColor: '#e5e5ea', width` |
| L71 | `'#d1d1d6'` | `COLORS.surface` | `&lt;View style={{ width: 100, height: 12, backgroundColor: '#d1d1d6', ` |
| L164 | `'#fff'` | `COLORS.textLight` | `&lt;Feather name="clock" size={14} color={filter === 'recent' ? '#fff'` |
| L164 | `'#fff'` | `COLORS.textLight` | `&lt;Feather name="clock" size={14} color={filter === 'recent' ? '#fff'` |
| L241 | `"#bbb"` | `COLORS.textMuted` | `&lt;Ionicons name="star-outline" size={40} color="#bbb" /&gt;` |
| L252 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L271 | `'#00a2ff'` | `COLORS.info` | `backgroundColor: '#00a2ff', // Figma light blue` |
| L277 | `'#000'` | `COLORS.black` | `backgroundColor: '#000', // Black inactive pills` |
| L280 | `'#007aff'` | `COLORS.info` | `backgroundColor: '#007aff', // Active filter highlight blue` |
| L282 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff',` |
| L287 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L294 | `'#f5f5f7'` | `COLORS.surface` | `backgroundColor: '#f5f5f7',` |
| L298 | `'#e5e5ea'` | `COLORS.border` | `borderColor: '#e5e5ea',` |
| L308 | `'#eee'` | `COLORS.border` | `backgroundColor: '#eee',` |
| L318 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L322 | `'#1c1c1e'` | `COLORS.textPrimary` | `color: '#1c1c1e',` |
| L327 | `'#1c1c1e'` | `COLORS.textPrimary` | `color: '#1c1c1e',` |
| L332 | `'#ff3b30'` | `COLORS.danger` | `color: '#ff3b30',` |
| L342 | `'#00a2ff'` | `COLORS.info` | `backgroundColor: '#00a2ff',` |
| L350 | `'#FF5A1F'` | `COLORS.accent` | `backgroundColor: '#FF5A1F', // Orange Cancel btn` |
| L358 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L370 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |

---

## Step 18: app/(tabs)/profile.tsx

**Hex count**: 27 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L797 | `'#888'` | `COLORS.textMuted` | `&lt;Text style={{ fontSize: 13, fontWeight: '500', color: '#888', lett` |
| L800 | `'#f5f5f5'` | `COLORS.surface` | `style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: ` |
| L803 | `"#000"` | `COLORS.black` | `&lt;Feather name="plus" size={12} color="#000" /&gt;` |
| L804 | `'#000'` | `COLORS.black` | `&lt;Text style={{ fontSize: 12, fontWeight: '600', color: '#000' }}&gt` |
| L824 | `'#007aff'` | `COLORS.info` | `&lt;Feather name="grid" size={20} color={segmentTab === 'grid' ? '#007` |
| L824 | `'#8e8e93'` | `COLORS.textMuted` | `&lt;Feather name="grid" size={20} color={segmentTab === 'grid' ? '#007` |
| L830 | `'#007aff'` | `COLORS.info` | `&lt;Feather name="user" size={20} color={segmentTab === 'tagged' ? '#0` |
| L830 | `'#8e8e93'` | `COLORS.textMuted` | `&lt;Feather name="user" size={20} color={segmentTab === 'tagged' ? '#0` |
| L837 | `'#007aff'` | `COLORS.info` | `&lt;Feather name="heart" size={20} color={segmentTab === 'heart' ? '#0` |
| L837 | `'#8e8e93'` | `COLORS.textMuted` | `&lt;Feather name="heart" size={20} color={segmentTab === 'heart' ? '#0` |
| L845 | `'#007aff'` | `COLORS.info` | `&lt;Feather name="star" size={20} color={segmentTab === 'star' ? '#007` |
| L845 | `'#8e8e93'` | `COLORS.textMuted` | `&lt;Feather name="star" size={20} color={segmentTab === 'star' ? '#007` |
| L853 | `'#007aff'` | `COLORS.info` | `&lt;Ionicons name="bar-chart" size={20} color={segmentTab === 'stats' ` |
| L853 | `'#8e8e93'` | `COLORS.textMuted` | `&lt;Ionicons name="bar-chart" size={20} color={segmentTab === 'stats' ` |
| L907 | `'#999'` | `COLORS.textMuted` | `&lt;Text style={{ fontSize: 18, color: '#999', marginBottom: 20 }}&gt;` |
| L909 | `'#007aff'` | `COLORS.info` | `style={{ backgroundColor: '#007aff', paddingHorizontal: 30, paddingVer` |
| L915 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}&g` |
| L947 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L958 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-left" size={20} color="#000" /&gt;` |
| L970 | `"#000"` | `COLORS.black` | `&lt;Feather name="message-circle" size={20} color="#000" strokeWidth={` |
| L974 | `"#000"` | `COLORS.black` | `&lt;Feather name="more-vertical" size={20} color="#000" /&gt;` |
| L982 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 16, color: '#666', marginBottom: 12 }}&gt;` |
| L983 | `'#007aff'` | `COLORS.info` | `&lt;TouchableOpacity onPress={refetchAll} style={{ backgroundColor: '#` |
| L984 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: 'bold' }}&gt;Retry&lt;/Te` |
| L1033 | `"#ccc"` | `COLORS.border` | `&lt;Ionicons name="lock-closed" size={48} color="#ccc" /&gt;` |
| L1034 | `'#999'` | `COLORS.textMuted` | `&lt;Text style={{ marginTop: 10, color: '#999' }}&gt;This account is p` |
| L1035 | `'#999'` | `COLORS.textMuted` | `&lt;Text style={{ textAlign: 'center', color: '#999', marginTop: 4 }}&` |

---

## Step 19: app/(tabs)/home.tsx

**Hex count**: 26 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L364 | `"#fff"` | `COLORS.textLight` | `tintColor="#fff"` |
| L365 | `"#FF8D00"` | `COLORS.primary` | `colors={["#FF8D00"]}` |
| L381 | `"#FF8D00"` | `COLORS.primary` | `color="#FF8D00"` |
| L418 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="add-circle" size={18} color="#ffffff" style={{ marg` |
| L463 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="arrow-back" size={24} color="#ffffff" /&gt;` |
| L481 | `"#ffffff"` | `COLORS.textLight` | `&lt;Feather name="bell" size={22} color="#ffffff" /&gt;` |
| L496 | `"#ffffff"` | `COLORS.textLight` | `&lt;Feather name="message-square" size={20} color="#ffffff" /&gt;` |
| L498 | `'#FF8D00'` | `COLORS.primary` | `&lt;View style={[styles.badge, { backgroundColor: '#FF8D00' }]}&gt;` |
| L510 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="search" size={16} color="#ffffff" style={styles.sea` |
| L546 | `'#000000'` | `COLORS.black` | `color={isActive ? '#000000' : '#ffffff'}` |
| L546 | `'#ffffff'` | `COLORS.textLight` | `color={isActive ? '#000000' : '#ffffff'}` |
| L578 | `"#000000"` | `COLORS.black` | `backgroundColor: "#000000",` |
| L584 | `'#000000'` | `COLORS.black` | `backgroundColor: '#000000',` |
| L599 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L622 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L628 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L643 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L676 | `'#ff3b30'` | `COLORS.danger` | `backgroundColor: '#ff3b30',` |
| L683 | `'#ffffff'` | `COLORS.textLight` | `borderColor: '#ffffff',` |
| L687 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L711 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L727 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L751 | `'#ffffff'` | `COLORS.background` | `backgroundColor: '#ffffff',` |
| L752 | `'#ffffff'` | `COLORS.textLight` | `borderColor: '#ffffff',` |
| L755 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L760 | `'#000000'` | `COLORS.black` | `color: '#000000',` |

---

## Step 20: src/_components/CreatePost/VerifiedLocationModal.tsx

**Hex count**: 26 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L64 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L76 | `'#e0e0e0'` | `COLORS.border` | `&lt;View style={{ width: 40, height: 4, backgroundColor: '#e0e0e0', bo` |
| L80 | `"#000"` | `COLORS.black` | `&lt;Feather name="lock" size={16} color="#000" style={{ marginRight: 8` |
| L81 | `'#000'` | `COLORS.black` | `&lt;Text style={{ fontWeight: '500', fontSize: 16, color: '#000' }}&gt` |
| L83 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ color: '#666', fontSize: 14, textAlign: 'center', ma` |
| L87 | `'#f9f9f9'` | `COLORS.surface` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', backgrou` |
| L87 | `'#f0f0f0'` | `COLORS.inputBg` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', backgrou` |
| L88 | `"#000"` | `COLORS.black` | `&lt;Feather name="search" size={18} color="#000" style={{ marginRight:` |
| L90 | `'#000'` | `COLORS.black` | `style={{ flex: 1, fontSize: 15, color: '#000' }}` |
| L92 | `"#666"` | `COLORS.textSecondary` | `placeholderTextColor="#666"` |
| L121 | `'#111'` | `COLORS.textPrimary` | `return &lt;Text style={{ fontWeight: '700', fontSize: 14, color: '#111` |
| L124 | `'#888'` | `COLORS.textMuted` | `return &lt;Text style={{ color: '#888', marginBottom: 12, textAlign: '` |
| L127 | `"#FF8D00"` | `COLORS.primary` | `return &lt;ActivityIndicator size="small" color="#FF8D00" style={{ mar` |
| L135 | `'#f2f2f2'` | `COLORS.surface` | `style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: ` |
| L142 | `'#f0f0f0'` | `COLORS.inputBg` | `&lt;View style={{ width: 44, height: 44, borderRadius: 12, backgroundC` |
| L143 | `"#000"` | `COLORS.black` | `&lt;Feather name="map-pin" size={18} color="#000" /&gt;` |
| L146 | `'#FF8D00'` | `COLORS.primary` | `&lt;Text style={{ fontSize: 15, fontWeight: '600', color: isSelected ?` |
| L146 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 15, fontWeight: '600', color: isSelected ?` |
| L147 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ color: '#666', fontSize: 13, marginTop: 2 }}&gt;{(it` |
| L150 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="check" size={20} color="#FF8D00" style={{ marginLeft` |
| L155 | `'#888'` | `COLORS.textMuted` | `ListEmptyComponent={(!loadingVerifiedResults && verifiedResults.length` |
| L165 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ color: '#111', fontWeight: '700', fontSize: 15 }}&gt` |
| L170 | `'#000'` | `COLORS.black` | `style={{ backgroundColor: '#000', borderRadius: 6, paddingHorizontal: ` |
| L172 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}&gt` |
| L176 | `'#FF8D00'` | `COLORS.primary` | `style={{ backgroundColor: '#FF8D00', borderRadius: 8, paddingHorizonta` |
| L178 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}&gt` |

---

## Step 21: src/_components/GroupsDrawer.tsx

**Hex count**: 26 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L44 | `'#4F8EF7'` | `COLORS.surface` | `friends: { bg: '#4F8EF7', light: '#EBF2FF', text: '#2563EB' },` |
| L44 | `'#EBF2FF'` | `COLORS.surface` | `friends: { bg: '#4F8EF7', light: '#EBF2FF', text: '#2563EB' },` |
| L44 | `'#2563EB'` | `COLORS.primary` | `friends: { bg: '#4F8EF7', light: '#EBF2FF', text: '#2563EB' },` |
| L45 | `'#F97316'` | `COLORS.surface` | `family: { bg: '#F97316', light: '#FFF3E8', text: '#C2410C' },` |
| L45 | `'#FFF3E8'` | `COLORS.surface` | `family: { bg: '#F97316', light: '#FFF3E8', text: '#C2410C' },` |
| L45 | `'#C2410C'` | `COLORS.surface` | `family: { bg: '#F97316', light: '#FFF3E8', text: '#C2410C' },` |
| L46 | `'#8B5CF6'` | `COLORS.surface` | `custom: { bg: '#8B5CF6', light: '#F3EEFF', text: '#6D28D9' },` |
| L46 | `'#F3EEFF'` | `COLORS.surface` | `custom: { bg: '#8B5CF6', light: '#F3EEFF', text: '#6D28D9' },` |
| L46 | `'#6D28D9'` | `COLORS.surface` | `custom: { bg: '#8B5CF6', light: '#F3EEFF', text: '#6D28D9' },` |
| L98 | `"#999"` | `COLORS.textMuted` | `&lt;Feather name="x" size={13} color="#999" /&gt;` |
| L138 | `"#9CA3AF"` | `COLORS.textMuted` | `&lt;Feather name="search" size={16} color="#9CA3AF" style={{ marginRig` |
| L142 | `"#9CA3AF"` | `COLORS.textMuted` | `placeholderTextColor="#9CA3AF"` |
| L149 | `"#9CA3AF"` | `COLORS.textMuted` | `&lt;Feather name="x-circle" size={16} color="#9CA3AF" /&gt;` |
| L156 | `"#4F8EF7"` | `COLORS.surface` | `&lt;ActivityIndicator size="small" color="#4F8EF7" style={{ marginTop:` |
| L180 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="plus" size={14} color="#fff" /&gt;` |
| L187 | `"#E5E7EB"` | `COLORS.border` | `&lt;Feather name="user-x" size={32} color="#E5E7EB" /&gt;` |
| L269 | `"#F87171"` | `COLORS.surface` | `&lt;Feather name="trash-2" size={15} color="#F87171" /&gt;` |
| L271 | `"#9CA3AF"` | `COLORS.textMuted` | `&lt;Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} ` |
| L281 | `"#D1D5DB"` | `COLORS.border` | `&lt;Feather name="user" size={20} color="#D1D5DB" /&gt;` |
| L384 | `"#000"` | `COLORS.black` | `&lt;Feather name="x" size={20} color="#000" /&gt;` |
| L432 | `"#4F8EF7"` | `COLORS.surface` | `&lt;ActivityIndicator size="large" color="#4F8EF7" /&gt;` |
| L440 | `"#D1D5DB"` | `COLORS.border` | `&lt;Feather name="users" size={32} color="#D1D5DB" /&gt;` |
| L457 | `"#10B981"` | `COLORS.success` | `&lt;Feather name="check-circle" size={14} color="#10B981" /&gt;` |
| L475 | `"#9CA3AF"` | `COLORS.textMuted` | `&lt;Feather name="x" size={20} color="#9CA3AF" /&gt;` |
| L483 | `"#9CA3AF"` | `COLORS.textMuted` | `placeholderTextColor="#9CA3AF"` |
| L515 | `"#fff"` | `COLORS.textLight` | `&lt;ActivityIndicator size="small" color="#fff" /&gt;` |

---

## Step 22: src/_components/PostCard/PostCard.styles.ts

**Hex count**: 26 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L7 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L16 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L34 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L45 | `'#444'` | `COLORS.textSecondary` | `color: '#444',` |
| L52 | `'#aaa'` | `COLORS.textMuted` | `backgroundColor: '#aaa',` |
| L57 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L62 | `"#000"` | `COLORS.black` | `backgroundColor: "#000",` |
| L95 | `'#f8f9fa'` | `COLORS.surface` | `backgroundColor: '#f8f9fa',` |
| L101 | `'#eee'` | `COLORS.border` | `borderColor: '#eee',` |
| L113 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L118 | `'#F3F4F6'` | `COLORS.surface` | `backgroundColor: '#F3F4F6',` |
| L125 | `'#f0f2f5'` | `COLORS.inputBg` | `backgroundColor: '#f0f2f5',` |
| L138 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L142 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L157 | `'#667eea'` | `COLORS.surface` | `color: '#667eea',` |
| L170 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L173 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L187 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L232 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L256 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L260 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L297 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L303 | `'#bbb'` | `COLORS.textMuted` | `color: '#bbb',` |
| L309 | `'#FFD60A'` | `COLORS.warning` | `backgroundColor: '#FFD60A',` |
| L313 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L320 | `'#000'` | `COLORS.black` | `color: '#000',` |

---

## Step 23: app/story-creator.tsx

**Hex count**: 25 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L76 | `'#ffffff'` | `COLORS.white` | `'#ffffff', '#000000', '#FFD700', '#FF4444',` |
| L76 | `'#000000'` | `COLORS.black` | `'#ffffff', '#000000', '#FFD700', '#FF4444',` |
| L76 | `'#FFD700'` | `COLORS.surface` | `'#ffffff', '#000000', '#FFD700', '#FF4444',` |
| L76 | `'#FF4444'` | `COLORS.surface` | `'#ffffff', '#000000', '#FFD700', '#FF4444',` |
| L77 | `'#44CFFF'` | `COLORS.surface` | `'#44CFFF', '#44FF88', '#FF44CC', '#FF8800',` |
| L77 | `'#44FF88'` | `COLORS.surface` | `'#44CFFF', '#44FF88', '#FF44CC', '#FF8800',` |
| L77 | `'#FF44CC'` | `COLORS.surface` | `'#44CFFF', '#44FF88', '#FF44CC', '#FF8800',` |
| L77 | `'#FF8800'` | `COLORS.surface` | `'#44CFFF', '#44FF88', '#FF44CC', '#FF8800',` |
| L78 | `'#8B44FF'` | `COLORS.surface` | `'#8B44FF', '#FF6B6B', '#4ECDC4', '#96E6A1',` |
| L78 | `'#FF6B6B'` | `COLORS.surface` | `'#8B44FF', '#FF6B6B', '#4ECDC4', '#96E6A1',` |
| L78 | `'#4ECDC4'` | `COLORS.surface` | `'#8B44FF', '#FF6B6B', '#4ECDC4', '#96E6A1',` |
| L78 | `'#96E6A1'` | `COLORS.surface` | `'#8B44FF', '#FF6B6B', '#4ECDC4', '#96E6A1',` |
| L195 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="x" size={14} color="#fff" /&gt;` |
| L278 | `'#000'` | `COLORS.black` | `&lt;View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'c` |
| L279 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" /&gt;` |
| L374 | `'#ffffff'` | `COLORS.white` | `const [editingColor, setEditingColor] = useState('#ffffff');` |
| L575 | `'#ffffff'` | `COLORS.white` | `setEditingColor('#ffffff');` |
| L653 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="video" size={10} color="#fff" /&gt;` |
| L674 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="camera" size={30} color="#333" /&gt;` |
| L1013 | `'#000'` | `COLORS.black` | `&lt;View style={{ flex: 1, backgroundColor: '#000' }}&gt;` |
| L1033 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="x" size={24} color="#fff" /&gt;` |
| L1048 | `"#ff5555"` | `COLORS.surface` | `&lt;Feather name="trash-2" size={20} color="#ff5555" /&gt;` |
| L1075 | `"#FF8D00"` | `COLORS.primary` | `selectionColor="#FF8D00"` |
| L1239 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L1593 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |

---

## Step 24: src/_components/EditSectionsModal.tsx

**Hex count**: 25 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L530 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="close" size={24} color="#000" /&gt;` |
| L543 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="add" size={20} color="#000" style={{ marginRight: 8` |
| L557 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="checkmark" size={20} color="#fff" /&gt;` |
| L560 | `"#666"` | `COLORS.textSecondary` | `&lt;Ionicons name="close" size={20} color="#666" /&gt;` |
| L631 | `'#fff'` | `COLORS.textLight` | `color={selectedSection?.visibility === v ? '#fff' : '#666'}` |
| L631 | `'#666'` | `COLORS.textSecondary` | `color={selectedSection?.visibility === v ? '#fff' : '#666'}` |
| L645 | `'#f5f7fa'` | `COLORS.border` | `&lt;View style={[styles.searchWrapEdit, { height: 46, borderRadius: 23` |
| L645 | `'#eef0f2'` | `COLORS.surface` | `&lt;View style={[styles.searchWrapEdit, { height: 46, borderRadius: 23` |
| L646 | `"#FF8D00"` | `COLORS.primary` | `&lt;Ionicons name="search" size={18} color="#FF8D00" style={{ marginRi` |
| L650 | `"#99aab5"` | `COLORS.surface` | `placeholderTextColor="#99aab5"` |
| L657 | `"#ccc"` | `COLORS.border` | `&lt;Ionicons name="close-circle" size={18} color="#ccc" /&gt;` |
| L664 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" /&gt;` |
| L680 | `"#ff3b30"` | `COLORS.danger` | `color={isCollab ? "#ff3b30" : "#4CAF50"}` |
| L680 | `"#4CAF50"` | `COLORS.surface` | `color={isCollab ? "#ff3b30" : "#4CAF50"}` |
| L715 | `"#4CAF50"` | `COLORS.surface` | `&lt;Ionicons name="checkmark-circle" size={28} color="#4CAF50" /&gt;` |
| L720 | `"#FFD700"` | `COLORS.surface` | `&lt;Ionicons name="star" size={20} color="#FFD700" /&gt;` |
| L791 | `"#999"` | `COLORS.textMuted` | `&lt;Ionicons name="menu" size={24} color={isOwner ? "#999" : "#eee"} /` |
| L791 | `"#eee"` | `COLORS.border` | `&lt;Ionicons name="menu" size={24} color={isOwner ? "#999" : "#eee"} /` |
| L812 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="albums-outline" size={18} color="#fff" style={{ mar` |
| L817 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name={isPrivate ? "lock-closed-outline" : "globe-outline"` |
| L823 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="trash-outline" size={18} color="#fff" style={{ marg` |
| L839 | `"#666"` | `COLORS.textSecondary` | `{isPrivate && &lt;Ionicons name="lock-closed" size={12} color="#666" s` |
| L845 | `"#666"` | `COLORS.textSecondary` | `&lt;Ionicons name="people" size={14} color="#666" style={{ marginRight` |
| L846 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 12, color: '#666' }}&gt;{item.collaborator` |
| L1039 | `'#FFD700'` | `COLORS.surface` | `color: '#FFD700',` |

---

## Step 25: app/edit-post.tsx

**Hex count**: 23 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L241 | `"#8e8e8e"` | `COLORS.surface` | `placeholderTextColor="#8e8e8e"` |
| L286 | `"#b0b0b0"` | `COLORS.surface` | `placeholderTextColor="#b0b0b0"` |
| L297 | `'#fff'` | `COLORS.background` | `safe: { flex: 1, backgroundColor: '#fff' },` |
| L301 | `'#efefef'` | `COLORS.surface` | `borderBottomColor: '#efefef',` |
| L307 | `'#262626'` | `COLORS.surface` | `title: { fontSize: 16, fontWeight: '700', color: '#262626' },` |
| L309 | `'#262626'` | `COLORS.surface` | `headerBtnText: { color: '#262626', fontSize: 16, fontWeight: '400' },` |
| L310 | `'#0095f6'` | `COLORS.info` | `doneText: { color: '#0095f6', fontSize: 16, fontWeight: '700' },` |
| L319 | `'#efefef'` | `COLORS.surface` | `backgroundColor: '#efefef',` |
| L329 | `'#efefef'` | `COLORS.surface` | `backgroundColor: '#efefef',` |
| L333 | `'#262626'` | `COLORS.surface` | `avatarText: { fontSize: 16, fontWeight: '800', color: '#262626' },` |
| L334 | `'#262626'` | `COLORS.surface` | `username: { fontSize: 14, fontWeight: '700', color: '#262626', marginB` |
| L335 | `'#262626'` | `COLORS.surface` | `sectionLabel: { marginTop: 18, marginBottom: 10, fontSize: 13, color: ` |
| L341 | `'#f2f2f2'` | `COLORS.surface` | `backgroundColor: '#f2f2f2',` |
| L343 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0',` |
| L346 | `'#0095f6'` | `COLORS.info` | `backgroundColor: '#0095f6',` |
| L347 | `'#0095f6'` | `COLORS.info` | `borderColor: '#0095f6',` |
| L349 | `'#262626'` | `COLORS.surface` | `categoryChipText: { color: '#262626', fontSize: 13, fontWeight: '600' ` |
| L350 | `'#fff'` | `COLORS.textLight` | `categoryChipTextSelected: { color: '#fff' },` |
| L354 | `'#262626'` | `COLORS.surface` | `color: '#262626',` |
| L359 | `'#8e8e8e'` | `COLORS.surface` | `hiddenLabel: { marginTop: 16, fontSize: 12, color: '#8e8e8e', fontWeig` |
| L364 | `'#f0f0f0'` | `COLORS.inputBg` | `borderColor: '#f0f0f0',` |
| L369 | `'#555'` | `COLORS.surface` | `color: '#555',` |
| L371 | `'#fafafa'` | `COLORS.surface` | `backgroundColor: '#fafafa',` |

---

## Step 26: src/_components/CreateHighlightModal.tsx

**Hex count**: 23 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L217 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" /&gt;` |
| L218 | `'#999'` | `COLORS.textMuted` | `&lt;Text style={{ marginTop: 8, color: '#999', fontSize: 13 }}&gt;Load` |
| L225 | `"#ccc"` | `COLORS.border` | `&lt;Ionicons name="images-outline" size={40} color="#ccc" /&gt;` |
| L226 | `'#999'` | `COLORS.textMuted` | `&lt;Text style={{ color: '#999', fontSize: 14, marginTop: 10, textAlig` |
| L227 | `'#bbb'` | `COLORS.textMuted` | `&lt;Text style={{ color: '#bbb', fontSize: 12, marginTop: 4, textAlign` |
| L235 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 15, fontWeight: '700', color: '#111', marg` |
| L251 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L253 | `'#007aff'` | `COLORS.info` | `borderColor: '#007aff',` |
| L265 | `'#007aff'` | `COLORS.info` | `backgroundColor: isSelected ? '#007aff' : 'rgba(0,0,0,0.3)',` |
| L272 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff'` |
| L274 | `"#fff"` | `COLORS.textLight` | `{isSelected && &lt;Ionicons name="checkmark" size={12} color="#fff" /&` |
| L279 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={14} color="#fff" /&gt;` |
| L316 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" /&gt;` |
| L318 | `'#007aff'` | `COLORS.info` | `&lt;Text style={[styles.headerActionText, styles.headerSaveText, (name` |
| L336 | `"#ccc"` | `COLORS.border` | `&lt;Ionicons name="image-outline" size={48} color="#ccc" /&gt;` |
| L346 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L355 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="eye-outline" size={22} color="#000" /&gt;` |
| L359 | `'#007aff'` | `COLORS.info` | `&lt;Text style={{ color: '#007aff', fontSize: 15, marginRight: 8, font` |
| L360 | `"#666"` | `COLORS.textSecondary` | `&lt;Ionicons name="chevron-forward" size={20} color="#666" /&gt;` |
| L391 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L403 | `'#ffffff'` | `COLORS.background` | `backgroundColor: '#ffffff',` |
| L408 | `'#eee'` | `COLORS.border` | `backgroundColor: '#eee',` |
| L442 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |

---

## Step 27: app/saved-posts.tsx

**Hex count**: 22 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L167 | `"#007aff"` | `COLORS.info` | `&lt;Ionicons name="bookmark" size={20} color="#007aff" /&gt;` |
| L178 | `"#ff3b30"` | `COLORS.danger` | `&lt;Ionicons name="heart" size={14} color="#ff3b30" /&gt;` |
| L182 | `"#007aff"` | `COLORS.info` | `&lt;Ionicons name="chatbubble" size={14} color="#007aff" /&gt;` |
| L186 | `"#34c759"` | `COLORS.success` | `&lt;Ionicons name="bookmark" size={14} color="#34c759" /&gt;` |
| L198 | `"#007aff"` | `COLORS.info` | `&lt;ActivityIndicator size="large" color="#007aff" /&gt;` |
| L209 | `"#222"` | `COLORS.textPrimary` | `&lt;Ionicons name="chevron-back" size={28} color="#222" /&gt;` |
| L213 | `"#222"` | `COLORS.textPrimary` | `&lt;Ionicons name="refresh" size={24} color="#222" /&gt;` |
| L219 | `"#ccc"` | `COLORS.border` | `&lt;Ionicons name="bookmark-outline" size={64} color="#ccc" /&gt;` |
| L241 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L250 | `'#f0f0f0'` | `COLORS.inputBg` | `borderBottomColor: '#f0f0f0',` |
| L255 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L265 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L276 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L281 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L290 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L295 | `'#f0f0f0'` | `COLORS.inputBg` | `borderColor: '#f0f0f0',` |
| L301 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L310 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L314 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L325 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L336 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L352 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |

---

## Step 28: src/_components/profile/ProfileModals.tsx

**Hex count**: 22 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L60 | `'#222'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 20, fontWeight: '700', color: '#222', marg` |
| L61 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 14, color: '#666' }}&gt;View specific sets` |
| L74 | `"#666"` | `COLORS.textSecondary` | `&lt;Ionicons name="grid" size={20} color="#666" /&gt;` |
| L96 | `"#666"` | `COLORS.textSecondary` | `&lt;Ionicons name="folder-outline" size={20} color="#666" /&gt;` |
| L151 | `'#FFF0F0'` | `COLORS.primaryLight (or dangerLight)` | `&lt;View style={[styles.menuIconContainer, { backgroundColor: '#FFF0F0` |
| L152 | `"#FF4B4B"` | `COLORS.danger` | `&lt;Feather name="flag" size={18} color="#FF4B4B" /&gt;` |
| L154 | `'#FF4B4B'` | `COLORS.danger` | `&lt;Text style={[styles.menuItemText, { color: '#FF4B4B' }]}&gt;Report` |
| L160 | `'#F0F0F0'` | `COLORS.inputBg` | `&lt;View style={[styles.menuIconContainer, { backgroundColor: '#F0F0F0` |
| L161 | `"#222"` | `COLORS.textPrimary` | `&lt;Feather name="slash" size={18} color="#222" /&gt;` |
| L171 | `'#F0F7FF'` | `COLORS.primaryLight` | `&lt;View style={[styles.menuIconContainer, { backgroundColor: '#F0F7FF` |
| L172 | `"#007AFF"` | `COLORS.info` | `&lt;Feather name="share-2" size={18} color="#007AFF" /&gt;` |
| L197 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L214 | `'#ddd'` | `COLORS.border` | `backgroundColor: '#ddd',` |
| L233 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L238 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0',` |
| L246 | `'#f8f8f8'` | `COLORS.surface` | `backgroundColor: '#f8f8f8',` |
| L253 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L261 | `'#f0f0f0'` | `COLORS.inputBg` | `borderBottomColor: '#f0f0f0',` |
| L268 | `'#eee'` | `COLORS.border` | `backgroundColor: '#eee',` |
| L275 | `'#f2f2f2'` | `COLORS.surface` | `backgroundColor: '#f2f2f2',` |
| L281 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L285 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |

---

## Step 29: src/_components/CreatePost/CategoryModal.tsx

**Hex count**: 21 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L41 | `'#FFF8F0'` | `COLORS.surface` | `backgroundColor: isSelected ? '#FFF8F0' : '#FAFAFA',` |
| L41 | `'#FAFAFA'` | `COLORS.surface` | `backgroundColor: isSelected ? '#FFF8F0' : '#FAFAFA',` |
| L45 | `'#FFE0B2'` | `COLORS.surface` | `borderColor: isSelected ? '#FFE0B2' : '#F0F0F0'` |
| L45 | `'#F0F0F0'` | `COLORS.inputBg` | `borderColor: isSelected ? '#FFE0B2' : '#F0F0F0'` |
| L57 | `'#FF8D00'` | `COLORS.primary` | `&lt;Text style={{ fontSize: 15, fontWeight: isSelected ? '600' : '400'` |
| L57 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 15, fontWeight: isSelected ? '600' : '400'` |
| L63 | `"#FF8D00"` | `COLORS.primary` | `color={isSelected ? "#FF8D00" : "#B0B0B0"}` |
| L63 | `"#B0B0B0"` | `COLORS.surface` | `color={isSelected ? "#FF8D00" : "#B0B0B0"}` |
| L86 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L98 | `'#e0e0e0'` | `COLORS.border` | `&lt;View style={{ width: 40, height: 4, backgroundColor: '#e0e0e0', bo` |
| L100 | `'#000'` | `COLORS.black` | `&lt;Text style={{ fontWeight: '500', fontSize: 16, marginBottom: 8, co` |
| L101 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ color: '#666', fontSize: 14, textAlign: 'center', ma` |
| L105 | `'#f9f9f9'` | `COLORS.surface` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', backgrou` |
| L105 | `'#f0f0f0'` | `COLORS.inputBg` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', backgrou` |
| L106 | `"#000"` | `COLORS.black` | `&lt;Feather name="search" size={18} color="#000" style={{ marginRight:` |
| L108 | `'#000'` | `COLORS.black` | `style={{ flex: 1, fontSize: 15, color: '#000' }}` |
| L110 | `"#666"` | `COLORS.textSecondary` | `placeholderTextColor="#666"` |
| L129 | `'#888'` | `COLORS.textMuted` | `&lt;Text style={{ color: '#888' }}&gt;No categories found&lt;/Text&gt;` |
| L136 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ color: '#111', fontWeight: '700', fontSize: 15 }}&gt` |
| L140 | `'#FF8D00'` | `COLORS.primary` | `style={{ backgroundColor: '#FF8D00', borderRadius: 8, paddingHorizonta` |
| L142 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}&gt` |

---

## Step 30: src/_components/PostCard.tsx

**Hex count**: 21 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L377 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="person-outline" size={16} color="#fff" /&gt;` |
| L416 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L423 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="person" size={10} color="#fff" style={{ marginRight` |
| L424 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}&gt` |
| L435 | `'#fff'` | `COLORS.background` | `&lt;View style={{ backgroundColor: '#fff' }}&gt;` |
| L476 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L482 | `'#ddd'` | `COLORS.border` | `&lt;View style={{ height: 4, width: 40, backgroundColor: '#ddd', borde` |
| L498 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="edit-3" size={22} color="#333" /&gt;` |
| L526 | `"#ff4d4d"` | `COLORS.surface` | `&lt;Feather name="trash-2" size={22} color="#ff4d4d" /&gt;` |
| L527 | `'#ff4d4d'` | `COLORS.surface` | `&lt;Text style={{ marginLeft: 15, fontSize: 16, fontWeight: '500', col` |
| L541 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="share-2" size={22} color="#333" /&gt;` |
| L563 | `"#ff4d4d"` | `COLORS.surface` | `&lt;Feather name="flag" size={22} color="#ff4d4d" /&gt;` |
| L564 | `'#ff4d4d'` | `COLORS.surface` | `&lt;Text style={{ marginLeft: 15, fontSize: 16, fontWeight: '500', col` |
| L599 | `"#ff4d4d"` | `COLORS.surface` | `&lt;Feather name="slash" size={22} color="#ff4d4d" /&gt;` |
| L600 | `'#ff4d4d'` | `COLORS.surface` | `&lt;Text style={{ marginLeft: 15, fontSize: 16, fontWeight: '500', col` |
| L609 | `'#0095f6'` | `COLORS.info` | `&lt;Text style={{ fontSize: 16, fontWeight: '600', color: '#0095f6' }}` |
| L637 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L652 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L655 | `'#ddd'` | `COLORS.border` | `&lt;View style={{ height: 5, width: 40, backgroundColor: '#ddd', borde` |
| L676 | `'#000'` | `COLORS.black` | `&lt;View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'c` |
| L678 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="close-circle" size={40} color="#fff" /&gt;` |

---

## Step 31: src/_components/AddStoriesToHighlightModal.tsx

**Hex count**: 20 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L123 | `"#4CAF50"` | `COLORS.surface` | `&lt;Ionicons name="checkmark-circle" size={32} color="#4CAF50" /&gt;` |
| L140 | `"#ccc"` | `COLORS.border` | `&lt;Ionicons name="images-outline" size={48} color="#ccc" /&gt;` |
| L151 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="close" size={24} color="#000" /&gt;` |
| L201 | `"#fff"` | `COLORS.textLight` | `&lt;ActivityIndicator color="#fff" /&gt;` |
| L217 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L235 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L249 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L251 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0',` |
| L254 | `'#4CAF50'` | `COLORS.surface` | `borderColor: '#4CAF50',` |
| L269 | `'#f9f9f9'` | `COLORS.surface` | `backgroundColor: '#f9f9f9',` |
| L274 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L278 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L288 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L293 | `'#f0f8ff'` | `COLORS.surface` | `backgroundColor: '#f0f8ff',` |
| L298 | `'#0066cc'` | `COLORS.surface` | `color: '#0066cc',` |
| L313 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L315 | `'#ddd'` | `COLORS.border` | `borderColor: '#ddd',` |
| L320 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L323 | `'#4CAF50'` | `COLORS.surface` | `backgroundColor: '#4CAF50',` |
| L328 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |

---

## Step 32: src/_components/StoriesViewer.tsx

**Hex count**: 20 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L513 | `'#000'` | `COLORS.black` | `&lt;SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}&gt;` |
| L515 | `"#fff"` | `COLORS.textLight` | `&lt;ActivityIndicator size="large" color="#fff" /&gt;` |
| L615 | `'#000'` | `COLORS.black` | `&lt;View style={{ flex: 1, backgroundColor: '#000' }}&gt;` |
| L632 | `'#000'` | `COLORS.black` | `&lt;View style={{ flex: 1, backgroundColor: '#000', position: 'relativ` |
| L686 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="more-horizontal" size={16} color="#333" style={{ mar` |
| L696 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ fontWeight: '700', color: '#111' }}&gt;{currentStory` |
| L702 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 12, color: '#666' }}&gt;View post&lt;/Text` |
| L766 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontSize: 14 }}&gt;Story media unavai` |
| L818 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="` |
| L822 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name={isPaused ? "play" : "pause"} size={20} color="#fff" ` |
| L825 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="x" size={26} color="#fff" /&gt;` |
| L845 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="film" size={22} color="#fff" /&gt;` |
| L905 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="trash-2" size={24} color="#fff" /&gt;` |
| L911 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="chevrons-up" size={24} color="#fff" /&gt;` |
| L916 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="image" size={22} color="#fff" /&gt;` |
| L921 | `"#fff"` | `COLORS.textLight` | `&lt;MaterialCommunityIcons name="comment-outline" size={24} color="#ff` |
| L927 | `"#e74c3c"` | `COLORS.surface` | `&lt;Ionicons name="heart" size={24} color="#e74c3c" /&gt;` |
| L929 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="heart" size={24} color="#fff" strokeWidth={2.5} /&gt` |
| L935 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="send" size={24} color="#fff" /&gt;` |
| L1075 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |

---

## Step 33: app/location/[placeId].tsx

**Hex count**: 19 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L217 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="play" size={10} color="#fff" style={{ marginRight: 2` |
| L252 | `'#f2f2f2'` | `COLORS.surface` | `&lt;View style={{ width: 80, height: 80, backgroundColor: '#f2f2f2', b` |
| L254 | `'#f2f2f2'` | `COLORS.surface` | `&lt;View style={{ height: 20, width: '70%', backgroundColor: '#f2f2f2'` |
| L255 | `'#f2f2f2'` | `COLORS.surface` | `&lt;View style={{ height: 15, width: '40%', backgroundColor: '#f2f2f2'` |
| L258 | `'#f2f2f2'` | `COLORS.surface` | `&lt;View style={{ height: 300, backgroundColor: '#f2f2f2', borderRadiu` |
| L961 | `'#fff'` | `COLORS.background` | `&lt;SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}&gt;` |
| L964 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-left" size={28} color="#000" /&gt;` |
| L978 | `'#fff'` | `COLORS.background` | `&lt;SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}&gt;` |
| L981 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-left" size={28} color="#000" /&gt;` |
| L984 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ margin: 24, fontSize: 16, color: '#666', textAlign: ` |
| L1008 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-left" size={28} color="#000" /&gt;` |
| L1018 | `"#000"` | `COLORS.black` | `&lt;Feather name="briefcase" size={20} color="#000" /&gt;` |
| L1027 | `"#000"` | `COLORS.black` | `&lt;Feather name="message-square" size={20} color="#000" /&gt;` |
| L1037 | `"#000"` | `COLORS.black` | `&lt;Feather name="bell" size={20} color="#000" /&gt;` |
| L1091 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="location" size={16} color="#000" /&gt;` |
| L1097 | `"#666"` | `COLORS.textSecondary` | `&lt;Ionicons name="grid-outline" size={16} color="#666" style={{ margi` |
| L1115 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" /&gt;` |
| L1121 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="map-pin" size={64} color="#ccc" /&gt;` |
| L1153 | `"#007AFF"` | `COLORS.info` | `&lt;Feather name="arrow-up" size={24} color="#007AFF" /&gt;` |

---

## Step 34: src/_components/CreatePost/TagPeopleModal.tsx

**Hex count**: 19 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L57 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L69 | `'#e0e0e0'` | `COLORS.border` | `&lt;View style={{ width: 40, height: 4, backgroundColor: '#e0e0e0', bo` |
| L71 | `'#000'` | `COLORS.black` | `&lt;Text style={{ fontWeight: '500', fontSize: 16, marginBottom: 20, c` |
| L73 | `'#f9f9f9'` | `COLORS.surface` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', backgrou` |
| L73 | `'#f0f0f0'` | `COLORS.inputBg` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', backgrou` |
| L74 | `"#000"` | `COLORS.black` | `&lt;Feather name="search" size={18} color="#000" style={{ marginRight:` |
| L76 | `'#000'` | `COLORS.black` | `style={{ flex: 1, fontSize: 15, color: '#000' }}` |
| L78 | `"#666"` | `COLORS.textSecondary` | `placeholderTextColor="#666"` |
| L87 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" style={{ marginTop:` |
| L100 | `'#f2f2f2'` | `COLORS.surface` | `style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: ` |
| L107 | `'#eee'` | `COLORS.border` | `&lt;Image source={{ uri: item.photoURL \|\| DEFAULT_AVATAR_URL }} styl` |
| L109 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 15, fontWeight: '400', color: '#111' }} nu` |
| L110 | `'#666'` | `COLORS.textSecondary` | `{!!item.userName && &lt;Text style={{ fontSize: 13, color: '#666', mar` |
| L113 | `'#FF8D00'` | `COLORS.primary` | `&lt;View style={{ width: 24, height: 24, borderRadius: 12, backgroundC` |
| L114 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="check" size={14} color="#fff" /&gt;` |
| L120 | `'#888'` | `COLORS.textMuted` | `ListEmptyComponent={&lt;Text style={{ color: '#888', marginTop: 12, te` |
| L126 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ color: '#111', fontWeight: '700', fontSize: 15 }}&gt` |
| L130 | `'#FF8D00'` | `COLORS.primary` | `style={{ backgroundColor: '#FF8D00', borderRadius: 8, paddingHorizonta` |
| L132 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}&gt` |

---

## Step 35: src/_components/StoriesRow.tsx

**Hex count**: 19 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L98 | `'#3498db'` | `COLORS.surface` | `const STORY_RING_UNSEEN = ['#3498db', '#5dade2'] as const; // Telegram` |
| L98 | `'#5dade2'` | `COLORS.surface` | `const STORY_RING_UNSEEN = ['#3498db', '#5dade2'] as const; // Telegram` |
| L138 | `'#F58529'` | `COLORS.surface` | `const STORY_RING_UNSEEN = ['#F58529', '#DD2A7B', '#8134AF'] as const;` |
| L138 | `'#DD2A7B'` | `COLORS.surface` | `const STORY_RING_UNSEEN = ['#F58529', '#DD2A7B', '#8134AF'] as const;` |
| L138 | `'#8134AF'` | `COLORS.surface` | `const STORY_RING_UNSEEN = ['#F58529', '#DD2A7B', '#8134AF'] as const;` |
| L139 | `'#D1D5DB'` | `COLORS.border` | `const STORY_RING_SEEN = '#D1D5DB';` |
| L585 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name={'video'} size={11} color="#fff" /&gt;` |
| L620 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="plus" size={10} color="#fff" /&gt;` |
| L671 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name={'video'} size={11} color="#fff" /&gt;` |
| L699 | `'#fff'` | `COLORS.background` | `&lt;SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={[` |
| L718 | `"#222"` | `COLORS.textPrimary` | `&lt;Feather name="x" size={24} color="#222" /&gt;` |
| L825 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="edit-2" size={16} color="#FF8D00" /&gt;` |
| L851 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="image" size={48} color="#FF8D00" /&gt;` |
| L865 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L875 | `"#666"` | `COLORS.textSecondary` | `&lt;Feather name="map-pin" size={18} color="#666" /&gt;` |
| L881 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L912 | `"#FF8D00"` | `COLORS.primary` | `&lt;Feather name="map-pin" size={16} color="#FF8D00" style={{ marginRi` |
| L924 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" /&gt;` |
| L933 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" style={{ marginBott` |

---

## Step 36: src/_components/CreatePost/LocationModal.tsx

**Hex count**: 18 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L60 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L72 | `'#e0e0e0'` | `COLORS.border` | `&lt;View style={{ width: 40, height: 4, backgroundColor: '#e0e0e0', bo` |
| L74 | `'#000'` | `COLORS.black` | `&lt;Text style={{ fontWeight: '500', fontSize: 16, marginBottom: 20, c` |
| L76 | `'#f9f9f9'` | `COLORS.surface` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', backgrou` |
| L76 | `'#f0f0f0'` | `COLORS.inputBg` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', backgrou` |
| L77 | `"#000"` | `COLORS.black` | `&lt;Feather name="search" size={18} color="#000" style={{ marginRight:` |
| L79 | `'#000'` | `COLORS.black` | `style={{ flex: 1, fontSize: 15, color: '#000' }}` |
| L81 | `"#666"` | `COLORS.textSecondary` | `placeholderTextColor="#666"` |
| L90 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" style={{ marginTop:` |
| L103 | `'#f2f2f2'` | `COLORS.surface` | `style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: ` |
| L110 | `'#f0f0f0'` | `COLORS.inputBg` | `&lt;View style={{ width: 44, height: 44, borderRadius: 12, backgroundC` |
| L111 | `"#000"` | `COLORS.black` | `&lt;Feather name="map-pin" size={18} color="#000" /&gt;` |
| L114 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}&gt` |
| L115 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ color: '#666', fontSize: 13, marginTop: 2 }}&gt;{ite` |
| L120 | `'#888'` | `COLORS.textMuted` | `ListEmptyComponent={&lt;Text style={{ color: '#888', marginTop: 12, te` |
| L126 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ color: '#111', fontWeight: '700', fontSize: 15 }}&gt` |
| L130 | `'#FF8D00'` | `COLORS.primary` | `style={{ backgroundColor: '#FF8D00', borderRadius: 8, paddingHorizonta` |
| L132 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}&gt` |

---

## Step 37: src/_components/profile/ProfileStatistics.tsx

**Hex count**: 18 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L92 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={[styles.avatar, { backgroundColor: '#e5e5ea' }]} /&gt;` |
| L94 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={{ width: 120, height: 16, backgroundColor: '#e5e5ea', ` |
| L95 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={{ width: 180, height: 12, backgroundColor: '#e5e5ea', ` |
| L96 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={{ width: 80, height: 12, backgroundColor: '#e5e5ea', b` |
| L99 | `'#e5e5ea'` | `COLORS.border` | `&lt;View style={[styles.btnMessage, { backgroundColor: '#e5e5ea', widt` |
| L100 | `'#d1d1d6'` | `COLORS.surface` | `&lt;View style={{ width: 60, height: 12, backgroundColor: '#d1d1d6', b` |
| L109 | `'#e5e5ea'` | `COLORS.border` | `&lt;Animated.View style={{ width, height: 28, backgroundColor: '#e5e5e` |
| L118 | `'#e5e5ea'` | `COLORS.border` | `&lt;Animated.View style={{ width, height: 36, backgroundColor: '#e5e5e` |
| L451 | `"#000"` | `COLORS.black` | `&lt;ActivityIndicator size="small" color="#000" /&gt;` |
| L455 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-down" size={16} color="#000" style={styles.wit` |
| L468 | `"#fff"` | `COLORS.textLight` | `&lt;ActivityIndicator size="small" color="#fff" /&gt;` |
| L471 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="refresh-cw" size={14} color="#fff" style={{ marginRi` |
| L472 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={[styles.withdrawText, { color: '#fff' }]}&gt;Fix payou` |
| L482 | `"#e65100"` | `COLORS.surface` | `&lt;Feather name="alert-triangle" size={14} color="#e65100" style={{ m` |
| L543 | `'#fff'` | `COLORS.textLight` | `&lt;Feather name="clock" size={14} color={filter === 'recent' ? '#fff'` |
| L543 | `'#fff'` | `COLORS.textLight` | `&lt;Feather name="clock" size={14} color={filter === 'recent' ? '#fff'` |
| L606 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="chatbubble-outline" size={14} color="#fff" style={{` |
| L614 | `"#bbb"` | `COLORS.textMuted` | `&lt;Ionicons name="people-outline" size={40} color="#bbb" /&gt;` |

---

## Step 38: app/hashtag-detail.tsx

**Hex count**: 17 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L150 | `'#f0f0f0'` | `COLORS.inputBg` | `&lt;View style={{ backgroundColor: '#f0f0f0', width: '100%', height: '` |
| L167 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-left" size={24} color="#000" /&gt;` |
| L197 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="hash" size={48} color="#ccc" /&gt;` |
| L222 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={16} color="#fff" /&gt;` |
| L275 | `'#fff'` | `COLORS.background` | `&lt;View style={{ backgroundColor: '#fff', height: '80%', borderTopLef` |
| L276 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: 40, height: 4, backgroundColor: '#eee', borde` |
| L277 | `'#eee'` | `COLORS.border` | `&lt;View style={{ flexDirection: 'row', justifyContent: 'space-between` |
| L285 | `"#333"` | `COLORS.textPrimary` | `&lt;Ionicons name="close" size={24} color="#333" /&gt;` |
| L305 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L313 | `'#eee'` | `COLORS.border` | `borderBottomColor: '#eee',` |
| L327 | `'#ddd'` | `COLORS.border` | `color: '#ddd', // matches the light color in screenshot` |
| L340 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L348 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L357 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L362 | `'#888'` | `COLORS.textMuted` | `color: '#888',` |
| L367 | `'#eee'` | `COLORS.border` | `backgroundColor: '#eee',` |
| L390 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |

---

## Step 39: src/_components/CountryFlag.tsx

**Hex count**: 17 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L14 | `'#C0392B'` | `COLORS.surface` | `['#C0392B', '#E74C3C'],` |
| L14 | `'#E74C3C'` | `COLORS.surface` | `['#C0392B', '#E74C3C'],` |
| L15 | `'#1A5276'` | `COLORS.surface` | `['#1A5276', '#2E86C1'],` |
| L15 | `'#2E86C1'` | `COLORS.surface` | `['#1A5276', '#2E86C1'],` |
| L16 | `'#1E8449'` | `COLORS.surface` | `['#1E8449', '#27AE60'],` |
| L16 | `'#27AE60'` | `COLORS.surface` | `['#1E8449', '#27AE60'],` |
| L17 | `'#6C3483'` | `COLORS.surface` | `['#6C3483', '#8E44AD'],` |
| L17 | `'#8E44AD'` | `COLORS.surface` | `['#6C3483', '#8E44AD'],` |
| L18 | `'#7E5109'` | `COLORS.surface` | `['#7E5109', '#D4AC0D'],` |
| L18 | `'#D4AC0D'` | `COLORS.surface` | `['#7E5109', '#D4AC0D'],` |
| L19 | `'#1A4D2E'` | `COLORS.surface` | `['#1A4D2E', '#28B463'],` |
| L19 | `'#28B463'` | `COLORS.surface` | `['#1A4D2E', '#28B463'],` |
| L20 | `'#922B21'` | `COLORS.surface` | `['#922B21', '#E74C3C'],` |
| L20 | `'#E74C3C'` | `COLORS.surface` | `['#922B21', '#E74C3C'],` |
| L21 | `'#154360'` | `COLORS.surface` | `['#154360', '#2471A3'],` |
| L21 | `'#2471A3'` | `COLORS.surface` | `['#154360', '#2471A3'],` |
| L90 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |

---

## Step 40: app/archive.tsx

**Hex count**: 14 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L105 | `'#fff'` | `COLORS.background` | `&lt;SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}&gt;` |
| L106 | `'#f5f5f5'` | `COLORS.surface` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', paddingH` |
| L106 | `'#fff'` | `COLORS.background` | `&lt;View style={{ flexDirection: 'row', alignItems: 'center', paddingH` |
| L114 | `"#FF8800"` | `COLORS.surface` | `&lt;Feather name="x" size={22} color="#FF8800" /&gt;` |
| L116 | `'#111'` | `COLORS.textPrimary` | `&lt;Text style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeig` |
| L121 | `"#FF8800"` | `COLORS.surface` | `&lt;ActivityIndicator size="large" color="#FF8800" /&gt;` |
| L125 | `'#999'` | `COLORS.textMuted` | `&lt;Text style={{ color: '#999', fontSize: 16, textAlign: 'center' }}&` |
| L129 | `'#999'` | `COLORS.textMuted` | `&lt;Text style={{ color: '#999', fontSize: 16, textAlign: 'center' }}&` |
| L140 | `'#FF8800'` | `COLORS.surface` | `style={{ backgroundColor: '#FF8800', justifyContent: 'center', alignIt` |
| L150 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}&g` |
| L155 | `'#eee'` | `COLORS.border` | `style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: ` |
| L183 | `'#eee'` | `COLORS.border` | `&lt;Image source={{ uri: (item.otherUser && item.otherUser.avatar) ? i` |
| L186 | `'#222'` | `COLORS.textPrimary` | `&lt;Text style={{ fontSize: 16, fontWeight: '600', color: '#222' }}&gt` |
| L187 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 14, color: '#666' }} numberOfLines={1}&gt;` |

---

## Step 41: app/auth/email-signup.tsx

**Hex count**: 14 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L100 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L115 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L125 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" style={styles.input` |
| L128 | `"#4CAF50"` | `COLORS.surface` | `&lt;Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={` |
| L131 | `"#f44336"` | `COLORS.surface` | `&lt;Ionicons name="close-circle" size={20} color="#f44336" style={styl` |
| L135 | `'#f44336'` | `COLORS.surface` | `&lt;Text style={[styles.hint, { color: '#f44336' }]}&gt;An account alr` |
| L145 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L153 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" style={styles.input` |
| L156 | `"#4CAF50"` | `COLORS.surface` | `&lt;Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={` |
| L159 | `"#f44336"` | `COLORS.surface` | `&lt;Ionicons name="close-circle" size={20} color="#f44336" style={styl` |
| L163 | `'#f44336'` | `COLORS.surface` | `&lt;Text style={[styles.hint, { color: '#f44336' }]}&gt;username alrea` |
| L166 | `'#4CAF50'` | `COLORS.surface` | `&lt;Text style={[styles.hint, { color: '#4CAF50' }]}&gt;Username is av` |
| L178 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L191 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 12, color: '#666', textAlign: 'center', ma` |

---

## Step 42: src/_components/CreatePost/MediaPreview.tsx

**Hex count**: 14 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L162 | `'#000000'` | `COLORS.black` | `&lt;View style={{ width: windowWidth, height, backgroundColor: '#00000` |
| L179 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={28} color="#ffffff" style={{ marginLeft` |
| L189 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={18} ` |
| L283 | `'#000000'` | `COLORS.black` | `&lt;View style={{ width: windowWidth, height, backgroundColor: '#00000` |
| L305 | `"#ffffff"` | `COLORS.textLight` | `&lt;ActivityIndicator size="small" color="#ffffff" /&gt;` |
| L307 | `"#ffffff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={28} color="#ffffff" style={{ marginLeft` |
| L325 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="trash-2" size={18} color="#fff" /&gt;` |
| L336 | `'#000000'` | `COLORS.black` | `&lt;View style={{ height, width: windowWidth, backgroundColor: '#00000` |
| L377 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L410 | `'#ffffff'` | `COLORS.textLight` | `color: '#ffffff',` |
| L434 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L442 | `'#ffffff'` | `COLORS.background` | `backgroundColor: '#ffffff',` |
| L444 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L455 | `'#ffffff'` | `COLORS.background` | `backgroundColor: '#ffffff',` |

---

## Step 43: src/_components/inbox/ConversationActionModal.tsx

**Hex count**: 14 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L41 | `"#ff3b30"` | `COLORS.danger` | `&lt;Feather name="trash-2" size={18} color="#ff3b30" /&gt;` |
| L91 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L100 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L113 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L120 | `'#ff3b30'` | `COLORS.danger` | `color: '#ff3b30',` |
| L125 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L129 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L135 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L142 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L147 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L161 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L165 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L168 | `'#ff3b30'` | `COLORS.danger` | `backgroundColor: '#ff3b30',` |
| L172 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |

---

## Step 44: src/_components/auth/SocialButton.tsx

**Hex count**: 13 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L17 | `'#fff'` | `COLORS.background` | `bgColor: '#fff',` |
| L18 | `'#000'` | `COLORS.black` | `textColor: '#000',` |
| L19 | `'#DB4437'` | `COLORS.surface` | `iconColor: '#DB4437',` |
| L24 | `'#000'` | `COLORS.black` | `bgColor: '#000',` |
| L25 | `'#fff'` | `COLORS.textLight` | `textColor: '#fff',` |
| L26 | `'#fff'` | `COLORS.textLight` | `iconColor: '#fff',` |
| L31 | `'#000'` | `COLORS.black` | `bgColor: '#000',` |
| L32 | `'#fff'` | `COLORS.textLight` | `textColor: '#fff',` |
| L33 | `'#fff'` | `COLORS.textLight` | `iconColor: '#fff',` |
| L38 | `'#FFFC00'` | `COLORS.surface` | `bgColor: '#FFFC00',` |
| L39 | `'#000'` | `COLORS.black` | `textColor: '#000',` |
| L40 | `'#000'` | `COLORS.black` | `iconColor: '#000',` |
| L77 | `'#d1d1d1'` | `COLORS.surface` | `borderColor: '#d1d1d1',` |

---

## Step 45: app/auth/username-signup.tsx

**Hex count**: 12 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L118 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L139 | `"#999"` | `COLORS.textMuted` | `&lt;Ionicons name="person-outline" size={40} color="#999" /&gt;` |
| L143 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="camera" size={20} color="#fff" /&gt;` |
| L154 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L163 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" style={styles.input` |
| L166 | `"#4CAF50"` | `COLORS.surface` | `&lt;Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={` |
| L169 | `"#f44336"` | `COLORS.surface` | `&lt;Ionicons name="close-circle" size={20} color="#f44336" style={styl` |
| L173 | `'#f44336'` | `COLORS.surface` | `&lt;Text style={[styles.hint, { color: '#f44336' }]}&gt;This username ` |
| L176 | `'#4CAF50'` | `COLORS.surface` | `&lt;Text style={[styles.hint, { color: '#4CAF50' }]}&gt;Username is av` |
| L189 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L197 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 12, color: '#666', textAlign: 'center', ma` |
| L214 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" /&gt;` |

---

## Step 46: src/_components/dm/DMInput.tsx

**Hex count**: 12 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L67 | `'#FF8D00'` | `COLORS.primary` | `colors={[COLORS.primary, '#FF8D00']}` |
| L126 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L128 | `'#efefef'` | `COLORS.surface` | `borderTopColor: '#efefef',` |
| L133 | `'#f8f8f8'` | `COLORS.surface` | `backgroundColor: '#f8f8f8',` |
| L138 | `'#FF8D00'` | `COLORS.primary` | `borderLeftColor: '#FF8D00',` |
| L146 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |
| L152 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L172 | `'#f2f2f2'` | `COLORS.surface` | `backgroundColor: '#f2f2f2',` |
| L180 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L208 | `'#ff3b30'` | `COLORS.danger` | `backgroundColor: '#ff3b30',` |
| L214 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L219 | `'#8e8e8e'` | `COLORS.surface` | `color: '#8e8e8e',` |

---

## Step 47: app/dm.tsx

**Hex count**: 11 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L594 | `"#FF8D00"` | `COLORS.primary` | `return &lt;View style={styles.centered}&gt;&lt;ActivityIndicator size=` |
| L600 | `'#94a3b8'` | `COLORS.surface` | `&lt;Text style={{ color: '#94a3b8', marginBottom: 12 }}&gt;Could not s` |
| L601 | `'#FF8D00'` | `COLORS.primary` | `&lt;TouchableOpacity onPress={() =&gt; router.back()} style={{ backgro` |
| L602 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff' }}&gt;Go Back&lt;/Text&gt;` |
| L709 | `"#ff3b30"` | `COLORS.danger` | `&lt;Ionicons name="trash-outline" size={24} color="#ff3b30" /&gt;` |
| L710 | `'#ff3b30'` | `COLORS.danger` | `&lt;Text style={[styles.optionsLabel, { color: '#ff3b30' }]}&gt;Clear ` |
| L718 | `'#000'` | `COLORS.black` | `&lt;View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'c` |
| L720 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="close" size={32} color="#fff" /&gt;` |
| L751 | `"#666"` | `COLORS.textSecondary` | `&lt;Ionicons name="add" size={22} color="#666" /&gt;` |
| L757 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-undo-outline" size={22} color="#000" /&gt;` |
| L762 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="create-outline" size={22} color="#000" /&gt;` |

---

## Step 48: app/post.tsx

**Hex count**: 11 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L46 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: '100%', height: 200, borderRadius: 12, backgr` |
| L47 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: 120, height: 24, borderRadius: 8, backgroundC` |
| L48 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: '80%', height: 16, borderRadius: 6, backgroun` |
| L49 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: '60%', height: 16, borderRadius: 6, backgroun` |
| L67 | `'#fffbe6'` | `COLORS.surface` | `&lt;Text style={[styles.highlight, { backgroundColor: '#fffbe6', paddi` |
| L71 | `'#eaf3ff'` | `COLORS.surface` | `&lt;Text style={[styles.highlight, { backgroundColor: '#eaf3ff', paddi` |
| L86 | `'#fff'` | `COLORS.background` | `container: { flex: 1, backgroundColor: '#fff' },` |
| L88 | `'#FF6B00'` | `COLORS.surface` | `header: { fontWeight: '700', fontSize: 24, color: '#FF6B00', marginBot` |
| L89 | `'#222'` | `COLORS.textPrimary` | `caption: { fontSize: 16, color: '#222', marginBottom: 12 },` |
| L90 | `'#007aff'` | `COLORS.info` | `highlight: { fontSize: 15, color: '#007aff', marginBottom: 8 },` |
| L91 | `'#d00'` | `COLORS.surface` | `notFound: { fontSize: 18, color: '#d00', textAlign: 'center', marginTo` |

---

## Step 49: app/search-modal.tsx

**Hex count**: 11 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L225 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="play" size={10} color="#fff" style={{ marginRight: 2` |
| L275 | `"#333"` | `COLORS.textPrimary` | `&lt;Feather name="arrow-left" size={24} color="#333" /&gt;` |
| L279 | `"#666"` | `COLORS.textSecondary` | `&lt;Feather name="search" size={18} color="#666" style={styles.searchI` |
| L285 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L295 | `"#777"` | `COLORS.surface` | `&lt;Feather name="x" size={16} color="#777" /&gt;` |
| L313 | `'#fff'` | `COLORS.background` | `&lt;View style={{ flex: 1, backgroundColor: '#fff' }}&gt;` |
| L326 | `"#8e8e93"` | `COLORS.textMuted` | `&lt;Feather name="clock" size={16} color="#8e8e93" style={{ marginRigh` |
| L333 | `"#c7c7cc"` | `COLORS.surface` | `&lt;Feather name="x" size={16} color="#c7c7cc" /&gt;` |
| L344 | `"#e5e5ea"` | `COLORS.border` | `&lt;Feather name="search" size={48} color="#e5e5ea" style={{ marginBot` |
| L396 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="large" color="#FF8D00" /&gt;` |
| L400 | `'#ff3b30'` | `COLORS.danger` | `&lt;Text style={{ color: '#ff3b30', fontSize: 15 }}&gt;Failed to load ` |

---

## Step 50: src/_components/AppDialogProvider.tsx

**Hex count**: 11 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L105 | `'#22c55e'` | `COLORS.surface` | `const iconColor = payload?.variant === 'success' ? '#22c55e' : payload` |
| L105 | `'#ef4444'` | `COLORS.surface` | `const iconColor = payload?.variant === 'success' ? '#22c55e' : payload` |
| L105 | `'#3b82f6'` | `COLORS.surface` | `const iconColor = payload?.variant === 'success' ? '#22c55e' : payload` |
| L169 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L172 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L179 | `'#111'` | `COLORS.textPrimary` | `titleText: { fontSize: 17, fontWeight: '800', color: '#111', flex: 1 }` |
| L180 | `'#333'` | `COLORS.textPrimary` | `messageText: { fontSize: 14.5, color: '#333', lineHeight: 20 },` |
| L183 | `'#111'` | `COLORS.textPrimary` | `primaryBtn: { backgroundColor: '#111' },` |
| L184 | `'#f2f2f2'` | `COLORS.surface` | `secondaryBtn: { backgroundColor: '#f2f2f2' },` |
| L186 | `'#fff'` | `COLORS.textLight` | `primaryText: { color: '#fff' },` |
| L187 | `'#111'` | `COLORS.textPrimary` | `secondaryText: { color: '#111' },` |

---

## Step 51: app/legal/terms.tsx

**Hex count**: 10 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L15 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L56 | `'#e0245e'` | `COLORS.surface` | `&lt;Text style={[styles.paragraph, { fontWeight: '600', color: '#e0245` |
| L123 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L138 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L148 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L155 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L162 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L168 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L176 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0',` |
| L182 | `'#007AFF'` | `COLORS.info` | `color: '#007AFF',` |

---

## Step 52: src/_components/passport/StampDeleteModal.tsx

**Hex count**: 10 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L26 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="trash-2" size={18} color="#fff" /&gt;` |
| L58 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L61 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L77 | `'#ff3b30'` | `COLORS.danger` | `backgroundColor: '#ff3b30',` |
| L82 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |
| L87 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L93 | `'#ff3b30'` | `COLORS.danger` | `backgroundColor: '#ff3b30',` |
| L98 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L105 | `'#f2f2f7'` | `COLORS.surface` | `backgroundColor: '#f2f2f7',` |
| L111 | `'#111'` | `COLORS.textPrimary` | `color: '#111',` |

---

## Step 53: src/_components/profile/ProfileSections.tsx

**Hex count**: 10 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L81 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="lock" size={14} color="#fff" /&gt;` |
| L87 | `'#007aff'` | `COLORS.info` | `&lt;Feather name="lock" size={10} color={isActive ? '#007aff' : '#333'` |
| L87 | `'#333'` | `COLORS.textPrimary` | `&lt;Feather name="lock" size={10} color={isActive ? '#007aff' : '#333'` |
| L114 | `"#666"` | `COLORS.textSecondary` | `&lt;Feather name="plus" size={24} color="#666" /&gt;` |
| L139 | `'#eee'` | `COLORS.border` | `backgroundColor: '#eee',` |
| L144 | `'#007aff'` | `COLORS.info` | `borderColor: '#007aff',` |
| L160 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L180 | `'#007aff'` | `COLORS.info` | `color: '#007aff',` |
| L186 | `'#f5f5f7'` | `COLORS.surface` | `backgroundColor: '#f5f5f7',` |
| L188 | `'#e5e5ea'` | `COLORS.border` | `borderColor: '#e5e5ea',` |

---

## Step 54: app/auth/reset-password.tsx

**Hex count**: 9 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L79 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L92 | `"#999"` | `COLORS.textMuted` | `&lt;Ionicons name="lock-closed-outline" size={20} color="#999" /&gt;` |
| L109 | `"#999"` | `COLORS.textMuted` | `&lt;Ionicons name="key-outline" size={20} color="#999" /&gt;` |
| L125 | `"#999"` | `COLORS.textMuted` | `&lt;Ionicons name="key-outline" size={20} color="#999" /&gt;` |
| L152 | `'#fff'` | `COLORS.background` | `container: { flex: 1, backgroundColor: '#fff' },` |
| L158 | `'#333'` | `COLORS.textPrimary` | `label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom:` |
| L162 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L166 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0',` |
| L168 | `'#000'` | `COLORS.black` | `input: { flex: 1, padding: 16, fontSize: 16, color: '#000', marginLeft` |

---

## Step 55: app/friends.tsx

**Hex count**: 9 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L326 | `'#000'` | `COLORS.black` | `&lt;ActivityIndicator size="small" color={item.isFollowing ? '#000' : ` |
| L326 | `'#fff'` | `COLORS.textLight` | `&lt;ActivityIndicator size="small" color={item.isFollowing ? '#000' : ` |
| L344 | `"#999"` | `COLORS.textMuted` | `&lt;Feather name="x" size={18} color="#999" /&gt;` |
| L374 | `"#ccc"` | `COLORS.border` | `&lt;Ionicons name={msg.icon as any} size={64} color="#ccc" /&gt;` |
| L394 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-left" size={24} color="#000" /&gt;` |
| L430 | `"#999"` | `COLORS.textMuted` | `&lt;Feather name="search" size={18} color="#999" style={styles.searchI` |
| L434 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L445 | `"#999"` | `COLORS.textMuted` | `&lt;Feather name="x" size={18} color="#999" /&gt;` |
| L453 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="large" color="#FF8D00" /&gt;` |

---

## Step 56: app/highlight/[id].tsx

**Hex count**: 9 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L51 | `"#111"` | `COLORS.textPrimary` | `&lt;Feather name="arrow-left" size={24} color="#111" /&gt;` |
| L59 | `"#111"` | `COLORS.textPrimary` | `&lt;ActivityIndicator size="large" color="#111" /&gt;` |
| L89 | `'#fff'` | `COLORS.background` | `container: { flex: 1, backgroundColor: '#fff' },` |
| L96 | `'#eee'` | `COLORS.border` | `borderBottomColor: '#eee',` |
| L99 | `'#111'` | `COLORS.textPrimary` | `title: { fontWeight: '800', fontSize: 18, marginLeft: 6, color: '#111'` |
| L101 | `'#777'` | `COLORS.surface` | `loadingText: { marginTop: 10, color: '#777' },` |
| L102 | `'#777'` | `COLORS.surface` | `empty: { color: '#777', fontSize: 15, textAlign: 'center' },` |
| L103 | `'#111'` | `COLORS.textPrimary` | `openBtn: { backgroundColor: '#111', paddingHorizontal: 18, paddingVert` |
| L104 | `'#fff'` | `COLORS.textLight` | `openBtnText: { color: '#fff', fontWeight: '800' },` |

---

## Step 57: app/legal/privacy.tsx

**Hex count**: 9 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L15 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L112 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L127 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L137 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L144 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L151 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L157 | `'#333'` | `COLORS.textPrimary` | `color: '#333',` |
| L168 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0',` |
| L174 | `'#007AFF'` | `COLORS.info` | `color: '#007AFF',` |

---

## Step 58: src/_components/auth/CustomInput.tsx

**Hex count**: 9 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L27 | `"#999"` | `COLORS.textMuted` | `&lt;Ionicons name={leftIcon} size={20} color="#999" style={styles.left` |
| L31 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L43 | `"#999"` | `COLORS.textMuted` | `color="#999"` |
| L60 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L66 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0',` |
| L69 | `'#fafafa'` | `COLORS.surface` | `backgroundColor: '#fafafa',` |
| L75 | `'#222'` | `COLORS.textPrimary` | `color: '#222',` |
| L87 | `'#e74c3c'` | `COLORS.surface` | `borderColor: '#e74c3c',` |
| L90 | `'#e74c3c'` | `COLORS.surface` | `color: '#e74c3c',` |

---

## Step 59: app/auth/phone-signup.tsx

**Hex count**: 8 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L147 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L168 | `"#666"` | `COLORS.textSecondary` | `&lt;Ionicons name="chevron-down" size={16} color="#666" /&gt;` |
| L173 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L187 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L209 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="close" size={24} color="#000" /&gt;` |
| L234 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 12, color: '#666', textAlign: 'center', ma` |
| L382 | `'#FFFC00'` | `COLORS.surface` | `backgroundColor: '#FFFC00',` |
| L383 | `'#FFFC00'` | `COLORS.surface` | `borderColor: '#FFFC00',` |

---

## Step 60: app/post-main.tsx

**Hex count**: 8 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L67 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: '100%', height: 200, borderRadius: 12, backgr` |
| L68 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: 120, height: 24, borderRadius: 8, backgroundC` |
| L69 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: '80%', height: 16, borderRadius: 6, backgroun` |
| L70 | `'#eee'` | `COLORS.border` | `&lt;View style={{ width: '60%', height: 16, borderRadius: 6, backgroun` |
| L96 | `'#fffbe6'` | `COLORS.surface` | `&lt;Text style={[styles.highlight, { backgroundColor: '#fffbe6', paddi` |
| L105 | `'#fff'` | `COLORS.background` | `container: { flex: 1, backgroundColor: '#fff' },` |
| L106 | `'#999'` | `COLORS.textMuted` | `notFound: { color: '#999', fontSize: 16, textAlign: 'center', marginTo` |
| L109 | `'#222'` | `COLORS.textPrimary` | `highlight: { fontWeight: 'bold', color: '#222', marginBottom: 8 },` |

---

## Step 61: src/_components/AddHighlightModal.tsx

**Hex count**: 8 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L33 | `"#FF6B00"` | `COLORS.surface` | `&lt;Ionicons name="add-circle" size={24} color="#FF6B00" /&gt;` |
| L37 | `"#222"` | `COLORS.textPrimary` | `&lt;Ionicons name="close" size={24} color="#222" /&gt;` |
| L48 | `'#fff'` | `COLORS.background` | `container: { backgroundColor: '#fff', borderRadius: 18, padding: 24, w` |
| L48 | `'#000'` | `COLORS.black` | `container: { backgroundColor: '#fff', borderRadius: 18, padding: 24, w` |
| L49 | `'#FF6B00'` | `COLORS.surface` | `header: { fontWeight: '700', fontSize: 20, color: '#FF6B00', marginBot` |
| L50 | `'#eee'` | `COLORS.border` | `input: { width: '100%', borderWidth: 1, borderColor: '#eee', borderRad` |
| L51 | `'#FF6B00'` | `COLORS.surface` | `addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor:` |
| L52 | `'#fff'` | `COLORS.textLight` | `addText: { color: '#fff', fontWeight: '600', fontSize: 16, marginLeft:` |

---

## Step 62: src/_components/profile/ProfileActions.tsx

**Hex count**: 8 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L49 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="chatbubble-outline" size={16} color="#000" style={{` |
| L70 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0',` |
| L77 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L83 | `'#007aff'` | `COLORS.info` | `backgroundColor: '#007aff',` |
| L88 | `'#f0f0f0'` | `COLORS.inputBg` | `backgroundColor: '#f0f0f0',` |
| L90 | `'#ddd'` | `COLORS.border` | `borderColor: '#ddd',` |
| L95 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L98 | `'#000'` | `COLORS.black` | `color: '#000',` |

---

## Step 63: src/_components/profile/ProfileTabs.tsx

**Hex count**: 8 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L22 | `'#000'` | `COLORS.black` | `&lt;Ionicons name="location-outline" size={24} color={activeTab === 'm` |
| L22 | `'#999'` | `COLORS.textMuted` | `&lt;Ionicons name="location-outline" size={24} color={activeTab === 'm` |
| L30 | `'#000'` | `COLORS.black` | `&lt;Ionicons name="pricetag-outline" size={24} color={activeTab === 't` |
| L30 | `'#999'` | `COLORS.textMuted` | `&lt;Ionicons name="pricetag-outline" size={24} color={activeTab === 't` |
| L38 | `"#999"` | `COLORS.textMuted` | `&lt;Ionicons name="folder-outline" size={24} color="#999" /&gt;` |
| L51 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L58 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L62 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |

---

## Step 64: app/auth/password-signup.tsx

**Hex count**: 7 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L91 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L105 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L121 | `"#999"` | `COLORS.textMuted` | `color="#999"` |
| L136 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L152 | `"#999"` | `COLORS.textMuted` | `color="#999"` |
| L157 | `'#f44336'` | `COLORS.surface` | `&lt;Text style={[styles.hint, { color: '#f44336' }]}&gt;Passwords do n` |
| L160 | `'#4CAF50'` | `COLORS.surface` | `&lt;Text style={[styles.hint, { color: '#4CAF50' }]}&gt;Passwords matc` |

---

## Step 65: src/_components/CustomMapMarker.tsx

**Hex count**: 7 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L29 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff',` |
| L30 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L48 | `'#FF0000'` | `COLORS.surface` | `backgroundColor: '#FF0000',` |
| L53 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 8 }}&gt` |
| L67 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff',` |
| L69 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L70 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |

---

## Step 66: src/_components/ErrorBoundary.tsx

**Hex count**: 7 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L100 | `'#F9FAFB'` | `COLORS.surface` | `backgroundColor: '#F9FAFB',` |
| L104 | `'#FFFFFF'` | `COLORS.background` | `backgroundColor: '#FFFFFF',` |
| L108 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L123 | `'#111827'` | `COLORS.textPrimary` | `color: '#111827',` |
| L129 | `'#6B7280'` | `COLORS.textSecondary` | `color: '#6B7280',` |
| L135 | `'#000000'` | `COLORS.black` | `backgroundColor: '#000000',` |
| L143 | `'#FFFFFF'` | `COLORS.textLight` | `color: '#FFFFFF',` |

---

## Step 67: src/_components/profile/ProfileStats.tsx

**Hex count**: 7 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L38 | `"#999"` | `COLORS.textMuted` | `&lt;Ionicons name="lock-closed" size={32} color="#999" /&gt;` |
| L79 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L85 | `'#f5f5f5'` | `COLORS.surface` | `backgroundColor: '#f5f5f5',` |
| L93 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L97 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |
| L108 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |
| L113 | `'#999'` | `COLORS.textMuted` | `color: '#999',` |

---

## Step 68: app/auth/phone-login.tsx

**Hex count**: 6 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L178 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L197 | `"#666"` | `COLORS.textSecondary` | `&lt;Ionicons name="chevron-down" size={16} color="#666" /&gt;` |
| L202 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L224 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L239 | `"#666"` | `COLORS.textSecondary` | `color="#666"` |
| L256 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="close" size={24} color="#000" /&gt;` |

---

## Step 69: src/features/profile/components/ProfileModals.tsx

**Hex count**: 6 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L163 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="close" size={34} color="#fff" /&gt;` |
| L350 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L360 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L365 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L377 | `'#ddd'` | `COLORS.border` | `backgroundColor: '#ddd',` |
| L384 | `'#222'` | `COLORS.textPrimary` | `color: '#222'` |

---

## Step 70: src/_components/dm/DMHeader.tsx

**Hex count**: 6 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L32 | `"#000"` | `COLORS.black` | `&lt;Feather name="chevron-left" size={28} color="#000" /&gt;` |
| L49 | `"#000"` | `COLORS.black` | `&lt;Feather name="info" size={22} color="#000" /&gt;` |
| L62 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L78 | `'#efefef'` | `COLORS.surface` | `backgroundColor: '#efefef',` |
| L87 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L91 | `'#0095f6'` | `COLORS.info` | `color: '#0095f6',` |

---

## Step 71: src/_components/map/MapMarkers.tsx

**Hex count**: 6 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L113 | `'#ffa726'` | `COLORS.surface` | `borderColor: '#ffa726',` |
| L114 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L116 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L134 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff',` |
| L135 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L137 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |

---

## Step 72: src/_components/profile/ProfileGridItem.tsx

**Hex count**: 6 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L99 | `"#FFD60A"` | `COLORS.warning` | `&lt;Feather name="lock" size={10} color="#FFD60A" /&gt;` |
| L100 | `'#FFD60A'` | `COLORS.warning` | `&lt;Text style={{ color: '#FFD60A', fontSize: 9, fontWeight: '700' }}&` |
| L106 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="play" size={10} color="#fff" style={{ marginRight: 2` |
| L125 | `'#fff'` | `COLORS.textLight` | `borderColor: '#fff',` |
| L127 | `'#fafafa'` | `COLORS.surface` | `backgroundColor: '#fafafa',` |
| L155 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |

---

## Step 73: src/features/profile/components/ProfileGrid.tsx

**Hex count**: 5 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L69 | `"#ccc"` | `COLORS.border` | `&lt;Ionicons name="heart-outline" size={48} color="#ccc" /&gt;` |
| L70 | `'#999'` | `COLORS.textMuted` | `&lt;Text style={{ marginTop: 10, color: '#999', fontWeight: '600' }}&g` |
| L71 | `'#bbb'` | `COLORS.textMuted` | `&lt;Text style={{ marginTop: 4, color: '#bbb', fontSize: 12, textAlign` |
| L82 | `"#ccc"` | `COLORS.border` | `&lt;Ionicons name="grid-outline" size={48} color="#ccc" /&gt;` |
| L83 | `'#999'` | `COLORS.textMuted` | `&lt;Text style={{ marginTop: 10, color: '#999' }}&gt;No posts yet&lt;/` |

---

## Step 74: src/_components/auth/EULAModal.tsx

**Hex count**: 5 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L39 | `"#FF8D00"` | `COLORS.primary` | `&lt;Ionicons name="shield-checkmark" size={32} color="#FF8D00" /&gt;` |
| L195 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L198 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L212 | `'#F0F7FF'` | `COLORS.primaryLight` | `backgroundColor: '#F0F7FF',` |
| L220 | `'#1a1a1a'` | `COLORS.surface` | `color: '#1a1a1a',` |

---

## Step 75: src/_components/PostCard/PostActions.tsx

**Hex count**: 5 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L56 | `"#ff4d4d"` | `COLORS.surface` | `color={isLiked ? "#ff4d4d" : "#222"}` |
| L56 | `"#222"` | `COLORS.textPrimary` | `color={isLiked ? "#ff4d4d" : "#222"}` |
| L62 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="chatbubble-outline" size={22} color="#000" /&gt;` |
| L85 | `'#666'` | `COLORS.textSecondary` | `&lt;Text style={{ fontSize: 13, color: '#666', fontWeight: '600', marg` |
| L90 | `"#222"` | `COLORS.textPrimary` | `&lt;Ionicons name="paper-plane-outline" size={22} color="#222" /&gt;` |

---

## Step 76: src/_components/PostCard/PostMedia.tsx

**Hex count**: 5 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L85 | `'#000'` | `COLORS.black` | `style={{ width: SCREEN_WIDTH, height: containerHeight, backgroundColor` |
| L140 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="play" size={40} color="#fff" /&gt;` |
| L155 | `"#fff"` | `COLORS.textLight` | `color="#fff"` |
| L170 | `"#fff"` | `COLORS.textLight` | `color="#fff"` |
| L407 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}&gt` |

---

## Step 77: app/blocked-users.tsx

**Hex count**: 4 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L108 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-left" size={24} color="#000" /&gt;` |
| L116 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="large" color="#FF8D00" /&gt;` |
| L125 | `"#ccc"` | `COLORS.border` | `&lt;Feather name="slash" size={64} color="#ccc" /&gt;` |
| L152 | `"#007aff"` | `COLORS.info` | `&lt;ActivityIndicator size="small" color="#007aff" /&gt;` |

---

## Step 78: app/settings.tsx

**Hex count**: 4 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L53 | `"#000"` | `COLORS.black` | `&lt;Feather name="arrow-left" size={24} color="#000" /&gt;` |
| L303 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L347 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |
| L381 | `'#000'` | `COLORS.black` | `shadowColor: '#000',` |

---

## Step 79: src/_components/ArchiveScreen.tsx

**Hex count**: 4 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L8 | `"#FF6B00"` | `COLORS.surface` | `&lt;Ionicons name="archive-outline" size={48} color="#FF6B00" style={{` |
| L16 | `'#fff'` | `COLORS.background` | `container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', j` |
| L17 | `'#FF6B00'` | `COLORS.surface` | `header: { fontWeight: '700', fontSize: 22, color: '#FF6B00', marginBot` |
| L18 | `'#666'` | `COLORS.textSecondary` | `info: { fontSize: 15, color: '#666', textAlign: 'center', marginHorizo` |

---

## Step 80: src/_components/auth/CustomButton.tsx

**Hex count**: 4 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L136 | `'#e0e0e0'` | `COLORS.border` | `borderColor: '#e0e0e0',` |
| L139 | `'#fff'` | `COLORS.textLight` | `color: '#fff',` |
| L144 | `'#FF8D00'` | `COLORS.primary` | `color: '#FF8D00',` |
| L149 | `'#000'` | `COLORS.black` | `color: '#000',` |

---

## Step 81: src/_components/inbox/ConversationItem.tsx

**Hex count**: 4 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L57 | `'#788d9a'` | `COLORS.surface` | `&lt;View style={[styles.avatar, { backgroundColor: '#788d9a', alignIte` |
| L58 | `'#fff'` | `COLORS.textLight` | `&lt;Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}&gt` |
| L89 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" style={{ marginRigh` |
| L98 | `"#000"` | `COLORS.black` | `&lt;Feather name="camera" size={22} color="#000" /&gt;` |

---

## Step 82: src/_components/profile/ProfileAvatar.tsx

**Hex count**: 4 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L44 | `"#fff"` | `COLORS.textLight` | `&lt;Feather name="plus" size={20} color="#fff" /&gt;` |
| L52 | `'#eee'` | `COLORS.border` | `avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: ` |
| L54 | `'#007aff'` | `COLORS.info` | `addStoryBtn: { position: 'absolute', bottom: 0, right: 0, backgroundCo` |
| L54 | `'#fff'` | `COLORS.background` | `addStoryBtn: { position: 'absolute', bottom: 0, right: 0, backgroundCo` |

---

## Step 83: app/auth/password-reset-success.tsx

**Hex count**: 3 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L24 | `"#fff"` | `COLORS.textLight` | `&lt;Ionicons name="checkmark" size={60} color="#fff" /&gt;` |
| L51 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L67 | `'#4CAF50'` | `COLORS.surface` | `backgroundColor: '#4CAF50',` |

---

## Step 84: app/auth/username-login.tsx

**Hex count**: 3 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L80 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L95 | `"#999"` | `COLORS.textMuted` | `placeholderTextColor="#999"` |
| L115 | `"#FF8D00"` | `COLORS.primary` | `&lt;ActivityIndicator size="small" color="#FF8D00" /&gt;` |

---

## Step 85: app/create-post.tsx

**Hex count**: 3 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L62 | `'#fff'` | `COLORS.background` | `&lt;View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets` |
| L118 | `'#f5f5f5'` | `COLORS.surface` | `style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f` |
| L120 | `"#000"` | `COLORS.black` | `&lt;Feather name="x" size={20} color="#000" /&gt;` |

---

## Step 86: src/_components/CustomMarker.tsx

**Hex count**: 3 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L21 | `'#FF8D00'` | `COLORS.primary` | `backgroundColor: '#FF8D00',` |
| L34 | `'#fff'` | `COLORS.background` | `backgroundColor: '#fff',` |
| L56 | `'#FF8D00'` | `COLORS.primary` | `borderTopColor: '#FF8D00',` |

---

## Step 87: src/_components/inbox/CreateGroupModal.tsx

**Hex count**: 3 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L205 | `"#9ca3af"` | `COLORS.textMuted` | `placeholderTextColor="#9ca3af"` |
| L215 | `"#9ca3af"` | `COLORS.textMuted` | `placeholderTextColor="#9ca3af"` |
| L231 | `"#1f2937"` | `COLORS.surface` | `&lt;Feather name="x" size={14} color="#1f2937" /&gt;` |

---

## Step 88: src/_components/PassportSection.tsx

**Hex count**: 3 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L101 | `'#667eea'` | `COLORS.surface` | `colors={['#667eea', '#764ba2']}` |
| L101 | `'#764ba2'` | `COLORS.surface` | `colors={['#667eea', '#764ba2']}` |
| L159 | `'#e74c3c'` | `COLORS.surface` | `colors={[COLORS.primary, '#e74c3c']}` |

---

## Step 89: src/_components/profile/StatsRow.tsx

**Hex count**: 3 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L33 | `'#e0e0e0'` | `COLORS.border` | `statsRow: { flexDirection: 'row', justifyContent: 'space-around', padd` |
| L35 | `'#222'` | `COLORS.textPrimary` | `statNum: { fontWeight: '700', fontSize: 18, color: '#222' },` |
| L36 | `'#666'` | `COLORS.textSecondary` | `statLbl: { fontSize: 12, color: '#666', marginTop: 2 },` |

---

## Step 90: app/auth/email-otp.tsx

**Hex count**: 2 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L160 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L175 | `"#FF8D00"` | `COLORS.primary` | `&lt;Ionicons name="mail" size={40} color="#FF8D00" /&gt;` |

---

## Step 91: app/auth/phone-otp.tsx

**Hex count**: 2 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L117 | `"#000"` | `COLORS.black` | `&lt;Ionicons name="arrow-back" size={24} color="#000" /&gt;` |
| L132 | `"#FF8D00"` | `COLORS.primary` | `&lt;Ionicons name="chatbubble-ellipses" size={40} color="#FF8D00" /&gt` |

---

## Step 92: app/auth/welcome.tsx

**Hex count**: 2 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L162 | `'#FFFC00'` | `COLORS.surface` | `backgroundColor: '#FFFC00',` |
| L163 | `'#FFFC00'` | `COLORS.surface` | `borderColor: '#FFFC00',` |

---

## Step 93: src/_components/auth/AuthBrandHeader.tsx

**Hex count**: 2 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L55 | `'#000'` | `COLORS.black` | `color: '#000',` |
| L63 | `'#666'` | `COLORS.textSecondary` | `color: '#666',` |

---

## Step 94: src/_components/PostCard/PostHeader.tsx

**Hex count**: 2 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L60 | `"#000"` | `COLORS.black` | `&lt;VerifiedBadge size={12} color="#000" /&gt;` |
| L71 | `"#666"` | `COLORS.textSecondary` | `&lt;Feather name="more-vertical" size={20} color="#666" /&gt;` |

---

## Step 95: app/(tabs)/post.tsx

**Hex count**: 1 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L5 | `'#000'` | `COLORS.black` | `return &lt;View style={{ flex: 1, backgroundColor: '#000' }} /&gt;;` |

---

## Step 96: app/auth/forgot-password.tsx

**Hex count**: 1 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L199 | `'#d4edda'` | `COLORS.surface` | `backgroundColor: '#d4edda',` |

---

## Step 97: app/index.tsx

**Hex count**: 1 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L45 | `'#000'` | `COLORS.black` | `&lt;View style={{ flex: 1, backgroundColor: '#000' }}&gt;` |

---

## Step 98: app/user/[userId]/locations.tsx

**Hex count**: 1 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L187 | `'#FF4500'` | `COLORS.surface` | `colors={[COLORS.primary, '#FF4500']}` |

---

## Step 99: src/_components/AppBrandMark.tsx

**Hex count**: 1 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L138 | `'#000000'` | `COLORS.black` | `color: '#000000',` |

---

## Step 100: src/_components/CommentSection.tsx

**Hex count**: 1 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L507 | `"#FFD700"` | `COLORS.surface` | `ListEmptyComponent={loading ? &lt;ActivityIndicator style={{ marginTop` |

---

## Step 101: src/_components/PassportStamp.tsx

**Hex count**: 1 | ✅ Already imports COLORS

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L50 | `'#7A3DB8'` | `COLORS.surface` | `place: '#7A3DB8',` |

---

## Step 102: src/_components/profile/AvatarUpload.tsx

**Hex count**: 1 | ❌ **Needs import**: Add `import COLORS from '@/src/theme/colors';` at top

| Line | Hardcoded | → Replace With | Context |
|------|----------|---------------|----------|
| L17 | `'#eee'` | `COLORS.border` | `avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: ` |

---

