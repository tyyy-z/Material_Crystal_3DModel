"""Build-time only: CIF (COD) -> static JSON for the browser. Run: python build/build_structures.py"""
import json, re, warnings, sys, pathlib, html
import numpy as np, yaml
warnings.filterwarnings("ignore")
from pymatgen.core import Structure, Element
from pymatgen.io.cif import CifParser
from pymatgen.symmetry.analyzer import SpacegroupAnalyzer
from scipy.spatial import ConvexHull
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from materials import MATERIALS, COD
ROOT = pathlib.Path(__file__).resolve().parents[1]
CIF, OUT = ROOT/"data"/"cif", ROOT/"public"/"structures"
SCHEMES = yaml.safe_load(open(pathlib.Path(Element.__module__ and __import__("pymatgen.core").core.__file__).parent/"ElementColorSchemes.yaml"))

def hexc(rgb): return "#%02x%02x%02x" % tuple(rgb)
def cif_field(text, key):
    m = re.search(rf"^{key}[ \t]+(\S.*)$", text, re.M)
    if m: return html.unescape(m.group(1).strip().strip("'"))
    m = re.search(rf"^{key}\s*\n;\s*\n(.+?)\n;", text, re.M | re.S)  # multi-line ;...; value
    return " ".join(m.group(1).split()) if m else None
def num(v): return float(re.sub(r"\(.*\)", "", v)) if v else None

def site_wyckoff(s, rules, wyck):
    """Index into `wyck` for every site of s, by (element, Wyckoff letter, bond-length signature)."""
    ss = SpacegroupAnalyzer(s, symprec=0.02).get_symmetrized_structure(); out = [None] * len(s)
    for idxs, wsym in zip(ss.equivalent_indices, ss.wyckoff_symbols):
        i = idxs[0]; el = ss[i].specie.symbol; letter = re.sub(r"^\d+", "", wsym)
        sig = sorted(n.nn_distance for n in neighbours(ss, i, rules))
        cands = [k for k, w in enumerate(wyck) if w["el"] == el and re.sub(r"^\d+", "", w["wyckoff"]) == letter] or \
                [k for k, w in enumerate(wyck) if w["el"] == el]
        def score(k):
            b = wyck[k]["bond_lengths"]; return (len(b) != len(sig), sum(abs(x - y) for x, y in zip(b, sig)))
        best = min(cands, key=score)
        for j in idxs: out[j] = best
    return out

def cell(s, wmap=None):
    L = s.lattice
    return dict(matrix=np.round(L.matrix, 6).tolist(), a=round(L.a,5), b=round(L.b,5), c=round(L.c,5),
                alpha=round(L.alpha,4), beta=round(L.beta,4), gamma=round(L.gamma,4), volume=round(L.volume,4),
                sites=[dict(el=site.specie.symbol, frac=[round(float(x), 6) % 1.0 for x in site.frac_coords], **({"w": wmap[k]} if wmap else {})) for k, site in enumerate(s)])

SUB = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
def sym_axis(s):
    """Highest-order rotation (pure preferred, else screw) for the spin animation, in cartesian Å.
    Among equal candidates choose the axis closest to the cell centre."""
    L = s.lattice.matrix; ctr = 0.5 * L.sum(0); best = None
    for op in SpacegroupAnalyzer(s, symprec=0.02).get_symmetry_operations(cartesian=False):
        R, t0 = op.rotation_matrix, op.translation_vector
        if round(np.linalg.det(R)) != 1 or np.allclose(R, np.eye(3)): continue
        for sh in np.array(np.meshgrid([-1, 0, 1], [-1, 0, 1], [-1, 0, 1])).T.reshape(-1, 3):
            t = t0 + sh
            Rc = L.T @ R @ np.linalg.inv(L.T)  # cartesian rotation
            tr = np.clip((np.trace(Rc) - 1) / 2, -1, 1); ang = np.arccos(tr); n = int(round(2 * np.pi / ang))
            w, v = np.linalg.eig(Rc); u = np.real(v[:, np.argmin(abs(w - 1))]); u /= np.linalg.norm(u)
            if u @ np.array([0.3, 0.2, 1.0]) < 0: u = -u
            tc = t @ L; tau = sum(np.linalg.matrix_power(Rc, k) @ tc for k in range(n)) / n  # screw component
            pt = np.linalg.lstsq(np.eye(3) - Rc, tc - tau, rcond=None)[0]
            pt = pt - u * ((pt - ctr) @ u)  # foot of the axis nearest the centre
            screw = float(tau @ u); lat = abs(screw) > 1e-3
            sgn = 1.0 if (np.array([Rc[2,1]-Rc[1,2], Rc[0,2]-Rc[2,0], Rc[1,0]-Rc[0,1]]) @ u) >= 0 else -1.0
            dist = float(np.linalg.norm(np.cross(ctr - pt, u)))
            lab = str(n)
            if lat:
                per = [np.linalg.norm(v) for v in (*L, L.sum(0)) if abs(abs(v @ u) - np.linalg.norm(v)) < 1e-3]
                m = int(round(n * (screw * sgn % (per[0] if per else 1e9)) / per[0])) % n if per else 1
                lab = str(n) + str(m).translate(SUB)
            key = (-n, lat, round(dist, 2), round(abs(screw), 2))
            if best is None or key < best[0]:
                best = (key, dict(order=n, dir=np.round(u, 5).tolist(), point=np.round(pt, 4).tolist(), screw=round(screw, 4), angle=round(sgn * 360 / n, 3), label=lab))
    return best[1] if best else None

