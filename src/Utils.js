const Utils = (() => {

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  function randFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pick(arr) {
    return arr[randInt(0, arr.length)];
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mapRange(v, inMin, inMax, outMin, outMax) {
    return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
  }

  function dist(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function manhattan(ax, ay, bx, by) {
    return Math.abs(bx - ax) + Math.abs(by - ay);
  }

  function normalize(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  }

  function dot(ax, ay, bx, by) {
    return ax * bx + ay * by;
  }

  function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  }

  function applyTranslation(ctx, x, y) {
    ctx.translate(x, y);
  }

  function applyRotation(ctx, angle) {
    ctx.rotate(angle);
  }

  function applyScale(ctx, sx, sy) {
    ctx.scale(sx, sy || sx);
  }

  function drawTransformed(ctx, drawFn, x, y, angle, sx, sy) {
    ctx.save();
    applyTranslation(ctx, x, y);

    applyRotation(ctx, angle);

    applyScale(ctx, sx, sy || sx);

    drawFn(ctx);

    ctx.restore();
  }

  function rgba(r, g, b, a) {
    return `rgba(${r},${g},${b},${a})`;
  }

  function lerpColor(hexA, hexB, t) {
    const parse = h => [
      parseInt(h.slice(1,3),16),
      parseInt(h.slice(3,5),16),
      parseInt(h.slice(5,7),16)
    ];
    const [ar,ag,ab] = parse(hexA);
    const [br,bg,bb] = parse(hexB);
    const r = Math.round(lerp(ar,br,t));
    const g = Math.round(lerp(ag,bg,t));
    const b = Math.round(lerp(ab,bb,t));
    return `rgb(${r},${g},${b})`;
  }

  function gridToPixel(col, row, tileSize) {
    return {
      x: col * tileSize + tileSize / 2,
      y: row * tileSize + tileSize / 2
    };
  }

  function pixelToGrid(px, py, tileSize) {
    return {
      col: Math.floor(px / tileSize),
      row: Math.floor(py / tileSize)
    };
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }

  return {
    randInt, randFloat, pick, shuffle,
    clamp, lerp, mapRange,
    dist, manhattan, normalize, dot, angleTo,
    applyTranslation, applyRotation, applyScale, drawTransformed,
    rgba, lerpColor,
    gridToPixel, pixelToGrid,
    formatTime
  };
})();
