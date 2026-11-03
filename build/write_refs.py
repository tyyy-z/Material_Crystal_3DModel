import json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
for f in sorted((ROOT/"public"/"structures").glob("*.json")):
    if f.name == "index.json": continue
    d = json.loads(f.read_text()); s = d["source"]; mc = s["measured_cell"]; g = d["band_gap"]
    out = ROOT/"refs"/d["id"]; out.mkdir(parents=True, exist_ok=True)
    L = [f"# {d['name']['en']} / {d['name']['zh']} — {d['formula']}", "",
         f"- Space group: **{d['spacegroup']['symbol']} (#{d['spacegroup']['number']})**, {d['spacegroup']['crystal_system']}",
         f"- Structure source: COD [{s['cod_id']}]({s['url']}) — CIF {s['cif_url']}",
         f"- Publication: {s['journal']} ({s['year']})" + (f", DOI [{s['doi']}](https://doi.org/{s['doi']})" if s['doi'] else ""),
         f"- Measured cell (from CIF): a={mc['length_a']} b={mc['length_b']} c={mc['length_c']} Å; α={mc['angle_alpha']} β={mc['angle_beta']} γ={mc['angle_gamma']}°",
         f"- Conventional cell: {len(d['conventional']['sites'])} atoms; primitive: {len(d['primitive']['sites'])} atoms", "",
         "## Wyckoff sites", "", "| El | Wyckoff | mult | frac | CN | bond lengths (Å) |", "|---|---|---|---|---|---|"]
    L += [f"| {w['el']} | {w['wyckoff']} | {w['mult']} | {w['frac']} | {w['cn']} | {', '.join(map(str, sorted(set(w['bond_lengths']))))} |" for w in d["wyckoff"]]
    L += ["", "## Band gap", ""]
    if "measured" in g: L.append(f"- Measured (experiment): **{g['measured']['value']} eV** ({g['measured']['kind']}) — {g['measured']['src']}")
    else: L.append("- Measured: not yet sourced (shown as n/a in the app)")
    if "computed" in g: L.append(f"- Computed: {g['computed']['value']} eV, {g['computed']['method']} — {g['computed']['src']} (DFT-GGA underestimates gaps)")
    else: L.append("- Computed: n/a")
    L += ["", f"Bond cutoffs used: " + ", ".join(f"{b['a']}–{b['b']} ≤ {b['max']} Å" for b in d['bond_rules'])]
    (out/"REFS.md").write_text("\n".join(L) + "\n")
print("ok")