def neighbours(s, i, rules):
    el = s[i].specie.symbol; out = []
    for n in s.get_neighbors(s[i], max(rules.values()) + 0.05):
        cut = rules.get((el, n.specie.symbol)) or rules.get((n.specie.symbol, el))
        if cut and n.nn_distance <= cut: out.append(n)
    return out

def build(m):
    text = (CIF/f"{m['cif']}.cif").read_text()
    s0 = CifParser.from_str(text).parse_structures(primitive=False)[0]
    s0.remove_oxidation_states()
    sga = SpacegroupAnalyzer(s0, symprec=0.02)
    conv = sga.get_refined_structure(); sga_c = SpacegroupAnalyzer(conv, symprec=0.02)
    prim = sga_c.get_primitive_standard_structure()
    if len(prim) == len(conv): prim = conv.copy()  # P lattice: keep the same origin/orientation so the morph is identity
    sym = sga_c.get_symmetrized_structure()
    rules = {tuple(k): v for k, v in m["bonds"].items()}
    wyck, cn_by_el = [], {}
    for idxs, wsym in zip(sym.equivalent_indices, sym.wyckoff_symbols):
        i = idxs[0]; el = sym[i].specie.symbol; nb = neighbours(sym, i, rules)
        cn = {}
        for n in nb: cn[n.specie.symbol] = cn.get(n.specie.symbol, 0) + 1
        d = sorted(round(n.nn_distance, 4) for n in nb)
        wyck.append(dict(el=el, wyckoff=wsym, mult=len(idxs), frac=[round(float(x), 5) % 1.0 for x in sym[i].frac_coords],
                         cn=cn, cn_total=len(nb), bond_lengths=d))
        prev = cn_by_el.get(el)
        cn_by_el[el] = cn if prev is None else {k: min(prev.get(k, 0), v) for k, v in cn.items()} if prev != cn else prev
    # polyhedra for the conventional cell (centre index + vertex cartesian coords + hull faces)
    poly = []
    for i, site in enumerate(conv):
        if site.specie.symbol not in m["polyhedra"]: continue
        nb = neighbours(conv, i, rules)
        pts = np.array([n.coords for n in nb])
        if len(pts) >= 4:
            hull = ConvexHull(pts); poly.append(dict(center=i, el=site.specie.symbol,
                vertices=np.round(pts, 5).tolist(), faces=hull.simplices.tolist()))
    # cartesian bonds inside the conventional cell (centre in cell, partner may be an image)
    bonds = []
    for i, site in enumerate(conv):
        for n in neighbours(conv, i, rules):
            if n.index > i or not np.allclose(n.image, 0):  # count each in-cell pair once, keep image bonds
                bonds.append(dict(i=i, j=int(n.index), image=[int(x) for x in n.image], d=round(n.nn_distance, 4)))
    meas = {k: num(cif_field(text, f"_cell_{k}")) for k in ["length_a","length_b","length_c","angle_alpha","angle_beta","angle_gamma"]}
    els = sorted({x.specie.symbol for x in conv})
    elements = {e: dict(Z=Element(e).Z, name=Element(e).long_name,
                        vesta=hexc(SCHEMES["VESTA"][e]), jmol=hexc(SCHEMES["Jmol"][e]),
                        atomic_radius=float(Element(e).atomic_radius or 1.0)) for e in els}
    doi = cif_field(text, "_journal_paper_doi")
    return dict(
        id=m["id"], name=m["name"], prototype=m["prototype"], formula=conv.composition.reduced_formula,
        spacegroup=dict(symbol=sga_c.get_space_group_symbol(), number=sga_c.get_space_group_number(),
                        crystal_system=sga_c.get_crystal_system(), point_group=sga_c.get_point_group_symbol()),
        source=dict(db="COD", cod_id=m["cod"], url=COD.format(m["cod"]), cif_url=f"https://www.crystallography.net/cod/{m['cod']}.cif",
                    doi=doi, journal=cif_field(text, "_journal_name_full"), year=cif_field(text, "_journal_year"),
                    measured_cell=meas),
        band_gap=m.get("gap", {}), bond_rules=[dict(a=a, b=b, max=v, draw=(a, b) not in m.get("nodraw", [])) for (a, b), v in rules.items()],
        polyhedra_elements=m["polyhedra"], elements=elements,
        wyckoff=wyck, coordination=cn_by_el, density=round(float(conv.density), 4),
        conventional=cell(conv, site_wyckoff(conv, rules, wyck)), primitive=cell(prim, site_wyckoff(prim, rules, wyck)), conventional_bonds=bonds, conventional_polyhedra=poly,
        sym_axis=sym_axis(conv))

def main():
    OUT.mkdir(parents=True, exist_ok=True); index = []
    for m in MATERIALS:
        d = build(m); (OUT/f"{m['id']}.json").write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")))
        index.append(dict(id=d["id"], name=d["name"], formula=d["formula"], prototype=d["prototype"],
                          spacegroup=d["spacegroup"], nconv=len(d["conventional"]["sites"]), nprim=len(d["primitive"]["sites"])))
        print(f"{d['id']:12s} {d['spacegroup']['symbol']:10s} #{d['spacegroup']['number']:<4d} conv={len(d['conventional']['sites']):3d} prim={len(d['primitive']['sites']):3d} CN={d['coordination']}")
    (OUT/"index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))
if __name__ == "__main__": main()
