"""Render a 10-second promo from approved screenshots, with original synthesized audio."""
from pathlib import Path
import sys, math, subprocess, wave, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.visual-review/video-deps'))
import imageio_ffmpeg
OUT = ROOT / 'dist/promo/video'
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

def scene(index, local):
    canvas = background.copy().convert('RGBA')
    d = ImageDraw.Draw(canvas)
    if index < 4:
        d.text((104,62), 'XBOX PREVIEW UI', font=font(25), fill='#74b7ff')
        dy = int(18*(1-ease(local/.35)))
        d.text((100,103+dy), titles[index], font=font(66), fill='white')
        d.text((1725,77), f'0{index+1}', font=font(28), fill='#74b7ff')
        # Framed screenshots stay intact; the camera gently moves closer.
        width = int(1430 + 35*ease(local/2))
        height = round(width*9/16)
        if index == 3: width, height = int(1430+35*ease(local/2)), int((1430+35*ease(local/2))*9/16)
        shot = assets[index].resize((width,height), Image.Resampling.LANCZOS).convert('RGBA')
        mask = Image.new('L',(width,height)); ImageDraw.Draw(mask).rounded_rectangle((0,0,width-1,height-1),radius=24,fill=255)
        shot.putalpha(mask)
        left, top = (W-width)//2, 205 + int(24*(1-ease(local/.5)))
        shadow = Image.new('RGBA',(W,H)); sd=ImageDraw.Draw(shadow)
        sd.rounded_rectangle((left-7,top-7,left+width+7,top+height+7),radius=30,fill=(24,102,212,125))
        canvas=Image.alpha_composite(canvas,shadow.filter(ImageFilter.GaussianBlur(18)))
        canvas.alpha_composite(shot,(left,top))
    else:
        offset=int(22*(1-ease(local/.4)))
        logo=icon.resize((176,176),Image.Resampling.LANCZOS)
        canvas.alpha_composite(logo,((W-176)//2,200+offset))
        d=ImageDraw.Draw(canvas)
        for text,yy,ff,col in [('Xbox Preview UI',420,font(100),'white'),('A full-screen launcher for Windows',553,regular(38),'#b8c9e0'),('BETA 25  /  AVAILABLE ON GITHUB',680,font(28),'#7fbdff'),('github.com/ykyritsis/xbox-cloud-preview-on-pc',770,regular(29),'#dce7f6')]:
            box=d.textbbox((0,0),text,font=ff); d.text(((W-(box[2]-box[0]))/2,yy+offset),text,font=ff,fill=col)
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
dest=OUT/'Xbox-Preview-UI-Beta25-Promo-10s.mp4'
cmd=[ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUT/'original-soundtrack.wav'),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t','10','-movflags','+faststart',str(dest)]
thumbs=[]
with open(OUT/'render.log','w') as log:
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
    for frame in range(300):
        time=frame/FPS; idx=min(int(time//2),4); local=time-idx*2
        img=scene(idx,local)
        if idx>0 and local<.2:
            previous=scene(idx-1,2)
            img=Image.blend(previous,img,ease(local/.2))
        if time<.15: img=Image.blend(Image.new('RGB',(W,H)),img,time/.15)
        if time>9.8: img=Image.blend(img,Image.new('RGB',(W,H)),(time-9.8)/.2)
        if frame in [20,80,140,200,260]: thumbs.append(img.resize((576,324)))
        p.stdin.write(img.tobytes())
        if frame%60==0: print(f'Rendered {frame}/300 frames',flush=True)
    p.stdin.close()
    if p.wait()!=0: raise RuntimeError('FFmpeg failed: see render.log')
sheet=Image.new('RGB',(576*3,324*2),(5,10,21))
for i,im in enumerate(thumbs): sheet.paste(im,((i%3)*576,(i//3)*324))
sheet.save(OUT/'contact-sheet.jpg')
thumbs[3].save(OUT/'poster.jpg')
(OUT/'edit-notes.json').write_text(json.dumps({'duration':10,'fps':30,'size':[W,H],'scenes':titles+['Xbox Preview UI / beta 25'],'audio':'Original synthesized electronic soundtrack','source':'Approved beta25-v2 screenshots and illustrative device mockup'},indent=2))
print(str(dest),flush=True)
