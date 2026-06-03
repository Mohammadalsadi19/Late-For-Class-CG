const Game = (() => {

  const COLS      = 31;

  const ROWS      = 25;

  const TILE_SIZE = 36;

  let world        = null;
  let player       = null;
  let students     = [];
  let carts        = [];
  let doors        = [];
  let powerups     = [];
  let professorAI  = null;
  let professorData = null;
  let difficulty   = null;

  let timeLeft   = 90;

  let beaconTimer = 0;
  let debugMode  = false;

  let bfsResult     = null;
  let bfsAnimFrame  = 0;

  let running    = false;

  let canvas = null;
  let ctx    = null;

  let onWin  = null;
  let onLose = null;

  function init(_canvas, _professorData, _difficulty, _onWin, _onLose) {
    canvas    = _canvas;
    ctx       = canvas.getContext('2d');
    professorData = _professorData;
    difficulty = _difficulty || _getDifficultySettings('normal');
    onWin     = _onWin;
    onLose    = _onLose;

    _resizeCanvas();

    world = Maze.generate(COLS, ROWS, TILE_SIZE, difficulty);

    const spawnPx = Utils.gridToPixel(world.spawnCol, world.spawnRow, TILE_SIZE);
    player = new Player(spawnPx.x, spawnPx.y, TILE_SIZE);
    player.speed *= difficulty.playerSpeedScale;

    const profSpawn = _findProfessorSpawn(world);
    const profPx = Utils.gridToPixel(profSpawn.col, profSpawn.row, TILE_SIZE);
    professorAI = new ProfessorAI(profPx.x, profPx.y, TILE_SIZE, world.goalCol, world.goalRow);
    professorAI.speed *= difficulty.obstacleSpeedScale;

    students = [];
    carts    = [];

    world.obstacleSeeds.forEach(seed => {
      const px = Utils.gridToPixel(seed.col, seed.row, TILE_SIZE);
      if (seed.type === 'student') {
        students.push(new Student(px.x, px.y, TILE_SIZE));
        students[students.length - 1].speed *= difficulty.obstacleSpeedScale;
      } else if (seed.type === 'cart') {

        const patrol = world.patrolPaths.find(p => p.seedCol === seed.col && p.seedRow === seed.row);
        carts.push(new Cart(px.x, px.y, TILE_SIZE, patrol ? patrol.path : []));
        carts[carts.length - 1].speed *= difficulty.obstacleSpeedScale;
      }
    });

    doors = world.doors.map(d => new Door(d.col, d.row, TILE_SIZE));

    powerups = world.powerupSeeds.map(s => new Powerup(s.col, s.row, s.type, TILE_SIZE));

    timeLeft   = Math.round(professorData.time * difficulty.timeScale);
    beaconTimer = 0;
    bfsResult  = null;
    bfsAnimFrame = 0;
    running    = true;
  }

  function _findProfessorSpawn(world) {
    const walkable = [];
    for (let r = 0; r < world.rows; r++) {
      for (let c = 0; c < world.cols; c++) {
        const tile = world.grid[r][c];
        if (tile !== world.TILE.WALL && tile !== world.TILE.DOOR) {

          if ((c === world.spawnCol && r === world.spawnRow) ||
              (c === world.goalCol && r === world.goalRow)) continue;
          walkable.push({ col: c, row: r });
        }
      }
    }

    if (walkable.length === 0) {
      return { col: Math.floor(world.cols / 2), row: Math.floor(world.rows / 2) };
    }

    walkable.sort(() => Math.random() - 0.5);
    for (let i = 0; i < walkable.length; i++) {
      const cell = walkable[i];
      const dist = Utils.manhattan(cell.col, cell.row, world.spawnCol, world.spawnRow);
      if (dist > 10) return cell;
    }

    return walkable[0];
  }

  function _getDifficultySettings(level) {
    const settings = {
      easy: {
        level: 'easy',
        label: 'Easy',
        timeScale: 1.25,
        playerSpeedScale: 1.04,
        obstacleSpeedScale: 0.85,
      },
      normal: {
        level: 'normal',
        label: 'Normal',
        timeScale: 1,
        playerSpeedScale: 1,
        obstacleSpeedScale: 1,
      },
      hard: {
        level: 'hard',
        label: 'Hard',
        timeScale: 0.85,
        playerSpeedScale: 0.98,
        obstacleSpeedScale: 1.12,
      },
    };
    return settings[level] || settings.normal;
  }

  function _resizeCanvas() {

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight - 48;
  }

  function update(dt, input) {
    if (!running) return;

    timeLeft    -= dt;
    beaconTimer += dt;

    if (timeLeft <= 0) {
      timeLeft = 0;
      running  = false;
      onLose('time');
      return;
    }

    player.update(dt, input);

    const playerCell = Utils.pixelToGrid(player.x, player.y, TILE_SIZE);
    if (
      playerCell.row >= 0 && playerCell.row < world.rows &&
      playerCell.col >= 0 && playerCell.col < world.cols &&
      world.grid[playerCell.row][playerCell.col] === world.TILE.CROWD
    ) {

      player.vx *= 0.45;
      player.vy *= 0.45;
    }

    _movePlayerAxisX(dt);
    _movePlayerAxisY(dt);

    doors.forEach(door => {
      if (door.open) return;
      const dx = player.x - (door.x + door.w / 2);
      const dy = player.y - (door.y + door.h / 2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      const playerNear = dist < TILE_SIZE * 1.8;
      door.update(dt, playerNear, input.space);
    });

    students.forEach(s => s.update(dt, world));
    carts.forEach(c => c.update(dt, world));

    if (professorAI) {
      professorAI.update(dt, world);

      _resolveProfessorWalls(professorAI);

      _checkProfessorObstacleCollisions(professorAI);

      if (professorAI.hasReachedGoal(world)) {
        running = false;
        onLose('professor');
        return;
      }
    }

    _checkObstacleCollisions();

    powerups.forEach(pu => {
      if (pu.collected) return;
      pu.update(dt);

      if (Algorithms.aabbOverlap(player.aabb, pu.aabb)) {
        pu.collected = true;
        if (pu.type === 'coffee') {
          player.activateCoffee();
        } else if (pu.type === 'friend') {
          player.activateFriend();
          _requestBFS();
        }
      }
    });

    if (bfsResult && player.hasFriend) {
      bfsAnimFrame = Math.min(1, bfsAnimFrame + dt * 1.5);
    } else if (!player.hasFriend) {
      bfsResult    = null;
      bfsAnimFrame = 0;
    }

    const goalX = world.goalCol * TILE_SIZE + TILE_SIZE / 2;
    const goalY = world.goalRow * TILE_SIZE + TILE_SIZE / 2;
    const distToGoal = Utils.dist(player.x, player.y, goalX, goalY);
    if (distToGoal < TILE_SIZE * 0.7) {
      running = false;
      onWin({ timeLeft: Math.round(timeLeft), lives: player.lives });
    }

    if (player.lives <= 0) {
      running = false;
      onLose('lives');
    }

    Renderer.updateCamera(player, world, canvas.width, canvas.height);
  }

  function _movePlayerAxisX(dt) {
    player.x += player.vx * dt;
    _resolvePlayerWalls();
  }

  function _movePlayerAxisY(dt) {
    player.y += player.vy * dt;
    _resolvePlayerWalls();
  }

  function _resolvePlayerWalls() {
    const ts = TILE_SIZE;
    const pr = player.r;

    const col = Math.floor(player.x / ts);
    const row = Math.floor(player.y / ts);

    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const tc = col + dc;
        const tr = row + dr;

        if (tr < 0 || tr >= world.rows || tc < 0 || tc >= world.cols) continue;

        const tile = world.grid[tr][tc];
        const isWall = tile === world.TILE.WALL;

        if (!isWall) continue;

        const wallRect = { x: tc * ts, y: tr * ts, w: ts, h: ts };

        const result = Algorithms.circleRect(player.circle, wallRect);
        if (result.hit) {

          player.x += result.nx * result.depth;
          player.y += result.ny * result.depth;

          if (Math.abs(result.nx) > Math.abs(result.ny)) {
            if (player.vx * result.nx > 0) player.vx = 0;
          } else {
            if (player.vy * result.ny > 0) player.vy = 0;
          }
        }
      }
    }

    doors.forEach(door => {
      if (door.open) return;
      const result = Algorithms.circleRect(player.circle, door.aabb);
      if (result.hit) {
        player.x += result.nx * result.depth;
        player.y += result.ny * result.depth;
        if (Math.abs(result.nx) > Math.abs(result.ny)) {
          if (player.vx * result.nx > 0) player.vx = 0;
        } else {
          if (player.vy * result.ny > 0) player.vy = 0;
        }
      }
    });

    player.x = Utils.clamp(player.x, pr, world.cols * ts - pr);
    player.y = Utils.clamp(player.y, pr, world.rows * ts - pr);
  }

  function _checkObstacleCollisions() {
    [...students, ...carts].forEach(obs => {
      const result = Algorithms.circleCircle(player.circle, obs.circle);
      if (result.hit) {
        if (player.invincible > 0) return;

        player.x -= result.nx * result.depth * 0.5;
        player.y -= result.ny * result.depth * 0.5;

        player.takeDamage();
      }
    });
  }

  function _resolveProfessorWalls(prof) {
    const ts = TILE_SIZE;
    const pr = prof.r;

    const col = Math.floor(prof.x / ts);
    const row = Math.floor(prof.y / ts);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const tc = col + dc;
        const tr = row + dr;

        if (tr < 0 || tr >= world.rows || tc < 0 || tc >= world.cols) continue;

        const tile = world.grid[tr][tc];
        const isWall = tile === world.TILE.WALL;

        if (!isWall) continue;

        const wallRect = { x: tc * ts, y: tr * ts, w: ts, h: ts };

        const result = Algorithms.circleRect(prof.circle, wallRect);
        if (result.hit) {

          prof.x += result.nx * result.depth;
          prof.y += result.ny * result.depth;
        }
      }
    }

    prof.x = Utils.clamp(prof.x, pr, world.cols * ts - pr);
    prof.y = Utils.clamp(prof.y, pr, world.rows * ts - pr);
  }

  function _checkProfessorObstacleCollisions(prof) {
    [...students, ...carts].forEach(obs => {
      const result = Algorithms.circleCircle(prof.circle, obs.circle);
      if (result.hit) {

        prof.x -= result.nx * result.depth * 0.7;
        prof.y -= result.ny * result.depth * 0.7;

        prof.recordCollision();
      }
    });
  }

  function _requestBFS() {
    const playerCell = Utils.pixelToGrid(player.x, player.y, TILE_SIZE);

    const bfsGrid = world.grid.map(row =>
      row.map(t => (t === world.TILE.WALL ? 1 : 0))
    );

    const result = Algorithms.bfs(
      bfsGrid,
      playerCell.col, playerCell.row,
      world.goalCol,  world.goalRow
    );

    bfsResult    = result;
    bfsAnimFrame = 0;
  }

  function draw() {
    if (!canvas || !ctx) return;

    const state = {
      world, player, students, carts, doors, powerups, professorAI,
      bfsResult, bfsAnimFrame,
      beaconTimer,
      time: beaconTimer

    };

    Renderer.drawFrame(ctx, canvas, state, debugMode);
  }

  function getTimeLeft()  { return timeLeft; }
  function getLives()     { return player ? player.lives : 0; }
  function hasCoffee()    { return player ? player.hasCoffee : false; }
  function hasFriend()    { return player ? player.hasFriend : false; }
  function getCoffeeTime(){ return player ? player.coffeeTimer : 0; }
  function getFriendTime(){ return player ? player.friendTimer : 0; }

  function toggleDebug() {
    debugMode = !debugMode;
    return debugMode;
  }

  function setRunning(v) { running = v; }
  function isRunning()   { return running; }

  function handleResize() {
    if (canvas) _resizeCanvas();
  }

  return {
    init, update, draw,
    getTimeLeft, getLives,
    hasCoffee, hasFriend, getCoffeeTime, getFriendTime,
    toggleDebug, setRunning, isRunning,
    handleResize
  };
})();
