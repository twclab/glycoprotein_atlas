#!/usr/bin/env python3
"""Build schematic Methods diagrams from manuscript v8's permutation definition."""
from pathlib import Path
import argparse

INK = '#122d2a'
TEAL = '#087f78'
MUTED = '#46635f'
GRAY = '#c7cfcb'
COLORS = ['#5A8C54', '#CD4D2C', '#4168B9', '#A34599']


def svg(title, height, content):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 {height}" width="960" height="{height}" role="img" aria-label="{title}">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="{MUTED}"/></marker></defs>
<style>text{{font-family:Arial,sans-serif;fill:{INK};font-size:18px}}.title{{font-size:22px;font-weight:600}}.small{{font-size:16px;fill:{MUTED}}}</style>
<rect width="960" height="{height}" fill="white"/>{content}</svg>'''


def text(x, y, value, css='', anchor='start'):
    return f'<text x="{x}" y="{y}" class="{css}" text-anchor="{anchor}">{value}</text>'


def arrow(x1, y1, x2):
    return f'<path d="M{x1} {y1}H{x2}" fill="none" stroke="{MUTED}" stroke-width="2" marker-end="url(#arrow)"/>'


def animal(x, y, label, widths):
    result = text(x, y, label, 'small')
    offset = 0
    for color, fraction in zip(COLORS, widths):
        result += f'<rect x="{x+offset}" y="{y+9}" width="{78*fraction}" height="14" fill="{color}"/>'
        offset += 78*fraction
    return result


def group(x, y, title, animals):
    result = f'<rect x="{x}" y="{y}" width="270" height="86" rx="7" fill="#eef8f5" stroke="{GRAY}"/>'
    result += text(x+12,y+25,title)
    for i,(label,values) in enumerate(animals):
        result += animal(x+12+i*100,y+50,label,values)
    result += text(x+235,y+66,'…')
    return result


def permutation():
    a=('p₁',[.7,.1,.1,.1]);b=('p₂',[.6,.2,.1,.1]);c=('p₃',[.25]*4);d=('p₄',[.3,.2,.25,.25])
    result = text(20,30,'Animal-label permutation','title')
    result += group(20,55,'Young · nY animals',[a,b])
    result += group(20,150,'Old · nO animals',[c,d])
    result += arrow(305,145,365)
    result += text(335,105,'Shuffle','small','middle')
    result += text(335,126,'labels','small','middle')
    result += group(385,55,'Young · nY animals',[a,d])
    result += group(385,150,'Old · nO animals',[b,c])
    result += arrow(670,145,725)
    result += text(750,105,'Recalculate')+text(750,132,'group means')+text(750,175,'Recalculate TVD')
    result += text(20,273,'Keep each animal’s composition unchanged. Keep the detected group sizes fixed.','small')
    return svg('Animal-label permutation: retain measured animal compositions, shuffle group labels with fixed group sizes, and recalculate the group means and TVD.',300,result)


def pvalue():
    result = text(20,30,'Permutation p value','title')
    result += text(20,59,'Compare the observed TVD with the TVDs from shuffled labels.','small')
    heights=[12,25,43,62,86,113,139,157,165,156,144,125,100,79,60,42,28,19,13,8,5,3]
    for i,height in enumerate(heights):
        x=65+i*19
        result += f'<rect x="{x}" y="{250-height}" width="16" height="{height}" fill="{TEAL if i>=17 else GRAY}"/>'
    result += f'<path d="M55 78V250H495" fill="none" stroke="{MUTED}" stroke-width="1.5"/>'
    result += f'<path d="M386 78V255" fill="none" stroke="{TEAL}" stroke-width="2" stroke-dasharray="5 4"/>'
    result += text(386,77,'Observed TVD','small','middle')
    result += text(275,279,'TVD','small','middle')
    result += '<text transform="translate(24 165) rotate(-90)" class="small" text-anchor="middle">Permutations</text>'
    result += text(540,117,'k = permuted TVDs ≥ observed TVD')
    result += text(540,151,'B = number of permutations')
    result += text(540,199,'p = (k + 1) / (B + 1)','title')
    result += text(540,245,'Atlas: B = 99,999,999','small')
    result += text(540,273,'Myelin: B = 9,999','small')
    result += text(65,311,'Schematic distribution; shaded bars contribute to k.','small')
    return svg('Schematic permutation distribution. Count permuted TVDs greater than or equal to observed TVD. The raw p value is (k+1)/(B+1). Atlas uses 99,999,999 permutations and myelin uses 9,999.',335,result)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out-dir',type=Path,default=Path(__file__).resolve().parents[1]/'assets/methods')
    args=parser.parse_args();args.out_dir.mkdir(parents=True,exist_ok=True)
    for name, content in [('tvd-permutation.svg',permutation()),('tvd-pvalue.svg',pvalue())]:
        (args.out_dir/name).write_text(content+'\n')


if __name__=='__main__':
    main()
