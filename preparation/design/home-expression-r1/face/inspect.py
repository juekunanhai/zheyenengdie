from PIL import Image,ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parent
art=root.parents[3]/'assets/batch0/art'
a=Image.open(art/'home_r9_hero.png').convert('RGB')
b=Image.open(root/'generated-hero.png')
rects=[(330,65,508,167),(275,1040,440,1265),(422,426,662,555)]
out=Image.new('RGB',(1050,1300),'#cccccc');d=ImageDraw.Draw(out)
y=0
for i,r in enumerate(rects):
 for j,im in enumerate([a,b]):
  crop=im.crop(r);crop=crop.resize((crop.width*2,crop.height*2))
  out.paste(crop,(j*500,y+20));d.text((j*500,y),f'{i} '+['original','generated'][j],fill='black')
 y+=max((r[3]-r[1])*2+30,0)
out.crop((0,0,1000,y)).save(root/'hero-comparison.png')
a=Image.open(art/'home_r9_slipper.png').convert('RGB');b=Image.open(root/'generated-slipper.png').resize(a.size,Image.Resampling.LANCZOS)
b.save(root/'slipper-generated-normalized.png')
out=Image.new('RGB',(1360,534),'#cccccc');out.paste(a.resize((680,514)),(0,20));out.paste(b.resize((680,514)),(680,20));ImageDraw.Draw(out).text((0,0),'original                                       generated normalized',fill='black');out.save(root/'slipper-comparison.png')
