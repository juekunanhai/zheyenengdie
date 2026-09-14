"""P2 local reconstruction candidates using only existing formal-source pixels.

These are inferred repairs, not recovered originals. P1 candidates are preserved.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageOps, ImageFilter
from prepare_art import ROOT, SOURCE, clean, sha

OUT=ROOT/'art/edge-candidates'
rows=[]

def load(relative):
    return Image.open(ROOT/'art/candidates'/relative).convert('RGBA')

def save(id,group,im,source,method,notes,extra=None):
    im=im.crop(im.getbbox())
    pad=Image.new('RGBA',(im.width+16,im.height+16));pad.alpha_composite(im,(8,8))
    p=OUT/group/(id+'.png');p.parent.mkdir(parents=True,exist_ok=True);pad.save(p)
    row={'id':id,'group':group,'output':str(p.relative_to(ROOT)),'sha256':sha(p),'size':list(pad.size),
         'source':source,'source_sha256':sha(SOURCE/'02_ASSETS'/source),'method':method,'notes':notes,
         'status':'candidate_pending_user_review','runtime_review':'not_run',**(extra or {})}
    if group=='objects':
        n=OUT/'next'/('next_'+id.removeprefix('object_')+'.png');n.parent.mkdir(parents=True,exist_ok=True)
        silhouette=Image.new('RGBA',pad.size,(220,232,250,0));silhouette.putalpha(pad.getchannel('A'));silhouette.save(n)
        row.update(next_output=str(n.relative_to(ROOT)),next_sha256=sha(n))
    rows.append(row)
    return pad

def tapered_cap(im,flip=False):
    if flip:im=ImageOps.flip(im)
    im=im.crop(im.getbbox());a=np.array(im);h,w=a.shape[:2];mask=a[:,:,3]>128
    bounds=[]
    for y in range(h-15,h-1):
        xs=np.where(mask[y])[0]
        if len(xs):bounds.append((y,xs[0],xs[-1]))
    b=np.array(bounds);left=np.polyfit(b[:,0],b[:,1],1);right=np.polyfit(b[:,0],b[:,2],1)
    tip=(right[1]-left[1])/(left[0]-right[0]);ext=int(math.ceil(tip-h))+3
    if not 0<ext<65:raise ValueError(('unreliable linear cap',ext))
    out=Image.new('RGBA',(w,h+ext));out.alpha_composite(im)
    # Continue colour at the same source x. Only the missing cap receives pixels.
    aout=np.array(out)
    for y in range(h,h+ext):
        lo=max(0,int(round(np.polyval(left,y))));hi=min(w-1,int(round(np.polyval(right,y))))
        if lo>hi:continue
        for x in range(lo,hi+1):
            rgb=np.median(a[h-4:h,x,:3],axis=0)
            rim=min(x-lo,hi-x)
            if rim<2:rgb*=.85+.075*rim
            aout[y,x,:3]=rgb
            aout[y,x,3]=230 if rim==0 else 254
    out=Image.fromarray(aout)
    if flip:out=ImageOps.flip(out)
    return out,ext

for slug,flip in [('cardboard_box',False),('wooden_crate',False),('fridge',True)]:
    im,ext=tapered_cap(load('objects/object_'+slug+'.png'),flip)
    save('object_'+slug,'objects',im,'objects/object_'+slug+'.png','linear_edge_extrapolation',
         f'沿原轮廓两条直边求交，补齐约 {ext}px 缺角；仅新增区域使用边界同列颜色，不声称原始像素恢复。',{'added_extent_px':ext})

src=Image.open(SOURCE/'02_ASSETS/objects/object_wood_plank.png').convert('RGBA')
im=clean(src.crop((0,60,330,357)),5).rotate(-34,resample=Image.Resampling.BICUBIC,expand=True)
im=im.crop(im.getbbox());a=np.array(im);cap=70
mirror=np.array(ImageOps.mirror(im.crop((im.width-cap,0,im.width,im.height))))
a[:,:cap-12]=mirror[:,:cap-12]
for x in range(cap-12,cap):
    t=(x-(cap-12))/12;a[:,x]=(mirror[:,x]*(1-t)+a[:,x]*t).astype('uint8')
save('object_wood_plank','objects',Image.fromarray(a),'objects/object_wood_plank.png','rotate_and_mirror_intact_end',
     '先取完整可见木板到 y=357（修正 P1 裁切过短），旋转 -34° 校直，再用完整右端翻转补左端；接缝做 12px 混合。',{'art_rotation_deg':-34,'cap_width_px':70})

def mirror_missing_side(im,axis,side,pad=40,replace_until=None):
    a=np.array(im);h,w=a.shape[:2];out=np.zeros((h,w+pad,4),np.uint8)
    start=pad if side=='left' else 0;out[:,start:start+w]=a
    limit=replace_until if replace_until is not None else (4 if side=='left' else w-4)
    for x in range(-pad,limit) if side=='left' else range(limit,w+pad):
        rx=int(round(2*axis-x))
        if 0<=rx<w:
            target=x+start
            out[:,target]=a[:,rx]
    return Image.fromarray(out)

for slug,axis in [('mid',140),('narrow',79)]:
    im=mirror_missing_side(load('claw/claw_open_'+slug+'.png'),axis,'left',44,int(axis)-9)
    save('claw_open_'+slug,'claw',im,'claw/claw_open_'+slug+'.png','mirror_missing_left_rim',
         '为避免只贴边造成双爪接缝，将该爪态左侧缺失部分所在半爪改用完整右半爪镜像；主体星标与右半部保留。属于推断补齐，挂点待确认。',{'symmetry_axis_x':axis})
im=mirror_missing_side(load('hud/hud_rotate_90.png'),209,'right',52,335)
save('hud_rotate_90','hud',im,'hud/hud_rotate_90.png','mirror_missing_right_rim',
     '用原按钮完整左侧补右底座外缘；文字、中心圆盘不重画。',{'symmetry_axis_x':209})

# Recover a text-free, scalable panel from the intact upper-left corner/border.
panel_src=Image.open(SOURCE/'02_ASSETS/ui/panel_9slice_light.png').convert('RGBA')
quarter=panel_src.crop((0,20,60,80))
def panel(w,h):
    a=np.array(quarter);out=np.zeros((h,w,4),np.uint8)
    for y in range(h):
        sy=min(y,h-1-y,59)
        for x in range(w):
            sx=min(x,w-1-x,59);out[y,x]=a[sy,sx]
    # Alpha is geometric because the supplied crop contains board background.
    m=Image.new('L',(w*3,h*3));d=ImageDraw.Draw(m);d.rounded_rectangle((3,3,(w-1)*3,(h-1)*3),radius=21*3,fill=255)
    # Original colour still exists in the transparent interior. Restore its
    # opacity within the panel, rather than inheriting the bad source alpha.
    out[:,:,3]=np.array(m.resize((w,h),Image.Resampling.LANCZOS))
    return Image.fromarray(out)
save('panel_9slice_light','ui',panel(320,260),'ui/panel_9slice_light.png','extend_intact_corner_and_border',
     '从原左上 60×60 边框/颜色镜像延展，恢复内部被误清空的 Alpha；缺失下半部为推断补齐，非原图恢复。',{'slice_insets_px':[68,68,68,68]})
save('toast_bubble_plain','ui',panel(320,90),'ui/panel_9slice_light.png','reuse_reconstructed_panel_family',
     '用已补齐的同款边框形成无烤死文案 Toast 底板；动态文案由 Label 放入。',{'slice_insets_px':[30,68,30,68]})

# A blank button for genuinely missing settings entries. Existing result button
# is untouched. The blank is a derived component with a row-wise source fill.
button=Image.open(SOURCE/'02_ASSETS/result_ui/result_btn_share.png').convert('RGBA')
b=np.array(button);fill=np.array(button)
c1=b[62,356,:3].astype(float);c2=b[112,356,:3].astype(float)
for y in range(25,126):
    fill[y,:, :3]=np.clip(c1+(c2-c1)*(y-62)/50,0,255)
mask=Image.new('L',button.size);ImageDraw.Draw(mask).rounded_rectangle((27,26,435,126),radius=28,fill=255)
inside=np.asarray(mask)>0;b[inside,:3]=fill[inside,:3]
blank=Image.fromarray(b)
# Reconstruct only the missing gloss stroke in the same original trajectory.
d=ImageDraw.Draw(blank)
points=[]
for t in np.linspace(0,1,100):
    x=(1-t)**2*28+2*(1-t)*t*120+t*t*424
    y=(1-t)**2*59+2*(1-t)*t*2+t*t*51
    points.append((x,y))
d.line(points,fill=(238,252,255,255),width=2)
save('btn_settings_base','ui',blank,'result_ui/result_btn_share.png','derive_blank_from_existing_blue_button',
     '为缺失的设置入口复用正式蓝按钮边框/填充；清除分享图标与文字，重接同款高光。运行时显示“设置”，原分享按钮保留。',{'slice_insets_px':[36,48,36,48]})

# Necessary missing toggle components: reuse the blank blue button skin and
# panel palette, with a separately drawn complete bevelled knob, not an emoji.
def toggle(on):
    track=blank.resize((176,64),Image.Resampling.LANCZOS)
    if not on:
        rgb=ImageOps.grayscale(track).convert('RGB');arr=np.array(rgb).astype(float)
        arr[:,:,0]*=.91;arr[:,:,1]*=.98;arr[:,:,2]=np.minimum(arr[:,:,2]*1.06,255)
        gray=Image.fromarray(arr.astype('uint8')).convert('RGBA');gray.putalpha(track.getchannel('A'));track=gray
    out=Image.new('RGBA',(180,70));out.alpha_composite(track,(2,3))
    scale=3;knob=Image.new('RGBA',(56*scale,56*scale));d=ImageDraw.Draw(knob)
    d.ellipse((3*scale,5*scale,53*scale,55*scale),fill=(32,69,123,70))
    d.ellipse((3*scale,2*scale,53*scale,52*scale),fill=(130,187,232,255))
    d.ellipse((5*scale,3*scale,51*scale,49*scale),fill=(237,247,255,255))
    d.arc((10*scale,7*scale,46*scale,42*scale),200,292,fill=(255,255,255,255),width=3*scale)
    out.alpha_composite(knob.resize((56,56),Image.Resampling.LANCZOS),(119 if on else 5,5))
    return out
for on in [True,False]:
    save('toggle_'+('on' if on else 'off'),'ui',toggle(on),'result_ui/result_btn_share.png','new_missing_control_from_formal_skin',
         '现有开关主体缺失，复用正式蓝按钮配色/边框制作完整开关候选；圆钮为同色板本地绘制，非占位。开/关文案由运行时 Label 辅助。')

approval_path=ROOT/'art/USER_VISUAL_APPROVAL.json'
approval=json.loads(approval_path.read_text())['approved_outputs'] if approval_path.exists() else {}
for row in rows:
    if approval.get(row['id'],{}).get('sha256')==row['sha256']:
        row['status']='user_visual_accepted_pending_runtime'
manifest={'revision':'2026-09-12-P2','source_root':str(SOURCE),'script_sha256':sha(Path(__file__)),
          'authority':'Local repairs authorized; per-output visual approval is recorded in USER_VISUAL_APPROVAL.json; engine validation pending.', 'entries':rows}
(ROOT/'art/EDGE_CANDIDATE_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
for start in range(0,len(rows),8):
    batch=rows[start:start+8];sheet=Image.new('RGB',(1200,310*((len(batch)+3)//4)),'#d1e3ef');draw=ImageDraw.Draw(sheet)
    for i,r in enumerate(batch):
        im=Image.open(ROOT/r['output']);im.thumbnail((276,260));x=(i%4)*300;y=(i//4)*310
        sheet.paste(im,(x+(300-im.width)//2,y+5),im);draw.text((x+10,y+275),r['id'],fill='#173047')
    sheet.save(ROOT/f'review/edge-candidates-{start//8+1}.jpg',quality=96)
print(json.dumps({'edge_candidates':len(rows),'next':sum('next_output' in r for r in rows)}))
