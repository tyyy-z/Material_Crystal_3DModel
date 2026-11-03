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
    gm = d["band_gap"].get("measured")
    if gm: assert gm["src"].startswith("https://")
