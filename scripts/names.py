"""Copie Python de communeDisplayName (packages/core/src/names.ts). Les deux sont testées sur les mêmes exemples."""
import re

ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]

ACCENT_FIXES = {
    "Yaounde": "Yaoundé",
    "Ngaoundere": "Ngaoundéré",
    "Edea": "Édéa",
    "Eseka": "Éséka",
    "Ebolowa": "Ébolowa",
    "Belabo": "Bélabo",
    "Betare-Oya": "Bétaré-Oya",
    "Kaele": "Kaélé",
    "Lomie": "Lomié",
    "Sangmelima": "Sangmélima",
    "Tchollire": "Tcholliré",
    "Tignere": "Tignère",
    "Galim-Tignere": "Galim-Tignère",
    "Bangangte": "Bangangté",
    "Doume": "Doumé",
    "Zoetele": "Zoétélé",
    "Nanga-Eboko": "Nanga-Éboko",
    "Meiganga": "Meïganga",
    "Kousseri": "Kousséri",
    "Tokombere": "Tokombéré",
}


def commune_display_name(codab_name: str) -> str:
    s = codab_name.strip()
    m = re.match(r"^(.*?)\s+(\d{1,2})(?:er|e|ème|st|nd|rd|th)$", s, re.IGNORECASE)
    base = m.group(1) if m else s
    fixed = ACCENT_FIXES.get(base, base)
    if not m:
        return fixed
    n = int(m.group(2))
    return f"{fixed} {ROMAN[n] if n < len(ROMAN) else n}"


if __name__ == "__main__":
    cases = {
        "Yaounde 7e": "Yaoundé VII",
        "Douala 1er": "Douala I",
        "Douala 5e": "Douala V",
        "Bamenda 2nd": "Bamenda II",
        "Ngaoundere 3e": "Ngaoundéré III",
        "Akom 2": "Akom 2",
        "Mbalmayo": "Mbalmayo",
        "Sangmelima": "Sangmélima",
    }
    for k, v in cases.items():
        assert commune_display_name(k) == v, (k, commune_display_name(k), v)
    print("names.py : OK")
