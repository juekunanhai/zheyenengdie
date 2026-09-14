from PIL import Image
import numpy as np
from pathlib import Path
r=Path(__file__).resolve().parent
for name in ['cardboard_box','fridge','wood_plank']:
 im=Image.open(r/'generated'/f'{name}.png').convert('RGBA');a=np.array(im)[:,:,3]>=128
 ys,xs=np.where(a); x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max();print('\n',name,(x0,x1,y0,y1))
 for x in np.linspace(x0,x1,31).round().astype(int):
  yy=np.where(a[:,x])[0];print('col',x,yy.min(),yy.max(),end='; ')
 print()
 for y in sorted(set([y0,y0+1,y0+2,y0+3,y0+5,y0+8,y0+12,y0+20,y0+30,y1-30,y1-20,y1-12,y1-8,y1-5,y1-3,y1-2,y1-1,y1])):
  xx=np.where(a[y])[0];print('row',y,xx.min(),xx.max(),end='; ')
 print()
