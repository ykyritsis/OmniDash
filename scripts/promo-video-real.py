"""Render a 10-second promo from approved screenshots, with original synthesized audio."""
from pathlib import Path
import sys, math, subprocess, wave, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.visual-review/video-deps'))
import imageio_ffmpeg
OUT = ROOT / 'dist/promo/video-real'
OUT.mkdir(parents=True, exist_ok=True)
ART = ROOT / 'docs/promo/beta25-v2'
W, H, FPS = 1920, 1080, 30
font = lambda n: ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', n)
regular = lambda n: ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', n)
assets = [Image.open(ART / f).convert('RGB') for f in ['screenshot-home.png', 'screenshot-library.png', 'screenshot-game-page.png', 'mockup-rog-ally.png']]
icon = Image.open(ART / 'app-icon.png').convert('RGBA')
y, x = np.mgrid[0:H, 0:W]
glow = np.exp(-(((x-1400)/900)**2 + ((y-420)/600)**2))
bg = np.zeros((H,W,3), np.uint8)
for c,(base,light) in enumerate([(5,8),(10,28),(21,55)]): bg[:,:,c] = base + light*glow
background = Image.fromarray(bg)
titles = ['Your games. One home.', 'Browse your library.', 'Choose your next game.', 'Made for controller play.']

def ease(t):
    t = max(0,min(1,t))
    return 1-(1-t)**3

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
        if s[2]==24: im=Image.open(ART/'screenshot-libraries.png').convert('RGB')
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


# Original 120 BPM electronic sting: soft chord bed, arpeggio, kick and transition sweeps.
SR=48000
t=np.arange(SR*10)/SR
audio=np.zeros(len(t),np.float64)
rng=np.random.default_rng(25)
for f in [138.591,207.652,277.183,329.628]: audio += .025*np.sin(2*np.pi*f*t)*np.minimum(t/1.0,1)
notes=[554.365,659.255,830.609,1108.731,830.609,659.255,415.305,659.255]
for k in range(36):
    start=k*.25; n=int(.4*SR); tt=np.arange(n)/SR; pos=int(start*SR)
    wavelet=(np.sin(2*np.pi*notes[k%8]*tt)+.15*np.sin(4*np.pi*notes[k%8]*tt))*.10*np.exp(-tt*13)*np.minimum(tt/.008,1)
    audio[pos:pos+n]+=wavelet[:len(audio[pos:pos+n])]
for start in np.arange(0,8.5,.5):
    tt=np.arange(int(.25*SR))/SR; pos=int(start*SR)
    kick=.24*np.sin(2*np.pi*(47*tt+55*.035*(1-np.exp(-tt/.035))))*np.exp(-tt*19)
    audio[pos:pos+len(kick)]+=kick
for start in [1.8,3.8,5.8,7.8]:
    tt=np.arange(int(.3*SR))/SR; pos=int(start*SR)
    noise=rng.normal(0,1,len(tt)); noise=np.convolve(noise,np.ones(9)/9,mode='same')
    audio[pos:pos+len(tt)] += .14*noise*np.sin(np.pi*tt/.3)**2
audio*=np.minimum(t/.03,1)*np.minimum((10-t)/.7,1)
stereo=np.column_stack((audio,np.roll(audio,190)*.92))
with wave.open(str(OUT/'original-soundtrack.wav'),'wb') as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes((np.clip(stereo,-1,1)*32767).astype('<i2').tobytes())
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
dest=OUT/'Xbox-Preview-UI-Cinematic-10s.mp4'
cmd=[ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUT/'original-soundtrack.wav'),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t','10','-movflags','+faststart',str(dest)]
thumbs=[]
with open(OUT/'render.log','w') as log:
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
    for frame in range(300):
        time=frame/FPS; idx=min(int(time//2),4); local=time-idx*2
        img=scene(idx,local)
        if False:
            previous=scene(idx-1,2)
            img=Image.blend(previous,img,ease(local/.2))
        if time<.15: img=Image.blend(Image.new('RGB',(W,H)),img,time/.15)
        if time>9.8: img=Image.blend(img,Image.new('RGB',(W,H)),(time-9.8)/.2)
        if frame in [12,30,70,105,145,180,235,270]: thumbs.append(img.resize((576,324)))
        p.stdin.write(img.tobytes())
        if frame%60==0: print(f'Rendered {frame}/300 frames',flush=True)
    p.stdin.close()
    if p.wait()!=0: raise RuntimeError('FFmpeg failed: see render.log')
sheet=Image.new('RGB',(576*4,324*2),(5,10,21))
for i,im in enumerate(thumbs): sheet.paste(im,((i%4)*576,(i//4)*324))
sheet.save(OUT/'contact-sheet.jpg')
thumbs[3].save(OUT/'poster.jpg')
(OUT/'edit-notes.json').write_text(json.dumps({'duration':10,'fps':30,'size':[W,H],'scenes':titles+['Xbox Preview UI / beta 25'],'audio':'Original synthesized electronic soundtrack','source':'Approved beta25-v2 screenshots and illustrative device mockup'},indent=2))
print(str(dest),flush=True)
