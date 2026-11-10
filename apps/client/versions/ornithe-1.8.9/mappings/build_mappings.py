"""Builds tiny v2 mappings for Ornithe 1.8.9 with MCP names (official -> intermediary -> named).

Ornithe's Calamus intermediary maps the obfuscated game to stable ids, and MCP (stable 22) maps the
same obfuscated game to the names Novex's Forge 1.8.9 build is written in. Joining the two on the
obfuscated names lets the Ornithe build share that code instead of using Feather's names.

Usage: python3 build_mappings.py calamus.tiny joined.srg mcp_stable.zip out.tiny
"""
import csv, io, sys, zipfile

calamus_path, srg_path, mcp_zip, out_path = sys.argv[1:5]

# MCP: obf -> srg (classes get their final names here), then srg -> readable via the CSVs.
cls, fld, mth = {}, {}, {}
for line in open(srg_path):
    p = line.split()
    if not p: continue
    if p[0] == "CL:": cls[p[1]] = p[2]
    elif p[0] == "FD:":
        o, s = p[1].rsplit("/", 1), p[2].rsplit("/", 1)
        fld[(o[0], o[1])] = s[1]
    elif p[0] == "MD:":
        o = p[1].rsplit("/", 1)
        mth[(o[0], o[1], p[2])] = p[3].rsplit("/", 1)[1]

names = {}
with zipfile.ZipFile(mcp_zip) as z:
    for f in ("fields.csv", "methods.csv"):
        for row in csv.DictReader(io.TextIOWrapper(z.open(f), "utf-8")):
            names[row["searge"]] = row["name"]

# Calamus v1: CLASS obf inter / FIELD owner desc obf inter / METHOD owner desc obf inter.
classes = {}
for line in open(calamus_path):
    p = line.rstrip("\n").split("\t")
    if p[0] == "CLASS":
        classes.setdefault(p[1], {"inter": p[2], "f": [], "m": []})
    elif p[0] in ("FIELD", "METHOD"):
        c = classes.setdefault(p[1], {"inter": p[1], "f": [], "m": []})
        c["f" if p[0] == "FIELD" else "m"].append((p[2], p[3], p[4]))

def named_member(srg):
    return names.get(srg, srg) if srg else None

out = ["tiny\t2\t0\tofficial\tintermediary\tnamed"]
missing = 0
for obf, c in sorted(classes.items()):
    named_cls = cls.get(obf, c["inter"])
    out.append(f"c\t{obf}\t{c['inter']}\t{named_cls}")
    for desc, o, inter in c["f"]:
        n = named_member(fld.get((obf, o)))
        if n is None: missing += 1
        out.append(f"\tf\t{desc}\t{o}\t{inter}\t{n or inter}")
    for desc, o, inter in c["m"]:
        n = named_member(mth.get((obf, o, desc)))
        if n is None: missing += 1
        out.append(f"\tm\t{desc}\t{o}\t{inter}\t{n or inter}")
open(out_path, "w").write("\n".join(out) + "\n")
print(f"{len(classes)} classes, {missing} members without an MCP name (kept intermediary)")
