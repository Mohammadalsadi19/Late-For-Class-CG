const Algorithms = (() => {
  function aabbOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function aabbMTV(a, b) {

    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);

    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

    if (overlapX <= 0 || overlapY <= 0) return null;

    if (overlapX < overlapY) {

      const centerAx = a.x + a.w / 2;
      const centerBx = b.x + b.w / 2;
      const sign = centerAx < centerBx ? -1 : 1;
      return { dx: sign * overlapX, dy: 0, axis: 'x' };
    } else {

      const centerAy = a.y + a.h / 2;
      const centerBy = b.y + b.h / 2;
      const sign = centerAy < centerBy ? -1 : 1;
      return { dx: 0, dy: sign * overlapY, axis: 'y' };
    }
  }

  function circleRect(circle, rect) {

    const nearX = Utils.clamp(circle.cx, rect.x, rect.x + rect.w);
    const nearY = Utils.clamp(circle.cy, rect.y, rect.y + rect.h);

    const dx = circle.cx - nearX;
    const dy = circle.cy - nearY;
    const distSq = dx * dx + dy * dy;

    if (distSq >= circle.r * circle.r) return { hit: false };

    const dist = Math.sqrt(distSq);
    const depth = circle.r - dist;

    let nx = 0, ny = 0;
    if (dist > 0) {
      nx = dx / dist;
      ny = dy / dist;
    } else {

      ny = -1;
    }

    return { hit: true, nx, ny, depth };
  }

  function circleCircle(a, b) {
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = a.r + b.r;
    if (dist >= minDist) return { hit: false };
    const depth = minDist - dist;
    const nx = dist > 0 ? dx / dist : 1;
    const ny = dist > 0 ? dy / dist : 0;
    return { hit: true, nx, ny, depth };
  }

  function bfs(grid, startCol, startRow, goalCol, goalRow) {
    const rows = grid.length;
    const cols = grid[0].length;

    const queue = [{ col: startCol, row: startRow }];

    const parent = new Map();
    const startKey = `${startCol},${startRow}`;
    parent.set(startKey, null);

    const visited = [];

    const dirs = [
      { dc:  0, dr: -1 },

      { dc:  0, dr:  1 },

      { dc: -1, dr:  0 },

      { dc:  1, dr:  0 },

    ];

    while (queue.length > 0) {
      const current = queue.shift();
      visited.push({ col: current.col, row: current.row });

      if (current.col === goalCol && current.row === goalRow) {
        const path = [];
        let key = `${goalCol},${goalRow}`;
        while (key !== null) {
          const [c, r] = key.split(',').map(Number);
          path.unshift({ col: c, row: r });
          key = parent.get(key);
        }
        return { path, visited };
      }

      for (const { dc, dr } of dirs) {
        const nc = current.col + dc;
        const nr = current.row + dr;
        const nKey = `${nc},${nr}`;

        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

        if (grid[nr][nc] !== 0) continue;

        if (parent.has(nKey)) continue;

        parent.set(nKey, `${current.col},${current.row}`);
        queue.push({ col: nc, row: nr });
      }
    }

    return { path: [], visited };
  }

  function floodFill(grid, startCol, startRow) {
    const rows = grid.length;
    const cols = grid[0].length;
    const seen = new Set();
    const queue = [{ col: startCol, row: startRow }];
    seen.add(`${startCol},${startRow}`);
    const dirs = [{ dc:0,dr:-1 },{ dc:0,dr:1 },{ dc:-1,dr:0 },{ dc:1,dr:0 }];

    while (queue.length > 0) {
      const { col, row } = queue.shift();
      for (const { dc, dr } of dirs) {
        const nc = col + dc;
        const nr = row + dr;
        const key = `${nc},${nr}`;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[nr][nc] !== 0) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ col: nc, row: nr });
      }
    }
    return seen.size;
  }

  return {
    aabbOverlap, aabbMTV,
    circleRect, circleCircle,
    bfs, floodFill
  };
})();
