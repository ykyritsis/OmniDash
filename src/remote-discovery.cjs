const dgram = require('node:dgram');
const os = require('node:os');
const net = require('node:net');

const SERVICE = '_nvstream._tcp.local';
const ipv4Number = value => value.split('.').reduce((n, byte) => (n * 256 + Number(byte)) >>> 0, 0);
const ipv4Text = value => [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
function interfaces() {
  return Object.entries(os.networkInterfaces()).flatMap(([name, items]) => (items || []).map(item => ({...item, name})));
}
function usableInterfaces(addresses) {
  const seen = new Set();
  return addresses.filter(item => item && net.isIP(item.address) === 4 && net.isIP(item.netmask) === 4 && !item.internal && !/^(127\.|169\.254\.|0\.)/.test(item.address))
    .sort((a,b) => Number(/virtual|vethernet|vpn|tailscale|zerotier|wireguard|wsl|docker|tunnel/i.test(a.name || '')) - Number(/virtual|vethernet|vpn|tailscale|zerotier|wireguard|wsl|docker|tunnel/i.test(b.name || '')))
    .filter(item => { if(seen.has(item.address))return false;seen.add(item.address);return true; }).slice(0,8);
}
function lanCandidates(addresses) {
  const result = new Set(), subnets = new Set(), ranges = [];
  for (const item of usableInterfaces(addresses)) {
    const ip = ipv4Number(item.address), mask = (ipv4Number(item.netmask) | 0xffffff00) >>> 0;
    const network = (ip & mask) >>> 0, broadcast = (network | ~mask) >>> 0;
    result.add(item.address);
    // Interleave adapters so a virtual network cannot starve the actual LAN.
    // Only the attached /24 (or smaller), never an entire VPN/private range.
    const key = `${network}:${broadcast}`;
    if(!subnets.has(key)){subnets.add(key);ranges.push({next:network+1,end:broadcast});}
  }
  while(ranges.some(range => range.next < range.end))for(const range of ranges)if(range.next < range.end)result.add(ipv4Text(range.next++));
  return [...result];
}
function dnsName(name) {
  return Buffer.concat([...name.split('.').filter(Boolean).map(label => Buffer.concat([Buffer.from([Buffer.byteLength(label)]), Buffer.from(label)])), Buffer.from([0])]);
}
function query(name, type = 12, unicast = true) {
  const header = Buffer.alloc(12); header.writeUInt16BE(1, 4);
  // QU requests a unicast answer on our ephemeral port; no firewall service or
  // exclusive bind to 5353 is needed alongside another Moonlight client.
  const tail = Buffer.from([type >> 8, type & 255, unicast ? 0x80 : 0, 1]);
  return Buffer.concat([header, dnsName(name), tail]);
}
function dnsRecords(packet) {
  if (!Buffer.isBuffer(packet) || packet.length < 12 || packet.length > 65535) return [];
  const nameAt = start => {
    let at = start, end = null; const labels = [], visited = new Set();
    for (let n = 0; n < 128; n++) {
      if (at >= packet.length || visited.has(at)) throw new Error('Invalid DNS name');
      visited.add(at); const size = packet[at++];
      if (!size) return {name: labels.join('.').toLowerCase(), end: end ?? at};
      if ((size & 0xc0) === 0xc0) {
        if (at >= packet.length) throw new Error('Truncated DNS pointer');
        end ??= at + 1; at = ((size & 0x3f) << 8) | packet[at]; continue;
      }
      if (size > 63 || at + size > packet.length) throw new Error('Invalid DNS label');
      labels.push(packet.toString('utf8', at, at + size)); at += size;
    }
    throw new Error('DNS name too long');
  };
  try {
    let at = 12; const records = [];
    const questions = packet.readUInt16BE(4), count = packet.readUInt16BE(6) + packet.readUInt16BE(8) + packet.readUInt16BE(10);
    if (questions > 64 || count > 512) return [];
    for (let i = 0; i < questions; i++) { at = nameAt(at).end + 4; if (at > packet.length) return []; }
    for (let i = 0; i < count; i++) {
      const owner = nameAt(at); at = owner.end;
      if (at + 10 > packet.length) return [];
      const type = packet.readUInt16BE(at), ttl = packet.readUInt32BE(at + 4), length = packet.readUInt16BE(at + 8); at += 10;
      const end = at + length; if (end > packet.length) return [];
      const record = {name: owner.name, type, ttl};
      if (type === 12) { const name = nameAt(at); if (name.end > end) return []; record.target = name.name; }
      if (type === 33 && length >= 7) { record.port = packet.readUInt16BE(at + 4); const name = nameAt(at + 6); if (name.end > end) return []; record.target = name.name; }
      if (type === 1 && length === 4) record.address = [...packet.subarray(at, end)].join('.');
      records.push(record); at = end;
    }
    return records;
  } catch { return []; }
}
function discoverMdns({addresses, onAddress, duration = 4500, signal, createSocket = dgram.createSocket}) {
  return new Promise(resolve => {
    addresses = usableInterfaces(addresses);
    const sockets = [], timers = [], services = new Map(), records = new Map(), sent = new Set(), delivered = new Set();
    let finished = false;
    const finish = () => { if(finished)return;finished=true;signal?.removeEventListener('abort',finish);for (const timer of timers) clearTimeout(timer); for (const socket of sockets) try { socket.close(); } catch {} resolve(); };
    if(signal?.aborted || !addresses.length){finish();return;}
    signal?.addEventListener('abort',finish,{once:true});
    timers.push(setTimeout(finish, duration));
    const deliver = () => {
      for (const service of services.values()) {
        if (!service.port || !service.target) continue;
        const candidates = records.get(service.target) || [];
        for (const address of candidates) {
          if (!addresses.some(item => (ipv4Number(address) & ipv4Number(item.netmask)) === (ipv4Number(item.address) & ipv4Number(item.netmask)))) continue;
          const key = address + ':' + service.port;
          if (!delivered.has(key)) { delivered.add(key); onAddress(address, service.port); }
        }
      }
    };
    function listen(local, multicast) {
      let socket;try{socket=createSocket({type:'udp4',reuseAddr:true});}catch{return;}
      sockets.push(socket);
      socket.on('error', () => {});
      const send = (name = SERVICE, type = 12) => { if(finished)return;for(const item of local ? [local] : addresses)try { socket.setMulticastInterface(item.address);socket.send(query(name, type, !multicast), 5353, '224.0.0.251', () => {}); } catch {} };
      socket.on('message', bytes => {
        if(finished)return;
        for (const record of dnsRecords(bytes)) {
          if (!record.ttl) continue;
          if (record.type === 1 && record.address && records.size < 512) records.set(record.name, [...new Set([...(records.get(record.name) || []), record.address])].slice(0,16));
          if (record.type === 33 && record.name.endsWith('.' + SERVICE) && services.size < 512) {
            services.set(record.name, record);
            const key=(local?.address||'*')+':A:'+record.target;
            if (!sent.has(key)) { sent.add(key); send(record.target, 1); }
          }
          const key=(local?.address||'*')+':SRV:'+record.target;
          if (record.type === 12 && record.name === SERVICE && sent.size < 1024 && !sent.has(key)) { sent.add(key); send(record.target, 33); }
        }
        deliver();
      });
      try { socket.bind(multicast ? 5353 : 0, local?.address || '0.0.0.0', () => {
        if(finished)return;
        try { socket.setMulticastTTL(1); } catch {}
        if(multicast)for(const item of addresses)try{socket.addMembership('224.0.0.251',item.address);}catch{}
        send();timers.push(setTimeout(() => send(),900),setTimeout(() => send(),2400));
      }); } catch {}
    }
    // Some hosts only multicast responses. Share 5353 and join every LAN;
    // ephemeral QU queries remain a fallback when another app owns that port.
    listen(null,true);for(const item of addresses)listen(item,false);
  });
}
async function discoverHosts({probe, onFound = () => {}, addresses = interfaces(), saved = [], mdns = discoverMdns, timeout = 28000, probeTimeout = 800}) {
  addresses = usableInterfaces(addresses);
  const found = new Map(), queued = new Map(), checked = new Set(), queue = [], priority = [], controller = new AbortController();
  let active = 0, mdnsDone = false, finished = false, pumpTimer, deadline;
  return new Promise(resolve => {
    const finish = () => {if(finished)return;finished=true;clearTimeout(pumpTimer);clearTimeout(deadline);controller.abort();resolve([...found.values()].sort((a,b)=>a.name.localeCompare(b.name)));};
    const enqueue = (hostname, httpPort = 47989, urgent = true) => {
      const key = `${hostname}:${httpPort}`;
      if(finished || typeof hostname!=='string' || !hostname || !Number.isInteger(httpPort) || httpPort<1 || httpPort>65535 || checked.has(key))return;
      let address=queued.get(key);
      if(!address){address={hostname,httpPort,key};queued.set(key,address);(urgent?priority:queue).push(address);}
      else if(urgent && !address.priority)priority.push(address);
      if(urgent)address.priority=true;
    };
    const pump = () => {
      if(finished)return;
      while (active < 64 && (priority.length || queue.length)) {
        const address = priority.shift() || queue.shift();
        if(checked.has(address.key))continue;
        checked.add(address.key);queued.delete(address.key);active++;
        const attempt = new AbortController(), abort = () => attempt.abort();
        // Each worker is bounded even if a resolver or injected probe hangs.
        let timer;
        const expire=new Promise(resolve=>{timer=setTimeout(()=>{attempt.abort();resolve(null);},probeTimeout);});
        controller.signal.addEventListener('abort',abort,{once:true});
        Promise.race([Promise.resolve().then(()=>probe({hostname:address.hostname,httpPort:address.httpPort},probeTimeout,attempt.signal)),expire]).then(host => {
          if(!finished && host?.uuid && !found.has(host.uuid.toLowerCase())){found.set(host.uuid.toLowerCase(),host);onFound(host);}
        }).catch(()=>{}).finally(()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',abort);active--;});
      }
      if(!active && !priority.length && !queue.length && mdnsDone){finish();return;}
      pumpTimer=setTimeout(pump,25);
    };
    deadline=setTimeout(finish,timeout);
    // A scan can have 64 concurrent, independently cancelled probes.
    require('node:events').setMaxListeners(0,controller.signal);
    for(const host of saved.slice(0,64))enqueue(host.hostname,host.httpPort);
    lanCandidates(addresses).forEach(ip=>enqueue(ip,47989,false));
    Promise.resolve().then(()=>mdns({addresses,onAddress:enqueue,duration:Math.min(4500,timeout),signal:controller.signal})).catch(()=>{}).finally(()=>{mdnsDone=true;});
    pump();
  });
}
module.exports = {discoverHosts, discoverMdns, dnsRecords, query, dnsName, lanCandidates, usableInterfaces};
