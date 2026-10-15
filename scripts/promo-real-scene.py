frames=ROOT/'.visual-review/promo-live-frames'
def shot(n): return Image.open(frames/f'{max(0,min(224,int(n))):04}.jpg').convert('RGB')

def project(image,quad):
    iw,ih=image.size
    src=[(0,0),(iw,0),(iw,ih),(0,ih)]
    a=[]; b=[]
    for (xx,yy),(u,v) in zip(quad,src):
        a.extend([[xx,yy,1,0,0,0,-u*xx,-u*yy],[0,0,0,xx,yy,1,-v*xx,-v*yy]])
        b.extend([u,v])
    co=np.linalg.solve(np.array(a),np.array(b))
    return image.convert('RGBA').transform((W,H),Image.Transform.PERSPECTIVE,co,Image.Resampling.BICUBIC)

def scene(index,local):
    t=index*2+local
    canvas=background.copy().convert('RGBA')
    d=ImageDraw.Draw(canvas)
    for i in range(5):
        xx=int((t*110+i*500)%2900)-450
        d.line((xx,1080,xx+600,0),fill=(17,35,61),width=2)
    if t<6.8:
        segments=[(0,.6,0,23,'WELCOME'),(.6,1.3,24,50,'CONNECT YOUR LIBRARIES'),(1.3,3,51,92,'FIND YOUR NEXT GAME'),(3,4,94,122,'YOUR LIBRARY'),(4,5.5,123,166,'OPEN A GAME'),(5.5,6.8,167,193,'PRESS PLAY')]
        s=next(s for s in segments if s[0]<=t<s[1])
        prog=(t-s[0])/(s[1]-s[0]); im=shot(s[2]+(s[3]-s[2])*prog)
        # One continuous camera: tilted glass panel -> full-screen app -> handheld display.
        intro=ease(t/.65)
        full=ease((t-4.7)/.8)
        width=(1620+100*math.sin(t*.65))* (1-full)+1920*full
        height=width*9/16
        left=(W-width)/2; top=(H-height)/2
        tilt=(26*math.sin(t*1.1)+70*(1-intro))*(1-full)
        quad=[(left+tilt,top+25*(1-full)),(left+width-tilt,top-15*(1-full)),(left+width+tilt,top+height),(left-tilt,top+height-20*(1-full))]
        shadow=Image.new('RGBA',(W,H)); sd=ImageDraw.Draw(shadow)
        sd.polygon([(x,y+14) for x,y in quad],fill=(10,105,220,100))
        canvas=Image.alpha_composite(canvas,shadow.filter(ImageFilter.GaussianBlur(24)))
        canvas=Image.alpha_composite(canvas,project(im,quad))
        d=ImageDraw.Draw(canvas)
        if full<.1:
            d.text((100,1000),s[4],font=font(23),fill='#9bcbff')
            d.text((1635,1000),'BETA 25',font=font(23),fill='#9bcbff')
        # Short light sweep at the click into the game launch.
        if 5.5<t<5.68:
            overlay=Image.new('RGBA',(W,H),(150,210,255,int(30*(1-(t-5.5)/.18))))
            canvas=Image.alpha_composite(canvas,overlay)
    elif t<8.5:
        p=ease((t-6.8)/1.0)
        device=assets[3].copy().convert('RGBA')
        # Replace the mockup's static screen with the captured app launch animation.
        screen=shot(176+min(15,int((t-6.8)*10))).resize((973,531),Image.Resampling.LANCZOS).convert('RGBA')
        mask=Image.new('L',screen.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,972,530),radius=10,fill=255)
        screen.putalpha(mask);device.alpha_composite(screen,(347,185))
        # At p=0 the screen exactly fills the output; hardware emerges around it.
        width=3300*(1-p)+1640*p
        height=width*device.height/device.width
        cx=960; cy=(540-(450.5-device.height/2)*width/device.width)*(1-p)+570*p
        layer=device.resize((int(width),int(height)),Image.Resampling.BICUBIC)
        canvas.alpha_composite(layer,(int(cx-width/2),int(cy-height/2)))
        if p>.9:
            d=ImageDraw.Draw(canvas)
            d.text((100,75),'Xbox Preview UI',font=font(62),fill='white')
            d.text((104,155),'Your PC. Controller ready.',font=regular(29),fill='#b8d6fa')
        if t>8.2:
            canvas=Image.blend(canvas,background.convert('RGBA'),ease((t-8.2)/.3))
    else:
        p=ease((t-8.5)/.45)
        logo=icon.resize((150,150),Image.Resampling.LANCZOS)
        canvas.alpha_composite(logo,(885,205+int(35*(1-p))))
        d=ImageDraw.Draw(canvas)
        for text,yy,ff,col in [('Xbox Preview UI',405,font(94),'white'),('A full-screen launcher for Windows',535,regular(36),'#bbcee7'),('DOWNLOAD BETA 25',665,font(30),'#85c2ff'),('github.com/ykyritsis/xbox-cloud-preview-on-pc',755,regular(29),'#dce7f6')]:
            bb=d.textbbox((0,0),text,font=ff)
            d.text(((W-bb[2])/2,yy+int(35*(1-p))),text,font=ff,fill=col)
    return canvas.convert('RGB')
