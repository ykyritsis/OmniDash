(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.StreamSettings=value;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const presets={
    latency:{name:'Lowest Latency',description:'Fast response and less Wi-Fi traffic. Some tearing is possible.',rate:.75,values:{codec:'auto',decoder:'auto',vsync:false,framePacing:false,fractionalVsync:false,yuv444:false}},
    balanced:{name:'Balanced',description:'Smooth video with a bitrate matched to your screen.',rate:1,values:{codec:'auto',decoder:'auto',vsync:true,framePacing:true,fractionalVsync:false,yuv444:false}},
    visuals:{name:'Max Visuals',description:'More picture detail. Best on a strong Wi-Fi or wired connection.',rate:1.6,values:{codec:'auto',decoder:'auto',vsync:true,framePacing:true,fractionalVsync:false,yuv444:false}}
  };
  const tuningKeys=['bitrate',...Object.keys(presets.balanced.values)];
  // Match StreamLight/Moonlight's resolution interpolation and sublinear
  // scaling above 60 fps. Presets adjust that baseline, not the render size.
  function presetValues(name,{width=1920,height=1080,fps=60,hdr=false}={}){
    const preset=presets[name]||presets.balanced;
    const table=[[640*360,1],[854*480,2],[1280*720,5],[1920*1080,10],[2560*1440,20],[3840*2160,40]],pixels=width*height;
    let factor=table.at(-1)[1];
    for(let i=0;i<table.length;i++)if(pixels<=table[i][0]){factor=i?table[i-1][1]+(pixels-table[i-1][0])/(table[i][0]-table[i-1][0])*(table[i][1]-table[i-1][1]):table[i][1];break;}
    const frameFactor=(fps<=60?fps:Math.sqrt(fps/60)*60)/30;
    return {...preset.values,bitrate:Math.max(500,Math.min(500000,Math.round(factor*frameFactor*preset.rate*(hdr===true||hdr==='true'?1.15:1))*1000))};
  }
  const padButtons=[
    {mask:256,index:4,name:'LB',ps:'L1',system:true},{mask:512,index:5,name:'RB',ps:'R1',system:true},
    {mask:32,index:8,name:'View',ps:'Create',system:true},{mask:16,index:9,name:'Menu',ps:'Options',system:true},
    {mask:4096,index:0,name:'A',ps:'Cross'},{mask:8192,index:1,name:'B',ps:'Circle'},
    {mask:16384,index:2,name:'X',ps:'Square'},{mask:32768,index:3,name:'Y',ps:'Triangle'}
  ];
  const defaultShortcuts=()=>({disconnect:{keyboard:{code:'KeyQ',modifiers:7},gamepad:0x1300},page:{keyboard:{code:'KeyH',modifiers:7},gamepad:0x320}});
  function keyInfo(code){
    if(/^Key[A-Z]$/.test(code)){const n=code.charCodeAt(3)-65;return {label:code[3],vk:65+n,key:97+n,scan:4+n};}
    if(/^Digit[0-9]$/.test(code)){const n=Number(code[5]);return {label:code[5],vk:48+n,key:48+n,scan:n?29+n:39};}
    const n=/^F([1-9]|1[0-9]|2[0-4])$/.exec(code);if(n){const num=Number(n[1]),scan=num<=12?57+num:91+num;return {label:code,vk:111+num,key:1073741824+scan,scan};}
    return null;
  }
  function keyboardEvent(event){return {code:event.code||(/^[a-z]$/i.test(event.key)?'Key'+event.key.toUpperCase():/^\d$/.test(event.key)?'Digit'+event.key:event.key),modifiers:(event.ctrlKey?1:0)|(event.altKey?2:0)|(event.shiftKey?4:0)|(event.metaKey?8:0)};}
  const sameKey=(a,b)=>a?.code===b?.code&&a?.modifiers===b?.modifiers;
  function shortcutError(bindings,action,type,value){
    const other=bindings[action==='disconnect'?'page':'disconnect'];
    if(type==='keyboard'){
      if(!keyInfo(value?.code)||![3,5,6,7].includes(value?.modifiers))return 'Hold at least two of Ctrl, Alt and Shift, then press a letter, number or F key.';
      if(value.modifiers===7&&['Z','X','S','M','C','D','V','L','O'].some(key=>value.code==='Key'+key))return 'That combination is used by the streaming player. Choose another key.';
      if(sameKey(value,other?.keyboard))return 'Choose different shortcuts for Disconnect and Game page.';
    }else{
      const buttons=padButtons.filter(b=>value&b.mask);
      if(!Number.isInteger(value)||(value&~0xf330)!==0||buttons.length<3||!buttons.some(b=>b.system))return 'Hold at least three buttons together, including LB, RB, View or Menu.';
      if([0x2300,0x4300].includes(value))return 'That combination opens live settings or statistics. Choose another combination.';
      if(value===other?.gamepad)return 'Choose different shortcuts for Disconnect and Game page.';
    }
    return '';
  }
  function normalizeShortcuts(value,legacy){
    const defaults=defaultShortcuts();if(legacy==='moonlight')defaults.disconnect.gamepad=0x330;
    const result={disconnect:{...defaults.disconnect,...value?.disconnect},page:{...defaults.page,...value?.page}};
    for(const type of ['keyboard','gamepad']){
      // Validate both before fixing either, so malformed collisions cannot
      // make one action inherit the other action's fallback.
      if(['disconnect','page'].some(action=>shortcutError(result,action,type,result[action][type])))for(const action of ['disconnect','page'])result[action][type]=defaults[action][type];
    }
    return result;
  }
  function logicalPadMask(mask,swapped){if(!swapped)return mask;return (mask&~0xf000)|((mask&0x1000)<<1)|((mask&0x2000)>>1)|((mask&0x4000)<<1)|((mask&0x8000)>>1);}
  function nativeKeyboard(binding){const info=keyInfo(binding.code);return {...info,mods:binding.modifiers,modifiers:((binding.modifiers&1)<<1)|((binding.modifiers&2)>>1)|(binding.modifiers&4)};}
  return {presets,presetValues,tuningKeys,padButtons,defaultShortcuts,keyInfo,keyboardEvent,sameKey,shortcutError,normalizeShortcuts,logicalPadMask,nativeKeyboard};
});
