const Maze = (() => {

  const TILE = {
    WALL:      1,
    FLOOR:     0,
    DOOR:      2,
    CLASSROOM: 3,
    CROWD:     4,

  };

  const CORRIDOR = {
    NORMAL: 0,
    CROWDED: 1,
  };

  function generate(cols, rows, tileSize, difficulty = {}) {
    const settings = _difficultySettings(difficulty);

    const mCols = cols % 2 === 0 ? cols - 1 : cols;
    const mRows = rows % 2 === 0 ? rows - 1 : rows;

    const grid = Array.from({ length: mRows }, () => new Array(mCols).fill(TILE.WALL));

    _dfsCarve(grid, mCols, mRows, 1, 1);

    _addLoops(grid, mCols, mRows, settings.loops);

    const rooms = _carveRooms(grid, mCols, mRows, 3);

    const walkable = _collectWalkable(grid, mCols, mRows);

    const { spawnCol, spawnRow, goalCol, goalRow } =
      _placeSpawnAndGoal(grid, mCols, mRows, walkable);
    const mainPath = Algorithms.bfs(grid, spawnCol, spawnRow, goalCol, goalRow).path;

    grid[goalRow][goalCol] = TILE.CLASSROOM;

    const doors = _placeDoors(grid, mCols, mRows, settings.doors);

    const crowds = _placeCrowds(grid, mCols, mRows, settings.crowds, mainPath, spawnCol, spawnRow, goalCol, goalRow);

    const obstacleSeeds = _seedObstacles(grid, mCols, mRows, walkable, spawnCol, spawnRow, goalCol, goalRow, mainPath, settings);
    const powerupSeeds  = _seedPowerups (grid, mCols, mRows, walkable, spawnCol, spawnRow, goalCol, goalRow);

    const patrolPaths = _buildPatrolPaths(grid, mCols, mRows, obstacleSeeds, mainPath);

    return {
      grid, cols: mCols, rows: mRows, tileSize,
      spawnCol, spawnRow, goalCol, goalRow,
      doors, crowds,
      obstacleSeeds, powerupSeeds, patrolPaths,
      mainPath,
      rooms,
      TILE
    };
  }

  function _difficultySettings(difficulty) {
    const level = difficulty.level || 'normal';
    const settings = {
      easy:   { loops: 24, doors: 3, crowds: 2, obstacles: 7,  routeShare: 0.20 },
      normal: { loops: 20, doors: 4, crowds: 3, obstacles: 10, routeShare: 0.30 },
      hard:   { loops: 16, doors: 5, crowds: 4, obstacles: 12, routeShare: 0.40 },
    };
    return settings[level] || settings.normal;
  }

  function _dfsCarve(grid, cols, rows, startCol, startRow) {

    const stack = [{ col: startCol, row: startRow }];
    const visited = new Set();
    visited.add(`${startCol},${startRow}`);
    grid[startRow][startCol] = TILE.FLOOR;

    const dirs = [
      { dc:  0, dr: -2 },
      { dc:  0, dr:  2 },
      { dc: -2, dr:  0 },
      { dc:  2, dr:  0 },
    ];

    while (stack.length > 0) {
      const { col, row } = stack[stack.length - 1];

      const shuffled = Utils.shuffle([...dirs]);
      let moved = false;

      for (const { dc, dr } of shuffled) {
        const nc = col + dc;
        const nr = row + dr;
        const key = `${nc},${nr}`;

        if (nc < 1 || nc >= cols - 1 || nr < 1 || nr >= rows - 1) continue;
        if (visited.has(key)) continue;

        visited.add(key);
        grid[nr][nc] = TILE.FLOOR;
        grid[row + dr / 2][col + dc / 2] = TILE.FLOOR;

        stack.push({ col: nc, row: nr });
        moved = true;
        break;

      }

      if (!moved) stack.pop();

    }
  }

  function _addLoops(grid, cols, rows, count) {
    let attempts = 0;
    let added = 0;
    while (added < count && attempts < count * 20) {
      attempts++;
      const c = Utils.randInt(1, cols - 1);
      const r = Utils.randInt(1, rows - 1);

      if (grid[r][c] !== TILE.WALL) continue;
      const horiz = grid[r][c - 1] === TILE.FLOOR && grid[r][c + 1] === TILE.FLOOR;
      const vert  = grid[r - 1][c] === TILE.FLOOR && grid[r + 1][c] === TILE.FLOOR;
      if (horiz || vert) {
        grid[r][c] = TILE.FLOOR;
        added++;
      }
    }
  }

  function _carveRooms(grid, cols, rows, count) {
    const rooms = [];
    for (let i = 0; i < count; i++) {
      const w = Utils.randInt(3, 6);
      const h = Utils.randInt(3, 5);
      const c = Utils.randInt(2, cols - w - 2);
      const r = Utils.randInt(2, rows - h - 2);
      for (let rr = r; rr < r + h; rr++) {
        for (let cc = c; cc < c + w; cc++) {
          grid[rr][cc] = TILE.FLOOR;
        }
      }
      rooms.push({ col: c, row: r, w, h });
    }
    return rooms;
  }

  function _collectWalkable(grid, cols, rows) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === TILE.FLOOR) {
          cells.push({ col: c, row: r });
        }
      }
    }
    return cells;
  }

  function _placeSpawnAndGoal(grid, cols, rows, walkable) {
    const minManhattan = Math.floor((cols + rows) / 2);
    const targetPathLength = Math.floor((cols + rows) * 1.2);
    const shuffled = Utils.shuffle([...walkable]);
    const spawnCandidates = shuffled.slice(0, Math.min(70, shuffled.length));
    const goalCandidates = Utils.shuffle([...walkable]).slice(0, Math.min(120, walkable.length));

    let best = null;
    let bestFallback = null;

    for (const spawn of spawnCandidates) {
      for (const goal of goalCandidates) {
        if (spawn.col === goal.col && spawn.row === goal.row) continue;

        const md = Utils.manhattan(spawn.col, spawn.row, goal.col, goal.row);
        if (md < minManhattan) continue;

        const { path } = Algorithms.bfs(grid, spawn.col, spawn.row, goal.col, goal.row);
        if (path.length === 0) continue;

        const obviousLine = _hasStraightSightLine(grid, spawn, goal, 12);
        const turns = _countPathTurns(path);
        const score = path.length + turns * 4 - (obviousLine ? 30 : 0);
        const candidate = { spawn, goal, pathLength: path.length, turns, obviousLine, score };

        if (!bestFallback || candidate.score > bestFallback.score) {
          bestFallback = candidate;
        }

        if (
          path.length >= targetPathLength &&
          turns >= 6 &&
          !obviousLine &&
          (!best || candidate.score > best.score)
        ) {
          best = candidate;
        }
      }
    }

    const chosen = best || bestFallback;
    if (chosen) {
      return {
        spawnCol: chosen.spawn.col, spawnRow: chosen.spawn.row,
        goalCol:  chosen.goal.col,  goalRow:  chosen.goal.row
      };
    }

    return { spawnCol: 1, spawnRow: 1, goalCol: cols - 2, goalRow: rows - 2 };
  }

  function _hasStraightSightLine(grid, a, b, maxDistance) {
    const md = Utils.manhattan(a.col, a.row, b.col, b.row);
    if (md > maxDistance) return false;

    if (a.row === b.row) {
      const from = Math.min(a.col, b.col);
      const to = Math.max(a.col, b.col);
      for (let c = from + 1; c < to; c++) {
        if (grid[a.row][c] === TILE.WALL) return false;
      }
      return true;
    }

    if (a.col === b.col) {
      const from = Math.min(a.row, b.row);
      const to = Math.max(a.row, b.row);
      for (let r = from + 1; r < to; r++) {
        if (grid[r][a.col] === TILE.WALL) return false;
      }
      return true;
    }

    return false;
  }

  function _countPathTurns(path) {
    let turns = 0;
    for (let i = 2; i < path.length; i++) {
      const prevDc = path[i - 1].col - path[i - 2].col;
      const prevDr = path[i - 1].row - path[i - 2].row;
      const dc = path[i].col - path[i - 1].col;
      const dr = path[i].row - path[i - 1].row;
      if (prevDc !== dc || prevDr !== dr) turns++;
    }
    return turns;
  }

  function _placeDoors(grid, cols, rows, count) {
    const doors = [];
    const dirs = [{ dc:1,dr:0 },{ dc:0,dr:1 }];

    let attempts = 0;
    while (doors.length < count && attempts < 500) {
      attempts++;
      const c = Utils.randInt(2, cols - 2);
      const r = Utils.randInt(2, rows - 2);
      if (grid[r][c] !== TILE.FLOOR) continue;

      const { dc, dr } = Utils.pick(dirs);
      const perpDc = dr; const perpDr = dc;
      if (
        grid[r + dr] && grid[r + dr][c + dc] === TILE.FLOOR &&
        grid[r - dr] && grid[r - dr][c - dc] === TILE.FLOOR &&
        grid[r + perpDr] && grid[r + perpDr][c + perpDc] === TILE.WALL &&
        grid[r - perpDr] && grid[r - perpDr][c - perpDc] === TILE.WALL
      ) {
        grid[r][c] = TILE.DOOR;
        doors.push({ col: c, row: r });
      }
    }
    return doors;
  }

  function _placeCrowds(grid, cols, rows, count, mainPath, sc, sr, gc, gr) {
    const crowds = [];
    const routeCandidates = Utils.shuffle(
      mainPath.filter(({ col, row }, i) =>
        i > 8 &&
        i < mainPath.length - 8 &&
        Utils.manhattan(col, row, sc, sr) > 6 &&
        Utils.manhattan(col, row, gc, gr) > 6 &&
        grid[row][col] === TILE.FLOOR
      )
    );

    while (crowds.length < Math.min(3, count) && routeCandidates.length > 0) {
      const cell = routeCandidates.pop();
      if (grid[cell.row][cell.col] !== TILE.FLOOR) continue;
      grid[cell.row][cell.col] = TILE.CROWD;
      crowds.push({ col: cell.col, row: cell.row });
    }

    let attempts = 0;
    while (crowds.length < count && attempts < 300) {
      attempts++;
      const c = Utils.randInt(2, cols - 3);
      const r = Utils.randInt(2, rows - 3);
      if (grid[r][c] === TILE.FLOOR && grid[r][c + 1] === TILE.FLOOR) {
        grid[r][c] = TILE.CROWD;
        crowds.push({ col: c, row: r });
      }
    }
    return crowds;
  }

  function _seedObstacles(grid, cols, rows, walkable, sc, sr, gc, gr, mainPath, settings) {
    const seeds = [];
    const types = ['student', 'student', 'cart', 'student'];
    const safeRadius = 4;

    const routeKeys = new Set(mainPath.map(p => `${p.col},${p.row}`));
    const routeCandidates = _routeSideCandidates(grid, cols, rows, mainPath, routeKeys, sc, sr, gc, gr, safeRadius);

    const candidates = walkable.filter(({ col, row }) => {
      const dSpawn = Utils.manhattan(col, row, sc, sr);
      const dGoal  = Utils.manhattan(col, row, gc, gr);
      return (
        dSpawn > safeRadius &&
        dGoal  > safeRadius &&
        grid[row][col] === TILE.FLOOR
      );
    });

    const shuffledRoute = Utils.shuffle([...routeCandidates]);
    const shuffledOther = Utils.shuffle([...candidates].filter(cell => !routeKeys.has(`${cell.col},${cell.row}`)));
    const count = Math.min(settings.obstacles, shuffledRoute.length + shuffledOther.length);
    const routeLimit = Math.ceil(count * settings.routeShare);

    for (let i = 0; i < count; i++) {
      const preferRoute = i < routeLimit && shuffledRoute.length > 0;
      const primary = preferRoute ? shuffledRoute : shuffledOther;
      const secondary = preferRoute ? shuffledOther : shuffledRoute;
      const cell = _takeSpacedCandidate(primary, seeds, 3) ||
        _takeSpacedCandidate(secondary, seeds, 2);
      if (!cell) break;
      seeds.push({
        col: cell.col,
        row: cell.row,
        type: types[i % types.length]
      });
    }
    return seeds;
  }

  function _takeSpacedCandidate(candidates, seeds, minDistance) {
    while (candidates.length > 0) {
      const cell = candidates.pop();
      const tooClose = seeds.some(seed =>
        Utils.manhattan(cell.col, cell.row, seed.col, seed.row) < minDistance
      );
      if (!tooClose) return cell;
    }
    return null;
  }

  function _routeSideCandidates(grid, cols, rows, mainPath, routeKeys, sc, sr, gc, gr, safeRadius) {
    const dirs = [{ dc:1,dr:0 },{ dc:-1,dr:0 },{ dc:0,dr:1 },{ dc:0,dr:-1 }];
    const seen = new Set();
    const candidates = [];

    mainPath.forEach(({ col, row }, i) => {
      if (i <= 8 || i >= mainPath.length - 8) return;

      dirs.forEach(({ dc, dr }) => {
        const c = col + dc;
        const r = row + dr;
        const key = `${c},${r}`;

        if (r <= 0 || r >= rows - 1 || c <= 0 || c >= cols - 1) return;
        if (seen.has(key) || routeKeys.has(key)) return;
        if (grid[r][c] !== TILE.FLOOR) return;
        if (Utils.manhattan(c, r, sc, sr) <= safeRadius) return;
        if (Utils.manhattan(c, r, gc, gr) <= safeRadius) return;
        if (_openNeighborCount(grid, c, r) < 3) return;

        seen.add(key);
        candidates.push({ col: c, row: r });
      });
    });

    return candidates;
  }

  function _openNeighborCount(grid, col, row) {
    const dirs = [{ dc:1,dr:0 },{ dc:-1,dr:0 },{ dc:0,dr:1 },{ dc:0,dr:-1 }];
    let count = 0;
    dirs.forEach(({ dc, dr }) => {
      const tile = grid[row + dr] && grid[row + dr][col + dc];
      if (tile === TILE.FLOOR || tile === TILE.CROWD || tile === TILE.DOOR || tile === TILE.CLASSROOM) {
        count++;
      }
    });
    return count;
  }

  function _seedPowerups(grid, cols, rows, walkable, sc, sr, gc, gr) {
  const seeds = [];
  const types = ['coffee', 'coffee', 'friend', 'call', 'roadblock', 'traffic'];
  const safeRadius = 3;

  const candidates = walkable.filter(({ col, row }) =>
    Utils.manhattan(col, row, sc, sr) > safeRadius &&
    Utils.manhattan(col, row, gc, gr) > safeRadius &&
    grid[row][col] === TILE.FLOOR
  );

  const shuffled = Utils.shuffle([...candidates]);
  const count = Math.min(types.length, shuffled.length);

  for (let i = 0; i < count; i++) {
    seeds.push({
      col: shuffled[i].col,
      row: shuffled[i].row,
      type: types[i]
    });
  }
  return seeds;
}


  function _buildPatrolPaths(grid, cols, rows, obstacleSeeds, mainPath) {
    const patrolPaths = [];
    const dirs = [{ dc:1,dr:0 },{ dc:-1,dr:0 },{ dc:0,dr:1 },{ dc:0,dr:-1 }];
    const routeKeys = new Set(mainPath.map(p => `${p.col},${p.row}`));

    obstacleSeeds.forEach(seed => {
      if (seed.type !== 'cart') return;

      const bestDir = { dc:1, dr:0 };
      let maxLen = 0;
      let bestPath = [];

      for (const { dc, dr } of dirs) {
        const path = [{ col: seed.col, row: seed.row }];
        let c = seed.col + dc;
        let r = seed.row + dr;

        while (
          c > 0 && c < cols - 1 &&
          r > 0 && r < rows - 1 &&
          grid[r][c] === TILE.FLOOR &&
          !routeKeys.has(`${c},${r}`) &&
          path.length < 8
        ) {
          path.push({ col: c, row: r });
          c += dc;
          r += dr;
        }
        if (path.length > maxLen) {
          maxLen = path.length;
          bestPath = path;
        }
      }

      if (bestPath.length >= 2) {

        const roundTrip = [...bestPath, ...[...bestPath].reverse().slice(1)];
        patrolPaths.push({ seedCol: seed.col, seedRow: seed.row, path: roundTrip });
      }
    });

    return patrolPaths;
  }

  return { generate, TILE };
})();
