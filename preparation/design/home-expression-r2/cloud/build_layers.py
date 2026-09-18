from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,json,hashlib,shutil
D=Path(__file__).resolve().parent;ROOT=D.parents[3]
src_path=ROOT/'assets/batch0/art/home_r10_background.png';cloud_path=ROOT/'assets/batch0/art/home_r9_cloud.png'
src=Image.open(src_path).convert('RGB'); original=np.array(src).astype(float); W,H=src.size; SH=426
sky=Image.open(D/'generated-clear-sky.png').convert('RGB').resize((W,SH),Image.Resampling.LANCZOS);donor=np.array(sky).astype(float)
y,x=np.mgrid[0:SH,0:W];xn=x/W;yn=y/SH;F=np.stack([np.ones_like(xn),xn,yn,xn*xn,xn*yn,yn*yn],-1);a=original[:SH]
blue=(a[:,:,2]-a[:,:,0]>105)&(a[:,:,2]-a[:,:,1]>30)&~((x<110)&(y>315))&~((x>870)&(y>390));keep=blue.copy()
for _ in range(5):
 C=np.linalg.lstsq(F[keep][::3],(a-donor)[keep][::3],rcond=None)[0];match=np.clip(donor+F@C,0,255);residual=a[:,:,0]-match[:,:,0];keep=blue&(residual<8)&(residual>-15)
# One continuous sky donor: no per-cloud polygon patches / hard inpainting borders.
# Match the last original sky row progressively across the lower 85 pixels.
# Only clear sky is used in this boundary donor, never roof pixels.
line=a[-1].copy();line[:76]=line[76];line[884:]=line[879]
line_img=Image.fromarray(np.uint8(line)[None,:,:]).resize((W,17)).filter(ImageFilter.GaussianBlur(16))
boundary=np.array(line_img)[8].astype(float);delta=boundary-match[-1]
u=np.clip((y-341)/84,0,1);smooth=u*u*(3-2*u)
match=np.clip(match+delta[None,:,:]*smooth[:,:,None],0,255)
# Original foreground pixels at the two skyline intrusions into this sky band.
# 3x antialiased polygon trace follows actual visible roof / balloon contour.
fgmask=Image.new('L',(W*3,SH*3));draw=ImageDraw.Draw(fgmask)
polygons=[[(0,346),(13,343),(33,339),(48,332),(56,335),(62,341),(67,348),(67,426),(0,426)],[(884,426),(884,421),(888,417),(892,414),(898,411),(902,412),(907,412),(912,416),(915,420),(917,426)],[(929,426),(934,425),(941,425),(941,426)]]
for p in polygons:draw.polygon([(round(xx*3),round(yy*3)) for xx,yy in p],fill=255)
fgmask=fgmask.resize((W,SH),Image.Resampling.LANCZOS);fm=np.array(fgmask)/255
base=original.copy();base[:SH]=match*(1-fm[:,:,None])+a*fm[:,:,None];base=np.uint8(np.clip(np.round(base),0,255));Image.fromarray(base).save(D/'background-no-near-clouds.png')
# The alpha clip is precisely the inverse near-skyline foreground; top 426 only.
allowed=np.zeros((H,W,4),dtype='uint8');allowed[:SH,:,:3]=255;allowed[:SH,:,3]=np.uint8(255-np.array(fgmask))
Image.fromarray(allowed,'RGBA').save(D/'moving-sky-mask.png')
# Foreground is redundant with sky clip but provided for conventional layer composition.
fg=np.zeros((H,W,4),dtype='uint8');fg[:,:,:3]=np.uint8(original);fg[:SH,:,3]=np.array(fgmask);fg[SH:,:,3]=255
Image.fromarray(fg,'RGBA').save(D/'city-foreground.png')
# A complete approved original sprite: no clipped-off edge clouds, no RGB unmixing.
shutil.copyfile(cloud_path,D/'moving-cloud.png')
cloud=Image.open(D/'moving-cloud.png').convert('RGBA');ratio=cloud.height/cloud.width
layers=[{'id':'near_left','file':'moving-cloud.png','rect':[-128,62,430,round(430*ratio)],'opacity':.82,'speed':12}, {'id':'near_right','file':'moving-cloud.png','rect':[698,198,405,round(405*ratio)],'opacity':.84,'speed':10}, {'id':'far_middle','file':'moving-cloud.png','rect':[600,119,178,round(178*ratio)],'opacity':.36,'speed':5.5}, {'id':'middle_left','file':'moving-cloud.png','rect':[107,299,255,round(255*ratio)],'opacity':.58,'speed':8}]
def composite(t):
 back=Image.fromarray(base).convert('RGBA');cl=Image.new('RGBA',(W,H))
 for z in layers:
  px,py,ww,hh=z['rect'];q=cloud.resize((ww,hh),Image.Resampling.LANCZOS);q.putalpha(q.getchannel('A').point(lambda v:round(v*z['opacity'])))
  cl.alpha_composite(q,(round(px+t*z['speed']),py))
 aa=np.array(cl);aa[:,:,3]=np.uint8(aa[:,:,3].astype(float)*allowed[:,:,3]/255);back.alpha_composite(Image.fromarray(aa));return back
