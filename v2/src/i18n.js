export const STR = {
  en: { brand: "Crystal Structures", brandSub: "13 measured structures · 3D", conventional: "Conventional", primitive: "Primitive",
    supercell: "Supercell", polyhedra: "Polyhedra", labels: "Labels", reset: "Reset view", elements: "Elements & sites",
    lattice: "Lattice", shown: "Shown", measured: "Measured", computed: "Computed (DFT)", bandgap: "Band gap", na: "no sourced value",
    source: "Source", bondRules: "Bond rules", notDrawn: "counted for CN, not drawn", atomsCell: "atoms / cell", selected: "Selected site",
    cn: "CN", wyckoff: "Wyckoff", frac: "Fractional x y z", bonds: "Bond lengths", hint: "Drag to rotate · scroll to zoom · click an atom",
    clear: "Clear", sources: "Data: COD CIFs, built with pymatgen", details: "Details", groups: { el: "Elements", bin: "Binary compounds", ox: "Oxides", bat: "Battery cathodes" },
    view: "View", cell: "Cell", showing: "Showing", atoms: "atoms", system: { cubic: "cubic", hexagonal: "hexagonal", trigonal: "trigonal", tetragonal: "tetragonal", orthorhombic: "orthorhombic" } },
  zh: { brand: "晶体结构", brandSub: "13 个实测结构 · 3D", conventional: "惯用晶胞", primitive: "原胞",
    supercell: "超胞", polyhedra: "配位多面体", labels: "标签", reset: "重置视角", elements: "元素与格位",
    lattice: "晶格参数", shown: "当前显示", measured: "实验测量", computed: "计算值 (DFT)", bandgap: "带隙", na: "暂无可引用数据",
    source: "数据来源", bondRules: "成键规则", notDrawn: "计入配位数，不绘制", atomsCell: "原子 / 晶胞", selected: "选中格位",
    cn: "配位数", wyckoff: "Wyckoff 位置", frac: "分数坐标 x y z", bonds: "键长", hint: "拖动旋转 · 滚轮缩放 · 点击原子",
    clear: "清除", sources: "数据：COD CIF，由 pymatgen 生成", details: "详情", groups: { el: "单质", bin: "二元化合物", ox: "氧化物", bat: "电池正极材料" },
    view: "视图", cell: "晶胞", showing: "显示", atoms: "个原子", system: { cubic: "立方", hexagonal: "六方", trigonal: "三方", tetragonal: "四方", orthorhombic: "正交" } },
};
export const PROTO_ZH = { "diamond": "金刚石型", "rock salt": "岩盐型", "CsCl (B2)": "CsCl 型 (B2)", "fluorite": "萤石型", "zinc blende": "闪锌矿型",
  "wurtzite": "纤锌矿型", "cubic perovskite": "立方钙钛矿", "rutile": "金红石型", "olivine": "橄榄石型", "α-NaFeO2 layered": "α-NaFeO2 层状", "graphite": "石墨型", "α-quartz": "α-石英" };
export const EL_ZH = { Si: "硅", Na: "钠", Cl: "氯", Cs: "铯", Ca: "钙", F: "氟", Zn: "锌", S: "硫", Ga: "镓", N: "氮", Sr: "锶", Ti: "钛", O: "氧", Li: "锂", Fe: "铁", P: "磷", Co: "钴", C: "碳" };
export const GROUPS = [["el", ["si", "graphite"]], ["bin", ["nacl", "cscl", "caf2", "zns-zb", "zns-wz", "gan"]], ["ox", ["srtio3", "tio2-rutile", "quartz"]], ["bat", ["lifepo4", "licoo2"]]];
