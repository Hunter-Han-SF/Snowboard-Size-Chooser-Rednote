"""Measure and validate the complete pack; export backgrounds and QA previews."""
from pathlib import Path
import json
import hashlib
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from refine_assets import sheet

ROOT=Path(__file__).resolve().parent
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def measure(path):
    im=Image.open(path)
    im.load()
    return {'file':path.relative_to(ROOT).as_posix(),'width':im.width,'height':im.height,
            'mode':im.mode,'bytes':path.stat().st_size,'sha256':sha(path)}

names={p.stem for p in (ROOT/'original-boards').glob('*.webp')}
assert len(names)==46
for folder,ext in [('boards','.png'),('boards-clean','.png'),('boards-webp','.webp')]:
    assert {p.stem for p in (ROOT/folder).glob('*'+ext)}==names, folder
boards=[]
for name in sorted(names):
    png=ROOT/'boards-clean'/(name+'.png')
    webp=ROOT/'boards-webp'/(name+'.webp')
    a=np.array(Image.open(png).getchannel('A'))
    assert a.min()==0 and a.max()==255, name
    assert len(np.unique(a))>30, name
    assert Image.open(png).height>=2100, name
    n,_,_,_=cv2.connectedComponentsWithStats((a>=128).astype(np.uint8),8)
    assert n==2, (name,'disconnected opaque fragments',n)
    assert np.array_equal(a,np.array(Image.open(webp).getchannel('A'))), name
    assert not (a[0].any() or a[-1].any() or a[:,0].any() or a[:,-1].any()), name
    mask=(a>=128).astype(np.uint8)
    contours,hierarchy=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
    holes=sum(1 for row in hierarchy[0] if row[3]>=0)
    assert holes==0,(name,'unintended transparent holes',holes)
    boards.append({'name':name,'original':measure(ROOT/'original-boards'/(name+'.webp')),
                   'ai_master':measure(ROOT/'boards'/(name+'.png')),
                   'png':measure(png),'webp':measure(webp),
                   'alpha_levels':len(np.unique(a)),'opaque_components':n-1,'holes':holes})

backgrounds=[]
for p in sorted((ROOT/'backgrounds').glob('*.png')):
    Image.open(p).convert('RGB').save(p.with_suffix('.webp'),'WEBP',quality=90,method=6)
    backgrounds.append({'png':measure(p),'webp':measure(p.with_suffix('.webp'))})
assert len(backgrounds)==6

font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
preview=Image.new('RGB',(1440,1200),(8,12,17))
d=ImageDraw.Draw(preview)
for i,(color,wide,tall) in enumerate([
    ('BLUE','blue-glacier-wide','blue-ice-portal-portrait'),
    ('RED','red-storm-wide','red-eclipse-ridge-portrait'),
    ('GREEN','green-aurora-wide','green-aurora-couloir-portrait')]):
    d.text((i*480+12,12),color+' / WIDE + PORTRAIT',font=font,fill='white')
    preview.paste(Image.open(ROOT/'backgrounds'/(wide+'.png')).resize((472,266),Image.Resampling.LANCZOS),(i*480+4,50))
    preview.paste(Image.open(ROOT/'backgrounds'/(tall+'.png')).resize((472,839),Image.Resampling.LANCZOS),(i*480+4,331))
preview.save(ROOT/'backgrounds-preview.jpg',quality=93)

paths=sorted((ROOT/'boards-clean').glob('*.png'))
sheet(paths,ROOT/'boards-contact-sheet.jpg')
for start in range(0,len(paths),16):
    sheet(paths[start:start+16],ROOT/f'boards-preview-{start//16+1}.jpg')

samples=['freecarver-6000s','mens-flagship','mens-howler','storm-chaser','womens-rally-cat','womens-twin-sister']
comparison=Image.new('RGB',(1200,1500),(16,22,29))
d=ImageDraw.Draw(comparison)
for i,name in enumerate(samples):
    x=(i%3)*400
    y=(i//3)*750
    d.text((x+10,y+8),name,font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16),fill='white')
    for j,(folder,ext,label) in enumerate([('original-boards','.webp','ORIGINAL'),('boards-clean','.png','ENHANCED')]):
        im=Image.open(ROOT/folder/(name+ext)).convert('RGBA')
        im.thumbnail((180,680),Image.Resampling.LANCZOS)
        comparison.paste(im,(x+j*200+(200-im.width)//2,y+40),im)
        d.text((x+j*200+30,y+720),label,font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16),fill=(210,220,230))
comparison.save(ROOT/'before-after.jpg',quality=95)

manifest={'started':'2026-11-05','finished':'2026-11-06','timezone':'Asia/Shanghai',
          'generation':'built-in image_gen.imagegen; exact model version not exposed',
          'local_refinement':'User-authorized alpha smoothing, 3x coverage antialiasing, matte cleanup, original lettering restoration',
          'count':{'boards':len(boards),'backgrounds':len(backgrounds)},'boards':boards,'backgrounds':backgrounds,
          'note':'AI restoration can reconstruct small artwork details. Original assets and AI masters are retained. Source text is retained where AI invented labels.'}
(ROOT/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'board-refinement-report.json').write_text(json.dumps([{'name':b['name'],'size':[b['png']['width'],b['png']['height']],
    'alpha_levels':b['alpha_levels'],'opaque_components':b['opaque_components'],'holes':b['holes'],
    'png_bytes':b['png']['bytes'],'webp_bytes':b['webp']['bytes']} for b in boards],indent=2),encoding='utf-8')
print(json.dumps({'validated_boards':len(boards),'validated_backgrounds':len(backgrounds),
    'height_range':[min(b['png']['height'] for b in boards),max(b['png']['height'] for b in boards)],
    'board_webp_bytes':sum(b['webp']['bytes'] for b in boards),
    'background_webp_bytes':sum(b['webp']['bytes'] for b in backgrounds)}))
