// Guided tours: 2-4 steps per structure. Numbers come from the structure JSON through tokens, never typed by hand:
// {w:k} site label (e.g. "Si 8a"), {cn:k} coordination number, {d:k}/{D:k} shortest/longest bond (Å), {c2} c/2 (Å).
// Every tour starts with the Wyckoff build-up and ends with the symmetry-axis spin (both generic, see main.js).
export const GENERIC = {
  build: { en: "Built from Wyckoff sites: {orbits}. {N} atoms in the conventional cell come from {k} symmetry-distinct site(s).",
           zh: "由 Wyckoff 位置搭建：{orbits}。惯用晶胞的 {N} 个原子来自 {k} 个对称不等价位置。" },
  spin:  { en: "Symmetry {axis}: rotate {ang}° about the blue axis{scr}. The faint ghost is the original — atoms land on equivalent sites.",
           zh: "对称操作 {axis}：绕蓝色轴旋转 {ang}°{scr}。淡色虚影为原结构——原子落到等价位置上。" },
  scrEn: " and slide {s} Å along it (a screw axis)", scrZh: "，并沿轴平移 {s} Å（螺旋轴）",
};
export const TOURS = {
  si: [
    { pick: 0, en: "Each {w:0} atom bonds to {cn:0} neighbours at {d:0} Å, a regular tetrahedron (sp³).", zh: "每个 {w:0} 原子与 {cn:0} 个近邻成键，键长 {d:0} Å，构成正四面体（sp³）。" },
    { cell: "primitive", en: "The cubic cell is 4× the primitive cell, which holds only 2 Si atoms.", zh: "立方惯用晶胞是原胞的 4 倍；原胞只含 2 个 Si 原子。" } ],
  graphite: [
    { pick: 0, en: "Each C has {cn:0} neighbours at {d:0} Å in a flat hexagonal layer (sp²).", zh: "每个 C 在平面六角层内有 {cn:0} 个近邻，键长 {d:0} Å（sp²）。" },
    { n: 2, en: "Layers stack ABAB along c, {c2} Å apart, held by weak van der Waals forces (not drawn as bonds).", zh: "层沿 c 轴按 ABAB 堆叠，层间距 {c2} Å，靠较弱的范德华力结合（不画成键）。" } ],
  nacl: [
    { pick: 0, en: "Each {w:0} sits in an octahedron of {cn:0} Cl at {d:0} Å. Na and Cl form two interpenetrating fcc lattices.", zh: "每个 {w:0} 位于由 {cn:0} 个 Cl 构成的八面体中心，距离 {d:0} Å。Na 与 Cl 各自构成互相穿插的面心立方格子。" },
    { cell: "primitive", en: "The primitive cell holds one formula unit: 1 Na + 1 Cl.", zh: "原胞只含一个化学式单元：1 个 Na + 1 个 Cl。" } ],
  cscl: [
    { pick: 0, en: "{w:0} has {cn:0} Cl at the corners of a cube, {d:0} Å away. This is simple cubic with a 2-atom basis, not bcc.", zh: "{w:0} 周围 {cn:0} 个 Cl 位于立方体顶点，距离 {d:0} Å。这是带两原子基元的简单立方，而非体心立方。" },
    { n: 2, en: "In a 2×2×2 block the roles swap freely: Cl is also 8-coordinate by Cs.", zh: "在 2×2×2 超胞中两种离子地位对等：Cl 同样被 8 个 Cs 配位。" } ],
  caf2: [
    { pick: 0, en: "{w:0} sits in a cube of {cn:0} F at {d:0} Å.", zh: "{w:0} 位于由 {cn:0} 个 F 构成的立方体中心，距离 {d:0} Å。" },
    { pick: 1, poly: true, en: "Seen from F: each {w:1} is tetrahedral, with {cn:1} Ca. The polyhedra drawn are these FCa₄ tetrahedra.", zh: "从 F 看：每个 {w:1} 被 {cn:1} 个 Ca 四面体配位，图中多面体即 FCa₄ 四面体。" } ],
  "zns-zb": [
    { pick: 0, en: "{w:0} and {w:1} are both tetrahedral ({d:0} Å). This is diamond with the two sites taken by different atoms.", zh: "{w:0} 与 {w:1} 均为四面体配位（{d:0} Å）：相当于两套位置由不同原子占据的金刚石结构。" },
    { cell: "primitive", en: "The primitive cell holds a single ZnS pair.", zh: "原胞只含一对 ZnS。" } ],
  "zns-wz": [
    { pick: 0, en: "The same ZnS₄ tetrahedra as zinc blende ({d:0}–{D:0} Å), but stacked ABAB along c instead of ABC.", zh: "与闪锌矿相同的 ZnS₄ 四面体（{d:0}–{D:0} Å），但沿 c 轴按 ABAB 而非 ABC 堆叠。" },
    { n: 2, en: "A 2×2×2 block shows the hexagonal stacking.", zh: "2×2×2 超胞展示六方堆叠。" } ],
  gan: [
    { pick: 0, en: "{w:0} sits in a tetrahedron of {cn:0} N at {d:0}–{D:0} Å (wurtzite).", zh: "{w:0} 位于 {cn:0} 个 N 构成的四面体中，键长 {d:0}–{D:0} Å（纤锌矿结构）。" },
    { n: 3, en: "GaN₄ tetrahedra all point the same way along c: the structure is polar.", zh: "GaN₄ 四面体沿 c 轴朝向一致：结构具有极性。" } ],
  srtio3: [
    { pick: 1, en: "{w:1} is at the centre of an octahedron of {cn:1} O at {d:1} Å.", zh: "{w:1} 位于 {cn:1} 个 O 构成的八面体中心，距离 {d:1} Å。" },
    { n: 2, pick: 0, en: "In 2×2×2 the TiO₆ octahedra share corners; {w:0} fills the cavity between them, {cn:0}-coordinate at {d:0} Å.", zh: "2×2×2 超胞中 TiO₆ 八面体共顶点相连；{w:0} 填在其间的空隙中，配位数 {cn:0}，距离 {d:0} Å。" } ],
  "tio2-rutile": [
    { pick: 0, en: "{w:0} sits in a slightly distorted octahedron of {cn:0} O ({d:0}–{D:0} Å).", zh: "{w:0} 位于略畸变的 {cn:0} 个 O 构成的八面体中（{d:0}–{D:0} Å）。" },
    { n: 2, en: "Octahedra share edges along c, forming chains that are linked by corners.", zh: "八面体沿 c 轴共棱成链，链与链之间共顶点相连。" } ],
  quartz: [
    { pick: 0, en: "{w:0} is tetrahedral, {cn:0} O at {d:0}–{D:0} Å; every O bridges two Si.", zh: "{w:0} 为四面体配位，{cn:0} 个 O，键长 {d:0}–{D:0} Å；每个 O 桥接两个 Si。" },
    { n: 2, en: "The SiO₄ tetrahedra spiral around c; the handedness makes quartz chiral.", zh: "SiO₄ 四面体绕 c 轴呈螺旋排列，其旋向使石英具有手性。" } ],
  lifepo4: [
    { pick: 1, en: "{w:1} sits in a distorted octahedron of {cn:1} O ({d:1}–{D:1} Å).", zh: "{w:1} 位于畸变的 {cn:1} 个 O 构成的八面体中（{d:1}–{D:1} Å）。" },
    { pick: 0, en: "{w:0} lines up in chains along b: the 1-D channels Li⁺ moves through when the cell charges and discharges.", zh: "{w:0} 沿 b 轴排成链：充放电时 Li⁺ 沿这些一维通道迁移。" } ],
  licoo2: [
    { pick: 1, en: "{w:1} octahedra ({d:1} Å) share edges to form flat CoO₂ layers.", zh: "{w:1} 八面体（{d:1} Å）共棱形成平整的 CoO₂ 层。" },
    { pick: 0, en: "{w:0} sits between the layers, also octahedral ({d:0} Å); Li⁺ leaves these layers on charging.", zh: "{w:0} 位于层间，同样为八面体配位（{d:0} Å）；充电时 Li⁺ 从这些层间脱出。" } ],
};
