"""Limpieza de datos USDA NASS (vía TidyTuesday 2022-01-11) para 'La colmena que se apaga' V1.
Entrada: data/raw/colony.csv, data/raw/stressor.csv
Salida:  data/colmena.json y data/data.js (window.DATA = ...)
"""
import json, math
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"

QMAP = {"January-March": 1, "April-June": 2, "July-September": 3, "October-December": 4}
QLAB = {1: "Ene–Mar", 2: "Abr–Jun", 3: "Jul–Sep", 4: "Oct–Dic"}
STRESS = {  # nombre original -> (clave, etiqueta en español)
    "Varroa mites": ("varroa", "Varroa"),
    "Other pests/parasites": ("plagas", "Otras plagas/parásitos"),
    "Disesases": ("enfermedades", "Enfermedades"),  # typo en el origen
    "Pesticides": ("pesticidas", "Pesticidas"),
    "Other": ("otros", "Otros (clima, hambre, reina)"),
    "Unknown": ("desconocido", "Desconocido"),
}
ABBR = {'Alabama':'AL','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT',
'Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS',
'Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','New Jersey':'NJ','New Mexico':'NM','New York':'NY',
'North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA',
'South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA',
'Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY','United States':'US','Other States':'OT'}

def num(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else float(v)

col = pd.read_csv(RAW / "colony.csv")
st = pd.read_csv(RAW / "stressor.csv")
for df in (col, st):
    df["year"] = df["year"].astype(int)
    df["q"] = df["months"].map(QMAP)
    df["abbr"] = df["state"].map(ABBR)
assert col["abbr"].notna().all() and st["abbr"].notna().all()

# Eje temporal continuo 2015Q1..2021Q2 (26 trimestres). 2019 Q2 no fue encuestado por USDA -> hueco explícito.
periods = [(y, q) for y in range(2015, 2022) for q in range(1, 5) if (y, q) <= (2021, 2)]
pidx = {p: i for i, p in enumerate(periods)}

st["key"] = st["stressor"].map(lambda s: STRESS[s][0])
stw = st.pivot_table(index=["abbr", "year", "q"], columns="key", values="stress_pct", aggfunc="first")

series = {}
for abbr, g in col.groupby("abbr"):
    rows = []
    gi = g.set_index(["year", "q"])
    for (y, q) in periods:
        r = gi.loc[(y, q)] if (y, q) in gi.index else None
        rec = {"t": pidx[(y, q)]}
        if r is not None and not pd.isna(r["colony_lost"]):
            n, mx, lost = num(r["colony_n"]), num(r["colony_max"]), num(r["colony_lost"])
            # % pérdida con decimal: USDA = perdidas / máximo de colonias del trimestre.
            # Para el total nacional no hay 'max' -> se usa el % publicado.
            pct = round(100 * lost / mx, 1) if mx else num(r["colony_lost_pct"])
            rec.update(n=n, lost=lost, pct=pct, added=num(r["colony_added"]),
                       reno=num(r["colony_reno"]))
        else:
            rec["missing"] = True
        if (abbr, y, q) in stw.index:
            s = stw.loc[(abbr, y, q)]
            rec["s"] = {k: num(s.get(k)) for k, _ in STRESS.values()}
        rows.append(rec)
    series[abbr] = rows

names = {v: k for k, v in ABBR.items()}
names["US"] = "Estados Unidos"; names["OT"] = "Otros estados (agregados)"
out = {
    "periods": [{"t": pidx[p], "year": p[0], "q": p[1], "label": f"{QLAB[p[1]]} {p[0]}"} for p in periods],
    "stressors": [{"key": k, "label": l} for k, l in STRESS.values()],
    "names": names,
    "series": series,
    "source": "USDA NASS, Honey Bee Colonies (2015–2021), vía TidyTuesday 2022-01-11",
}
(ROOT / "data" / "colmena.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
(ROOT / "data" / "data.js").write_text("window.DATA = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")

us = [r for r in series["US"] if not r.get("missing")]
print("trimestres:", len(periods), "| estados:", len(series) - 2, "| faltantes US:", sum(1 for r in series['US'] if r.get('missing')))
print("pérdida US min/max %:", min(r['pct'] for r in us), max(r['pct'] for r in us))