recon=composite(0);recon.save(D/'recombined-original-position.png');shift=composite(12);shift.save(D/'shifted-position-check.png')
thumbs=[im.convert('RGB').resize((375,667),Image.Resampling.LANCZOS) for im in [src,Image.fromarray(base),recon,shift]];sheet=Image.new('RGB',(1500,667),'white')
for i,im in enumerate(thumbs):sheet.paste(im,(375*i,0))
sheet.save(D/'comparison.png')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'version':'near-sky-clouds-r2-complete-official-sprite','source':{'file':'../../../../assets/batch0/art/home_r10_background.png','sha256':sha(src_path),'width':W,'height':H},'cloudSource':{'file':'../../../../assets/batch0/art/home_r9_cloud.png','sha256':sha(cloud_path),'method':'exact file copy, full complete alpha sprite'},'background':{'file':'background-no-near-clouds.png','width':W,'height':H},'mask':{'file':'moving-sky-mask.png','rect':[0,0,W,H],'use':'Draw all near clouds into transparent layer; destination-in this alpha mask; composite on background. White/RGB unimportant; use alpha.'},'foreground':{'file':'city-foreground.png','rect':[0,0,W,H],'use':'Optional full original city layer, draw AFTER moving clouds. Alternative to mask.'},'layers':layers,'recommendation':'All rects / speeds in original 941x1672 pixels. Draw background then cloud canvas masked by moving-sky-mask. Drift in same direction, unequal speeds; wrap only when fully offscreen. No vertical bob. No whole-background translation.','scope':'Upper four cloud groups replaced with complete officially approved cloud sprite. Low-altitude distant cloud / haze below y426 remains original, intentionally static far layer.','generator':'built-in image_gen clear sky donor only; no generated city/cloud sprite','files':{n:sha(D/n) for n in ['background-no-near-clouds.png','moving-sky-mask.png','city-foreground.png','moving-cloud.png','generated-clear-sky.png']}}
(D/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
checks={'sourceSha256':sha(src_path),'cloudIsExactApprovedSource':sha(cloud_path)==sha(D/'moving-cloud.png'),'allPixelsAtOrBelow426Unchanged':bool(np.array_equal(base[SH:],np.uint8(original[SH:]))),'preservedPixelsAtOrBelow426':int(W*(H-SH)),'opaqueCityPixelsInsideUpperBandUnchanged':bool(np.array_equal(base[:SH][fm==1],np.uint8(a)[fm==1])),'foregroundRgbAlwaysOriginal':bool(np.array_equal(fg[:,:,:3],np.uint8(original))),'noMovingMaskAlphaBelow426':bool(np.max(allowed[SH:,:,3])==0),'cloudLayerCount':len(layers),'note':'Original complete cloud sprite replaces edge-truncated source clouds. No cutout matte or hard patch polygon is used in final manifest.'}
(D/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2));print(json.dumps({'layers':layers,'checks':checks},ensure_ascii=False))
# Motion-offset inspection: same background / masking at 0, 6, 12, 24 seconds.
contact=Image.new('RGB',(1500,230),'white')
for i,t in enumerate([0,6,12,24]):
 im=composite(t);im.save(D/f'offset-{t:02d}s.png')
 im=im.convert('RGB').resize((375,667),Image.Resampling.LANCZOS).crop((0,0,375,230));contact.paste(im,(375*i,0))
contact.save(D/'motion-offsets.png')
