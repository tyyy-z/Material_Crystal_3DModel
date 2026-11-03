"""Fails if any generated structure disagrees with independent textbook references (build/materials.py `expect`)."""
import json, pathlib, sys, pytest
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/"build"))
from materials import MATERIALS

@pytest.mark.parametrize("m", MATERIALS, ids=[m["id"] for m in MATERIALS])
def test_structure_matches_reference(m):
    d = json.loads((ROOT/"public"/"structures"/f"{m['id']}.json").read_text())
    e = m["expect"]
    assert d["spacegroup"]["number"] == e["sg"], f"space group {d['spacegroup']}"
    assert len(d["conventional"]["sites"]) == e["nconv"], "conventional atom count"
    for el, want in e["cn"].items():
        for w in (x for x in d["wyckoff"] if x["el"] == el):
            for partner, n in want.items():
                assert w["cn"].get(partner, 0) == n, f"CN {el}({w['wyckoff']})-{partner} = {w['cn']} expected {n}"
    # lattice must be the measured COD cell (refined setting must not swap axes)
    mc = d["source"]["measured_cell"]; c = d["conventional"]
    for k in "abc":
        assert abs(c[k] - mc[f"length_{k}"]) < 0.01, f"lattice {k}: {c[k]} vs CIF {mc[f'length_{k}']}"
    # primitive cell volume * Z ratio consistency
    ratio = c["volume"] / d["primitive"]["volume"]
    assert abs(ratio - len(c["sites"]) / len(d["primitive"]["sites"])) < 1e-3
    # polyhedra present when requested
    for el in m["polyhedra"]:
        assert any(p["el"] == el for p in d["conventional_polyhedra"]), f"missing {el} polyhedra"
    # every site maps to a Wyckoff orbit of its own element, and orbit sizes add up
    for cname in ("conventional", "primitive"):
        sites = d[cname]["sites"]
        assert all(d["wyckoff"][x["w"]]["el"] == x["el"] for x in sites)
    from collections import Counter
    cnt = Counter(x["w"] for x in c["sites"])
    for k, w in enumerate(d["wyckoff"]): assert cnt[k] == w["mult"], f"orbit {w['el']} {w['wyckoff']}: {cnt[k]} sites vs mult {w['mult']}"
    gm = d["band_gap"].get("measured")
    if gm:
        assert gm["src"].startswith("https://")
        assert gm["tier"] in ("primary", "secondary")
        if gm["tier"] == "primary": assert gm["src"].startswith("https://doi.org/") and gm["quote"]
        assert "amorphous" not in gm["kind"]


def test_sym_axis():
    """Every structure ships a proper rotation / screw axis for the symmetry-spin animation."""
    import math
    for p in (ROOT / "public" / "structures").glob("*.json"):
        if p.name == "index.json":
            continue
        ax = json.loads(p.read_text())["sym_axis"]
        assert ax["order"] >= 2, p.name
        assert abs(math.hypot(*ax["dir"]) - 1) < 1e-3, p.name
        assert abs(abs(ax["angle"]) - 360 / ax["order"]) < 1e-6, p.name
        assert ax["label"][0] == str(ax["order"]), p.name
