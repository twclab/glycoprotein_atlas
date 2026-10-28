#!/usr/bin/env python3
"""Export Michael's supplied Methods PDFs without redrawing the figures.

Requires Poppler (pdftocairo, pdftoppm). The source folder is supplied locally;
only website artwork and a source-hash manifest are committed.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET


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


def glycan_label_boxes(root):
    boxes = []
    pattern = r"M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) Z M [\d.]+ [\d.]+\s*"
    for element in root.iter():
        if not element.tag.endswith("}path") or "transform" in element.attrib:
            continue
        match = re.fullmatch(pattern, element.get("d", ""))
        if match:
            x0, y0, x1, _, _, y1, _, _ = map(float, match.groups())
            if x1 - x0 > 30 and y1 - y0 > 10 and y0 > 50:
                boxes.append((x0, y0, x1, y1))
    if len(boxes) != 8:
        raise ValueError("Expected eight glycan label boxes in the supplied figure")
    return sorted(boxes)


def align_glycan_examples(out_dir):
    """Match the eight label boxes and canvas; preserve every drawing path."""
    frames = []
    for i in range(1, 4):
        slug = f"glycan-types-{i}"
        path = out_dir / (slug + ".svg")
        root = ET.parse(path).getroot()
        width, height = map(float, root.attrib["viewBox"].split()[2:])
        frames.append((path, root, width, height, glycan_label_boxes(root)))
    ref = frames[0][4]
    transforms = []
    for _, _, _, _, boxes in frames:
        sx = (ref[-1][2] - ref[0][0]) / (boxes[-1][2] - boxes[0][0])
        sy = (ref[0][3] - ref[0][1]) / (boxes[0][3] - boxes[0][1])
        transforms.append((sx, sy, ref[0][0] - sx * boxes[0][0], ref[0][1] - sy * boxes[0][1]))
    width = max(w * sx + dx for (_, _, w, _, _), (sx, _, dx, _) in zip(frames, transforms))
    height = max(h * sy + dy for (_, _, _, h, _), (_, sy, _, dy) in zip(frames, transforms))
    canvas = [round(width, 6), round(height, 6)]
    ns = "http://www.w3.org/2000/svg"
    ET.register_namespace("", ns)
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    for (path, root, *_), (sx, sy, dx, dy) in zip(frames, transforms):
        group = ET.Element(f"{{{ns}}}g", {"transform": f"matrix({sx:.9f} 0 0 {sy:.9f} {dx:.9f} {dy:.9f})"})
        for child in list(root):
            if child.tag != f"{{{ns}}}defs":
                root.remove(child)
                group.append(child)
        root.append(group)
        root.set("viewBox", f"0 0 {canvas[0]} {canvas[1]}")
        root.set("width", f"{canvas[0]}pt")
        root.set("height", f"{canvas[1]}pt")
        ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
    return {"canvas": canvas, "transforms": [[round(v, 9) for v in transform] for transform in transforms]}


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
        "description": "Author-supplied Methods artwork; glycan examples share an aligned canvas. Master PDF supplies section order; DOCX supplies prose.",
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
        manifest["panels"].append({"source": name, "vector": svg.name, "preview": preview.name})
    manifest["glycan_alignment"] = align_glycan_examples(args.out_dir)
    for panel in manifest["panels"]:
        svg = args.out_dir / panel["vector"]
        preview = args.out_dir / panel["preview"]
        panel.update(preview_bytes=preview.stat().st_size, vector_sha256=sha256(svg), preview_sha256=sha256(preview))
    (args.out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
