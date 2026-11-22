#!/usr/bin/env python3
"""
Import des limites administratives COD-AB Cameroun (OCHA / INC, CC BY-IGO) dans `public.admin_areas`.

Étape 1 (ce script) : lit les GeoJSON ADM1/ADM2/ADM3 décompressés depuis HDX
  https://data.humdata.org/dataset/cod-ab-cmr  (fichier cmr_admin_boundaries.geojson.zip)
et écrit du SQL brut (géométries complètes) vers la sortie standard.

Étape 2 (scripts/import-codab.sh) : charge ce SQL dans une base locale, simplifie les géométries
(≈ 50 m, topologie préservée) et produit des lots SQL compacts à appliquer sur Supabase.

Usage : python3 -I scripts/import_codab.py <dossier_geojson> > raw.sql
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from names import commune_display_name  # noqa: E402


def q(s):
    return "null" if s is None else "'" + str(s).replace("'", "''") + "'"


def main(folder: str) -> None:
    base = Path(folder)
    print("begin;")
    for level in (1, 2, 3):
        data = json.loads((base / f"cmr_admin{level}.geojson").read_text(encoding="utf-8"))
        for feat in data["features"]:
            p = feat["properties"]
            pcode = p[f"adm{level}_pcode"]
            parent = p.get(f"adm{level - 1}_pcode") if level > 1 else None
            codab = p.get(f"adm{level}_name1") or p.get(f"adm{level}_name")
            name_en = p.get(f"adm{level}_name") if level == 1 else None
            name = commune_display_name(codab) if level == 3 else codab
            geom = json.dumps(feat["geometry"], separators=(",", ":"))
            print(
                "insert into public.admin_areas (pcode, level, parent_pcode, name_codab, name, name_en, geom, anchor, area_sqkm) values ("
                f"{q(pcode)}, {level}, {q(parent)}, {q(codab)}, {q(name)}, {q(name_en)}, "
                f"extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson({q(geom)}), 4326)), "
                f"extensions.st_pointonsurface(extensions.st_setsrid(extensions.st_geomfromgeojson({q(geom)}), 4326)), "
                f"{p.get('area_sqkm') or 'null'});"
            )
    print("commit;")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
