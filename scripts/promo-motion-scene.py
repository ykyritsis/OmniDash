# Motion-design scene loaded by promo-video-motion.py. All motion is frame-rendered.
tiles=[Image.open(ROOT / f'.visual-review/promo-v2/art/{i}-tile.jpg').convert('RGB') for i in range(10)]
hero=Image.open(ROOT / '.visual-review/promo-v2/art/0-hero.jpg').convert('RGB')

def place(canvas, img, cx, cy, width, angle=0, opacity=1, radius=26):
    width=max(2,int(width)); height=max(2,round(width*img.height/img.width))
    layer=img.resize((width,height),Image.Resampling.BICUBIC).convert('RGBA')
    mask=Image.new('L',layer.size); ImageDraw.Draw(mask).rounded_rectangle((0,0,width-1,height-1),radius=radius,fill=int(255*max(0,min(1,opacity))))
    layer.putalpha(mask)
    if abs(angle)>.05: layer=layer.rotate(angle,Image.Resampling.BICUBIC,expand=True)
    canvas.alpha_composite(layer,(int(cx-layer.width/2),int(cy-layer.height/2)))

def label(canvas, text, time, start, y=96):
    progress=ease((time-start)/.42)
    d=ImageDraw.Draw(canvas)
    d.text((100-int(90*(1-progress)),y),text,font=font(72),fill=(245,249,255,int(255*progress)))

def scene(index,local):
    time=index*2+local
    canvas=background.copy().convert('RGBA')
    d=ImageDraw.Draw(canvas)
    # Moving light trails and drifting particles give the scene depth throughout.
    for i in range(24):
        px=(i*173+time*(18+i%5*7))%2100-90
        py=(i*113)%1080
        d.ellipse((px,py,px+3,py+3),fill=(70,145,230,115))
    for i in range(4):
        xx=int((time*180+i*620)%2600)-350
        d.line((xx,1080,xx+520,0),fill=(14,36,68),width=2)
    if time<4.1:
        label(canvas,'Your games. One home.',time,0)
        # Ten independent covers arrive from depth, settle into a grid, then sweep into a carousel.
        morph=ease((time-1.8)/.85)
        travel=ease((time-2.65)/.95)*530
        for i in range(9,-1,-1):
            entry=ease((time-i*.055)/.85)
            gx=320+(i%5)*320; gy=415+(i//5)*325
            rx=380+i*340-travel; ry=590+math.sin(i*.7+time)*8
            cx=gx*(1-morph)+rx*morph
            cy=gy*(1-morph)+ry*morph
            cx+=(gx-960)*2.5*(1-entry)
            cy+=(gy-540)*2.5*(1-entry)
            size=(265*(1-morph)+310*morph)*(.25+.75*entry)
            angle=(i%2*2-1)*35*(1-entry)+morph*math.sin(time*1.5+i)*2
            exit=ease((time-3.65)/.45)
            cx-=exit*2100
            place(canvas,tiles[i],cx,cy,size,angle,entry)
        if 2.4<time<3.65:
            d=ImageDraw.Draw(canvas)
            d.rounded_rectangle((683,408,1027,770),radius=32,outline='#82c1ff',width=5)
            d.text((705,801),'Find your next game',font=regular(30),fill='#b8c9e0')
    elif time<6.3:
        p=ease((time-4.1)/.5)
        # Hero, title, action and gallery are separate animated layers, not a flat screenshot.
        place(canvas,hero,1130+700*(1-p),440,1450+60*(time-4.1),radius=32)
        shade=Image.new('RGBA',(W,H)); sd=ImageDraw.Draw(shade)
        for xx in range(1300):
            alpha=int(245*max(0,1-xx/1300))
            sd.line((xx,0,xx,H),fill=(5,10,21,alpha))
        canvas=Image.alpha_composite(canvas,shade)
        label(canvas,'Forza Horizon 5',time,4.25,275)
        d=ImageDraw.Draw(canvas)
        sub=ease((time-4.4)/.4)
        d.text((104-int(80*(1-sub)),382),'Pick a game. Press play.',font=regular(35),fill='#c4d8f2')
        bx=104-int(120*(1-sub)); by=465
        d.rounded_rectangle((bx,by,bx+234,by+76),radius=18,fill='#087bd9',outline='#a5d3ff',width=2)
        d.polygon([(bx+29,by+23),(bx+29,by+53),(bx+51,by+38)],fill='white')
        d.text((bx+73,by+13),'Play',font=font(33),fill='white')
        for i in range(4):
            enter=ease((time-4.7-i*.09)/.55)
            piece=assets[2].crop((550+i*280,620,810+i*280,790))
            place(canvas,piece,325+i*415,860+300*(1-enter),365,0,enter,18)
        if time>5.85:
            # Whole composition contracts into the incoming device screen.
            factor=1-.30*ease((time-5.85)/.45)
            small=canvas.resize((int(W*factor),int(H*factor)),Image.Resampling.BICUBIC)
            canvas=background.copy().convert('RGBA'); canvas.alpha_composite(small,((W-small.width)//2,(H-small.height)//2))
    elif time<8.25:
        p=ease((time-6.3)/.65)
        label(canvas,'Controller ready.',time,6.35)
        place(canvas,assets[3],960+1250*(1-p),625,1530+50*math.sin((time-6.3)*2),-12*(1-p)+1.5*math.sin((time-6.3)*2),p,36)
        if time>7.8:
            close=ease((time-7.8)/.45)
            canvas=Image.blend(canvas,background.convert('RGBA'),close)
            place(canvas,icon,960,480,40+180*close,180*(1-close),close)
    else:
        p=ease((time-8.25)/.55)
        # Icon lands, title rises, and the download line wipes on.
        place(canvas,icon,960,345-45*p,220-40*p,0,1,30)
        d=ImageDraw.Draw(canvas)
        for text,yy,ff,col,delay in [('Xbox Preview UI',435,font(94),'white',0),('A full-screen launcher for Windows',570,regular(37),'#b8c9e0',.1),('BETA 25  /  ON GITHUB',690,font(30),'#7fbdff',.2),('github.com/ykyritsis/xbox-cloud-preview-on-pc',780,regular(28),'#dce7f6',.25)]:
            progress=ease((time-8.25-delay)/.4)
            textlayer=Image.new('RGBA',(W,160)); td=ImageDraw.Draw(textlayer)
            box=td.textbbox((0,0),text,font=ff)
            td.text(((W-box[2])/2,0),text,font=ff,fill=col)
            textlayer.putalpha(textlayer.getchannel('A').point(lambda a:int(a*progress)))
            canvas.alpha_composite(textlayer,(0,yy+int(60*(1-progress))))
    return canvas.convert('RGB')
