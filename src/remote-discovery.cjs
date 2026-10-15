const dgram = require('node:dgram');
const os = require('node:os');
const net = require('node:net');

const SERVICE = '_nvstream._tcp.local';
const ipv4Number = value => value.split('.').reduce((n, byte) => (n * 256 + Number(byte)) >>> 0, 0);
const ipv4Text = value => [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
function interfaces() {
  return Object.values(os.networkInterfaces()).flat().filter(item => item && item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.'));
}
function lanCandidates(addresses) {
  const result = new Set();
  for (const item of addresses.slice(0, 4)) {
    if (net.isIP(item.address) !== 4 || net.isIP(item.netmask) !== 4) continue;
    const ip = ipv4Number(item.address), mask = (ipv4Number(item.netmask) | 0xffffff00) >>> 0;
    const network = (ip & mask) >>> 0, broadcast = (network | ~mask) >>> 0;
    result.add(item.address);
    // Only the directly attached /24 (or smaller), never a whole VPN/private range.
    for (let n = network + 1; n < broadcast; n++) result.add(ipv4Text(n));
  }
  return [...result];
}
function dnsName(name) {
  return Buffer.concat([...name.split('.').filter(Boolean).map(label => Buffer.concat([Buffer.from([Buffer.byteLength(label)]), Buffer.from(label)])), Buffer.from([0])]);
}
function query(name, type = 12) {
  const header = Buffer.alloc(12); header.writeUInt16BE(1, 4);
  // QU requests a unicast answer on our ephemeral port; no firewall service or
  // exclusive bind to 5353 is needed alongside another Moonlight client.
  const tail = Buffer.from([type >> 8, type & 255, 0x80, 1]);
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
function discoverMdns({addresses, onAddress, duration = 3000, createSocket = dgram.createSocket}) {
  return new Promise(resolve => {
    const sockets = [], timers = [], services = new Map(), records = new Map(), sent = new Set(), delivered = new Set();
    const finish = () => { for (const timer of timers) clearTimeout(timer); for (const socket of sockets) try { socket.close(); } catch {} resolve(); };
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
    for (const item of addresses.slice(0, 4)) {
      const socket = createSocket({type: 'udp4', reuseAddr: true}); sockets.push(socket);
      socket.on('error', () => {});
      const send = (name = SERVICE, type = 12) => { try { socket.send(query(name, type), 5353, '224.0.0.251', () => {}); } catch {} };
      socket.on('message', bytes => {
        for (const record of dnsRecords(bytes)) {
          if (!record.ttl) continue;
          if (record.type === 1 && record.address) records.set(record.name, [...new Set([...(records.get(record.name) || []), record.address])]);
          if (record.type === 33 && record.name.endsWith('.' + SERVICE)) {
            services.set(record.name, record);
            if (!sent.has(record.target)) { sent.add(record.target); send(record.target, 1); }
          }
          if (record.type === 12 && record.name === SERVICE && !sent.has(record.target)) { sent.add(record.target); send(record.target, 33); }
        }
        deliver();
      });
      try { socket.bind(0, item.address, () => { try { socket.setMulticastInterface(item.address); socket.setMulticastTTL(1); } catch {} send(); timers.push(setTimeout(() => send(), 900)); }); } catch {}
    }
  });
}
async function discoverHosts({probe, onFound = () => {}, addresses = interfaces(), mdns = discoverMdns, timeout = 9000}) {
  const found = new Map(), checked = new Set(), queue = [], end = Date.now() + timeout;
  let active = 0, mdnsDone = false;
  const enqueue = (hostname, httpPort = 47989) => {
    const key = `${hostname}:${httpPort}`;
    if (!checked.has(key) && httpPort > 0 && httpPort <= 65535) { checked.add(key); queue.push({hostname, httpPort}); }
  };
  const browsing = mdns({addresses, onAddress: enqueue}).catch(() => {}).finally(() => { mdnsDone = true; });
  lanCandidates(addresses).forEach(ip => enqueue(ip));
  await new Promise(resolve => {
    const pump = () => {
      while (active < 32 && queue.length && Date.now() < end) {
        const address = queue.shift(); active++;
        Promise.resolve().then(() => probe(address, 800)).then(host => {
          if (host?.uuid && !found.has(host.uuid.toLowerCase())) { found.set(host.uuid.toLowerCase(), host); onFound(host); }
        }).catch(() => {}).finally(() => { active--; });
      }
      if (!active && (Date.now() >= end || (!queue.length && mdnsDone))) { resolve(); return; }
      setTimeout(pump, 30);
    };
    pump();
  });
  await browsing;
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
module.exports = {discoverHosts, discoverMdns, dnsRecords, query, dnsName, lanCandidates};
