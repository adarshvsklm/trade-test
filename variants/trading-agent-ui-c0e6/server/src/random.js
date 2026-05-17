export function hashSeed(seedText) {
  let hash = 2166136261;

  for (let index = 0; index < seedText.length; index += 1) {
    hash ^= seedText.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createRng(seedText) {
  let state = hashSeed(seedText) || 1;

  return function random() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

export function randomChoice(rng, values) {
  return values[Math.floor(rng() * values.length)];
}
