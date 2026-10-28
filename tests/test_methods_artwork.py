"""Regression checks for the shifting glycan type labels."""
import importlib.util
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('methods_assets', ROOT / 'scripts/build_methods_assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class GlycanFramesTests(unittest.TestCase):
    def test_frames_share_canvas_and_label_coordinates(self):
        reference_canvas = None
        reference_boxes = None
        for i in range(1, 4):
            root = ET.parse(ROOT / f'assets/methods/glycan-types-{i}.svg').getroot()
            canvas = root.attrib['viewBox']
            if reference_canvas is None:
                reference_canvas = canvas
            self.assertEqual(canvas, reference_canvas)
            transform = root[-1].attrib['transform']
            sx, _, _, sy, dx, dy = map(float, transform.removeprefix('matrix(').removesuffix(')').split())
            boxes = [(sx*x0+dx, sy*y0+dy, sx*x1+dx, sy*y1+dy)
                     for x0, y0, x1, y1 in assets.glycan_label_boxes(root)]
            if reference_boxes is None:
                reference_boxes = boxes
            for actual, expected in zip(boxes, reference_boxes):
                for value, target in zip(actual, expected):
                    self.assertAlmostEqual(value, target, delta=0.01)


if __name__ == '__main__':
    unittest.main()
