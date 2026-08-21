'use strict';

// 种子随机数生成器 (mulberry32)
export function createRng(seed) {
  let s = seed >>> 0;
  const rng = {
    next() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return Math.floor(rng.next() * (max - min + 1)) + min;
    },
    pick(arr) {
      return arr[Math.floor(rng.next() * arr.length)];
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    chance(p) {
      return rng.next() < p;
    },
  };
  return rng;
}
