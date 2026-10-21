// Makes assets/sounds/kitchen-ding.wav, a loud two-tone "ding-dong" for new kitchen orders.
// Run once from the project folder: node scripts/make-ding.js
const fs = require("fs");
const path = require("path");

const RATE = 22050;
const LENGTH = 1.3; // seconds
const NOTES = [
  { freq: 1318.5, start: 0, length: 0.7 }, // E6
  { freq: 1046.5, start: 0.3, length: 1.0 }, // C6
];

const total = Math.ceil(RATE * LENGTH);
const wave = new Float32Array(total);
for (const note of NOTES) {
  const first = Math.floor(note.start * RATE);
  const count = Math.floor(note.length * RATE);
  for (let i = 0; i < count && first + i < total; i++) {
    const t = i / RATE;
    const envelope = Math.min(1, t / 0.005) * Math.exp(-t * 4.5);
    wave[first + i] += envelope * (Math.sin(2 * Math.PI * note.freq * t) + 0.3 * Math.sin(4 * Math.PI * note.freq * t));
  }
}

let peak = 0;
for (const v of wave) peak = Math.max(peak, Math.abs(v));

const data = Buffer.alloc(total * 2);
wave.forEach((v, i) => data.writeInt16LE(Math.round((v / peak) * 0.95 * 32767), i * 2));

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16); // chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28); // bytes per second
header.writeUInt16LE(2, 32); // bytes per sample
header.writeUInt16LE(16, 34); // bits
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const out = path.join(__dirname, "..", "assets", "sounds", "kitchen-ding.wav");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, data]));
console.log(`Wrote ${out} (${Math.round((44 + data.length) / 1024)} KB)`);