"""Finish approved AI restorations: smooth alpha only, preserve RGB interiors.

User approved local mask refinement on 2026-11-05. Raw AI PNGs and original
WebPs stay untouched. This is an asset preparation script, not app runtime.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter1d, percentile_filter

ROOT = Path(__file__).resolve().parent

def restore_original_details(out, name):
    """Keep illegible source lettering instead of AI-invented replacement words."""
    source = Image.open(ROOT/'original-boards'/(name+'.webp')).convert('RGBA')
    skulls = {'mind-expander-2-0', 'storm-chaser', 'storm-chaser-split', 'storm-wolf', 'twincraft'}
    if name in skulls:
        def band_box(im):
            a = np.array(im)
            h, w = a.shape[:2]
            xa, xb, ya, yb = int(w*.24), int(w*.76), int(h*.75), int(h*.94)
            grey = cv2.cvtColor(a[ya:yb, xa:xb, :3], cv2.COLOR_RGB2GRAY)
            dark = (grey < 65) & (a[ya:yb, xa:xb, 3] > 128)
            # Fill the light letters before finding the band's full height.
            dark = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_CLOSE,
                                   np.ones((3, max(9, int(w*.07))), np.uint8)).astype(bool)
            scores = dark.sum(axis=1)
            peak = int(scores.argmax())
            top, bottom = peak, peak
            while top > 0 and scores[top-1] >= scores[peak]*.72:
                top -= 1
            while bottom+1 < len(scores) and scores[bottom+1] >= scores[peak]*.72:
                bottom += 1
            xs = np.flatnonzero(dark[top:bottom+1].sum(axis=0) > (bottom-top+1)*.6)
            return (xa+int(xs.min()), ya+top, xa+int(xs.max())+1, ya+bottom+1)
        sb, db = band_box(source), band_box(out)
        patch = source.crop(sb).resize((db[2]-db[0], db[3]-db[1]), Image.Resampling.LANCZOS)
        out.paste(patch, (db[0], db[1]))
    if name == 'youth-prodigy':
        # Original package copy is low resolution; retain it rather than fabricated text.
        src_box = source.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
        dst_box = out.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
        aligned = source.crop(src_box).resize((dst_box[2]-dst_box[0], dst_box[3]-dst_box[1]), Image.Resampling.LANCZOS)
        aw, ah = aligned.size
        box = (int(aw*.03), int(ah*.025), int(aw*.97), int(ah*.255))
        patch = aligned.crop(box)
        yy, xx = np.mgrid[:patch.height, :patch.width]
        edge = np.minimum.reduce([xx, yy, patch.width-1-xx, patch.height-1-yy])
        blend = Image.fromarray(np.uint8(np.clip(edge/18, 0, 1)*255))
        out.paste(patch, (dst_box[0]+box[0], dst_box[1]+box[1]), blend)
    return out

def refine(path):
    rgba = np.array(Image.open(path).convert('RGBA'))
    h, w = rgba.shape[:2]
    binary = (rgba[:, :, 3] >= 128).astype(np.uint8)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    contour = max(contours, key=cv2.contourArea)[:, 0, :].astype(float)
    # Uniform arc-length sampling keeps smoothing equal on straight and diagonal edges.
    closed = np.vstack([contour, contour[0]])
    dist = np.r_[0, np.cumsum(np.linalg.norm(np.diff(closed, axis=0), axis=1))]
    t = np.arange(0, dist[-1], 1.0)
    points = np.column_stack([np.interp(t, dist, closed[:, c]) for c in range(2)])
    points = gaussian_filter1d(points, 7, axis=0, mode='wrap')
    mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(mask, [np.rint(points).astype(np.int32)], 255)
    ys, xs = np.nonzero(mask)
    y0, y1 = int(ys.min()), int(ys.max())
    # Middle sidecuts are smooth; robust row envelopes reject attached matte blobs.
    rows = np.arange(y0, y1 + 1)
    left = np.array([np.flatnonzero(mask[y])[0] for y in rows], float)
    right = np.array([np.flatnonzero(mask[y])[-1] for y in rows], float)
    left_s = gaussian_filter1d(percentile_filter(left, 82, size=65), 20)
    right_s = gaussian_filter1d(percentile_filter(right, 18, size=65), 20)
    n = len(rows)
    fade = np.clip(np.minimum((np.arange(n) / n - .09) / .04,
                              (.91 - np.arange(n) / n) / .04), 0, 1)
    for i, y in enumerate(rows):
        l = int(round(left[i] * (1-fade[i]) + left_s[i] * fade[i]))
        r = int(round(right[i] * (1-fade[i]) + right_s[i] * fade[i]))
        mask[y, :l] = 0
        mask[y, r+1:] = 0
    # Inset a few source pixels to remove colored/white matte contamination.
    mask = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    contour = max(contours, key=cv2.contourArea)[:, 0, :].astype(float)
    contour = gaussian_filter1d(contour, 2, axis=0, mode='wrap')
    # Supersampled coverage produces smooth, narrow alpha instead of binary stairs.
    hi = np.zeros((h*3, w*3), np.uint8)
    cv2.fillPoly(hi, [np.rint(contour*3).astype(np.int32)], 255)
    alpha = np.array(Image.fromarray(hi).resize((w, h), Image.Resampling.LANCZOS))
    alpha[alpha < 3] = 0
    alpha[alpha > 252] = 255
    rgba[:, :, 3] = alpha
    rgba[alpha == 0, :3] = 0
    out = Image.fromarray(rgba)
    box = out.getchannel('A').getbbox()
    box = (max(0, box[0]-12), max(0, box[1]-12), min(w, box[2]+12), min(h, box[3]+12))
    out = out.crop(box)
    out = restore_original_details(out, path.stem)
    (ROOT/'boards-clean').mkdir(exist_ok=True)
    (ROOT/'boards-webp').mkdir(exist_ok=True)
    out.save(ROOT/'boards-clean'/path.name)
    out.save(ROOT/'boards-webp'/(path.stem+'.webp'), 'WEBP', quality=92, method=6, exact=True)
    return {'name':path.stem, 'size':out.size, 'alpha_levels':len(np.unique(np.array(out.getchannel('A')))),
            'png_bytes':(ROOT/'boards-clean'/path.name).stat().st_size,
            'webp_bytes':(ROOT/'boards-webp'/(path.stem+'.webp')).stat().st_size}

def sheet(paths, dst, bg=(16,22,29), height=520):
    cols=8
    cw=190
    ch=height+55
    image=Image.new('RGB',(cols*cw,((len(paths)+cols-1)//cols)*ch),bg)
    d=ImageDraw.Draw(image)
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',12)
    for i,p in enumerate(paths):
        im=Image.open(p).convert('RGBA')
        im.thumbnail((cw-20,height),Image.Resampling.LANCZOS)
        x=(i%cols)*cw+(cw-im.width)//2
        y=(i//cols)*ch
        image.paste(im,(x,y),im)
        name=p.stem.replace('womens-','W-').replace('mens-','M-')
        d.text(((i%cols)*cw+8,y+height+8),name,fill=(210,220,230),font=font)
    image.save(dst)

if __name__=='__main__':
    import sys
    paths=sorted((ROOT/'boards').glob('*.png'))
    if len(sys.argv)>1:
        paths=[p for p in paths if p.stem in sys.argv[1:]]
    results=[refine(p) for p in paths]
    report_path = ROOT/'board-refinement-report.json'
    previous = json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else []
    merged = {r['name']:r for r in previous}
    merged.update({r['name']:r for r in results})
    report_path.write_text(json.dumps(list(merged.values()),indent=2),encoding='utf-8')
    sheet(sorted((ROOT/'boards-clean').glob('*.png')),ROOT/'boards-contact-sheet.jpg')
    print(json.dumps({'processed':len(results),'min_height':min(r['size'][1] for r in results),
                      'webp_total_bytes':sum(r['webp_bytes'] for r in results)}))
