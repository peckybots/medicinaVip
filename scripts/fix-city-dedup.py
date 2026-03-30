#!/usr/bin/env python3
"""
Normalize ciudad field: "City, Province" → "City" 
when both exist in the same country.
This consolidates duplicate city pages.
"""
import os
import re
import sys
from pathlib import Path
from collections import defaultdict

BASE = Path("/home/peckybot/projects/medicinaVip/src/content/clinicas")

# Load all clinic files and extract ciudad + pais
clinics = []
for md_file in BASE.rglob("*.md"):
    text = md_file.read_text()
    ciudad_match = re.search(r'^ciudad:\s*"([^"]+)"', text, re.MULTILINE)
    pais_match = re.search(r'^pais:\s*"([^"]+)"', text, re.MULTILINE)
    if ciudad_match and pais_match:
        clinics.append({
            "file": md_file,
            "ciudad": ciudad_match.group(1),
            "pais": pais_match.group(1),
            "text": text
        })

# Find city+pais combos
city_counts = defaultdict(int)
for c in clinics:
    key = (c["pais"], c["ciudad"])
    city_counts[key] += 1

# Identify "City, Province" where base "City" exists in same country
changes = []
for c in clinics:
    if "," in c["ciudad"]:
        base_city = c["ciudad"].split(",")[0].strip()
        base_key = (c["pais"], base_city)
        if city_counts[base_key] > 0:
            changes.append({
                "file": c["file"],
                "old_ciudad": c["ciudad"],
                "new_ciudad": base_city,
                "pais": c["pais"]
            })

print(f"Found {len(changes)} files to update\n")

# Show summary
by_pair = defaultdict(list)
for ch in changes:
    by_pair[(ch["pais"], ch["old_ciudad"], ch["new_ciudad"])].append(ch["file"])

for (pais, old, new), files in sorted(by_pair.items(), key=lambda x: -len(x[1])):
    print(f"  [{pais}] '{old}' → '{new}' ({len(files)} files)")

if "--dry-run" in sys.argv:
    print("\nDry run — no changes made.")
    sys.exit(0)

# Apply changes
updated = 0
for ch in changes:
    text = ch["file"].read_text()
    old_line = f'ciudad: "{ch["old_ciudad"]}"'
    new_line = f'ciudad: "{ch["new_ciudad"]}"'
    if old_line in text:
        new_text = text.replace(old_line, new_line, 1)
        ch["file"].write_text(new_text)
        updated += 1

print(f"\n✓ Updated {updated} files")
