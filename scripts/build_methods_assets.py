#!/usr/bin/env python3
"""Export Michael's supplied Methods PDFs without redrawing the figures.

Requires Poppler (pdftocairo, pdftoppm). The source folder is supplied locally;
only website artwork and a source-hash manifest are committed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess


PANELS = {
    "cohorts": "website_methods_cohort_overview.pdf",
    "workflow": "website_methods_ms_methods.pdf",
    "coverage-tiers": "website_methods_glycosite_tiering.pdf",
    "glycan-types-1": "website_methodsglycan_types_horizontal_1.pdf",
    "glycan-types-2": "website_methodsglycan_types_horizontal_2.pdf",
    "glycan-types-3": "website_methodsglycan_types_horizontal_3.pdf",
    "assignment-logic": "website_methods_glycan_type_logic.pdf",
    "heterogeneity": "website_methods_shannon_calculations.pdf",
    "tvd": "website_methods_TVD_calc.pdf",
    "site-summary": "website_methods_glycosite_stats_overview.pdf",
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, default=Path(__file__).resolve().parents[1] / "assets/methods")
    args = parser.parse_args()
    # Verify the complete source set before touching any existing exports.
    sources = [*PANELS.values(), "website_methods.pdf", "website_methods_figure_text_v3.docx"]
    missing = [name for name in sources if not (args.source_dir / name).is_file()]
    if missing:
        parser.error("Missing supplied sources: " + ", ".join(missing))
    args.out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "description": "Unmodified panel artwork exported from the supplied Methods PDFs; master PDF supplies section order; DOCX supplies prose.",
        "sources": {name: sha256(args.source_dir / name) for name in sources},
        "panels": [],
    }
    for slug, name in PANELS.items():
        svg = args.out_dir / (slug + ".svg")
        subprocess.run(["pdftocairo", "-svg", str(args.source_dir / name), str(svg)], check=True)
        preview = svg
        if slug in {"cohorts", "workflow"}:
            # These two SVGs contain large embedded illustrations. Load a sharp
            # 2600px preview; request the full vector figure only when opened.
            subprocess.run(["pdftoppm", "-scale-to", "2600", "-singlefile", "-png", str(args.source_dir / name), str(args.out_dir / slug)], check=True)
            preview = args.out_dir / (slug + ".png")
        manifest["panels"].append({"source": name, "vector": svg.name, "preview": preview.name, "preview_bytes": preview.stat().st_size, "vector_sha256": sha256(svg), "preview_sha256": sha256(preview)})
    (args.out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
