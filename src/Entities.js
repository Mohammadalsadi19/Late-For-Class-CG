const PROFESSORS = [
  {
    name: 'Prof. yazan',
    type: 'strict',
    emoji: '😠',
    time: 60,
    startMsg: '"You have 60 seconds. Not. A. Moment. More."',
    winMsg:  '"Barely acceptable. Do not make a habit of this."',
    loseMsg: '"I expected nothing less from you."',
  },
  {
    name: 'Prof. yazan',
    type: 'normal',
    emoji: '🧐',
    time: 90,
    startMsg: '"Try to be on time, would you? The door closes at the bell."',
    winMsg:  '"Good. Now sit down and stop panting."',
    loseMsg: '"Well… these things happen. Set an alarm next time."',
  },
  {
    name: 'Prof. yazan',
    type: 'friendly',
    emoji: '😄',
    time: 120,
    startMsg: '"Yalla, habibi! Take your time, the door is always open for you!"',
    winMsg:  '"Ahlan wa sahlan! I saved you the front row seat!"',
    loseMsg: '"Come early next time, I will make you tea!"',
  }
];

function pickProfessor() {
  return Utils.pick(PROFESSORS);
}

class Player {

  constructor(x, y, tileSize) {
    this.x = x;
    this.y = y;
    this.r = tileSize * 0.35;

    this.vx = 0;
    this.vy = 0;
    this.speed = 160;

    this.lives = 3;
    this.angle = 0;

    this.scale = 1;

    this.coffeeTimer  = 0;
    this.friendTimer  = 0;

    this.invincible   = 0;

    this.trail = [];

    this.bobTimer = 0;

    this.scaleTimer = 0;

  }

  get speedMultiplier() {
    return this.coffeeTimer > 0 ? 1.8 : 1;
  }

  get hasCoffee()  { return this.coffeeTimer > 0; }
  get hasFriend()  { return this.friendTimer > 0; }

  update(dt, input) {

    if (this.coffeeTimer > 0)  this.coffeeTimer  = Math.max(0, this.coffeeTimer  - dt);
    if (this.friendTimer > 0)  this.friendTimer  = Math.max(0, this.friendTimer  - dt);
    if (this.invincible > 0)   this.invincible   = Math.max(0, this.invincible   - dt);
    if (this.scaleTimer > 0)   this.scaleTimer   = Math.max(0, this.scaleTimer   - dt);

    if (this.scaleTimer > 0) {
      this.scale = 1 + 0.3 * Math.sin((1 - this.scaleTimer / 0.4) * Math.PI);
    } else {
      this.scale = 1;
    }

    let dx = 0;
    let dy = 0;
    if (input.up)    dy -= 1;
    if (input.down)  dy += 1;
    if (input.left)  dx -= 1;
    if (input.right) dx += 1;

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    const spd = this.speed * this.speedMultiplier;
    this.vx = dx * spd;
    this.vy = dy * spd;

    if (dx !== 0 || dy !== 0) {
      this.angle = Math.atan2(dy, dx);

    }

    if (dx !== 0 || dy !== 0) {
      this.bobTimer += dt * 8;
    }

    if (this.hasCoffee && (dx !== 0 || dy !== 0)) {
      this.trail.push({ x: this.x, y: this.y, alpha: 0.6 });
      if (this.trail.length > 14) this.trail.shift();
    } else if (!this.hasCoffee) {
      this.trail = [];
    }

    this.trail.forEach(t => { t.alpha -= dt * 1.5; });
    this.trail = this.trail.filter(t => t.alpha > 0);
  }

  integrate(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  takeDamage() {
    if (this.invincible > 0) return false;
    this.lives = Math.max(0, this.lives - 1);
    this.invincible = 1.5;

    return true;
  }

  activateCoffee() {
    this.coffeeTimer = 8;
    this.scaleTimer  = 0.4;
  }

  activateFriend() {
    this.friendTimer = 5;
    this.scaleTimer  = 0.4;
  }

  get aabb() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
  }

  get circle() {
    return { cx: this.x, cy: this.y, r: this.r };
  }
}

class Obstacle {
  constructor(x, y, r) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.angle = 0;
    this.active = true;
  }
  get circle() { return { cx: this.x, cy: this.y, r: this.r }; }
  get aabb()   { return { x: this.x - this.r, y: this.y - this.r, w: this.r*2, h: this.r*2 }; }
  update(_dt, _world) {}
}

class Student extends Obstacle {

  constructor(x, y, tileSize) {
    super(x, y, tileSize * 0.30);
    this.tileSize   = tileSize;
    this.speed      = Utils.randFloat(30, 55);
    this.vx         = 0;
    this.vy         = 0;
    this.dirTimer   = 0;

    this.type       = 'student';
    this.color      = Utils.pick(['#e8a87c','#a8d8ea','#c8b8e8','#f8e0a0','#b8e0b8']);
    this._pickDir();
  }

  _pickDir() {
    const angle = Utils.randFloat(0, Math.PI * 2);
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.angle = angle;
    this.dirTimer = Utils.randFloat(1.0, 2.5);
  }

  update(dt, world) {
    this.dirTimer -= dt;
    if (this.dirTimer <= 0) this._pickDir();

    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    const col = Math.floor(nx / world.tileSize);
    const row = Math.floor(ny / world.tileSize);

    if (
      row < 0 || row >= world.rows ||
      col < 0 || col >= world.cols ||
      world.grid[row][col] === world.TILE.WALL
    ) {

      this._pickDir();
    } else {
      this.x = nx;
      this.y = ny;
    }
  }
}

class Cart extends Obstacle {

  constructor(x, y, tileSize, patrolPath) {
    super(x, y, tileSize * 0.38);
    this.tileSize   = tileSize;
    this.patrolPath = patrolPath || [];
    this.pathIndex  = 0;
    this.speed      = Utils.randFloat(40, 65);
    this.type       = 'cart';
  }

  update(dt, world) {
    if (this.patrolPath.length < 2) return;

    const target = this.patrolPath[this.pathIndex];
    const tx = target.col * world.tileSize + world.tileSize / 2;
    const ty = target.row * world.tileSize + world.tileSize / 2;

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 3) {

      this.pathIndex = (this.pathIndex + 1) % this.patrolPath.length;
    } else {

      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
      this.angle = Math.atan2(dy, dx);
    }
  }
}

class Door {

  constructor(col, row, tileSize) {
    this.col      = col;
    this.row      = row;
    this.tileSize = tileSize;
    this.x        = col * tileSize;
    this.y        = row * tileSize;
    this.w        = tileSize;
    this.h        = tileSize;
    this.open     = false;
    this.progress = 0;

    this.openTime = 1.5;

    this.type     = 'door';
  }

  get aabb() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update(dt, playerNear, spaceHeld) {
    if (this.open) return;

    if (playerNear && spaceHeld) {
      this.progress += dt / this.openTime;
      if (this.progress >= 1) {
        this.progress = 1;
        this.open     = true;
      }
    } else {

      this.progress = Math.max(0, this.progress - dt * 0.5);
    }
  }
}

class Powerup {
  constructor(col, row, type, tileSize) {
    this.col       = col;
    this.row       = row;
    this.type      = type;

    this.tileSize  = tileSize;
    this.x         = col * tileSize + tileSize / 2;
    this.y         = row * tileSize + tileSize / 2;
    this.r         = tileSize * 0.28;
    this.collected = false;
    this.bobTimer  = Utils.randFloat(0, Math.PI * 2);

  }

  get aabb() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r*2, h: this.r*2 };
  }

  update(dt) {
    this.bobTimer += dt * 2.5;
  }

  get drawY() {
    return this.y + Math.sin(this.bobTimer) * 3;
  }
}

class ProfessorAI {

  constructor(x, y, tileSize, goalCol, goalRow) {
    this.x = x;
    this.y = y;
    this.r = tileSize * 0.32;
    this.tileSize = tileSize;
    this.goalCol = goalCol;
    this.goalRow = goalRow;

    this.vx = 0;
    this.vy = 0;
    this.speed = 78;

    this.angle = 0;
    this.type = 'professor';
    this.color = '#d4a574';

    this.currentPath = [];
    this.pathIndex = 0;
    this.lastPathCalc = 0;
    this.pathRecalcInterval = 4.0;

    this.bobTimer = 0;

    this.collisionTimer = 0;

    this.currentWaypoint = null;
    this.waypointTimer = 0;

    this.hesitationTime = Utils.randFloat(1.0, 2.5);

    this.pathRandomness = 0.45;

  }

  get circle() { return { cx: this.x, cy: this.y, r: this.r }; }
  get aabb() { return { x: this.x - this.r, y: this.y - this.r, w: this.r*2, h: this.r*2 }; }

  update(dt, world) {
    this.lastPathCalc += dt;

    if (this.lastPathCalc >= this.pathRecalcInterval) {
      this.lastPathCalc = 0;
      this._recalculatePath(world);
    }

    const profCell = Utils.pixelToGrid(this.x, this.y, world.tileSize);
    if (
      profCell.row >= 0 && profCell.row < world.rows &&
      profCell.col >= 0 && profCell.col < world.cols &&
      world.grid[profCell.row][profCell.col] === world.TILE.CROWD
    ) {

      this.speed = 78 * 0.30;

    } else {
      this.speed = 78;
    }

    if (this.collisionTimer > 0) {
      this.collisionTimer = Math.max(0, this.collisionTimer - dt);
    }

    if (this.waypointTimer > 0) {
      this.waypointTimer -= dt;
      if (this.waypointTimer <= 0) {
        this.currentWaypoint = null;
      }
    }

    if (this.currentPath.length > 0 && this.pathIndex < this.currentPath.length) {
      const nextCell = this.currentPath[this.pathIndex];
      const targetX = nextCell.col * world.tileSize + world.tileSize / 2;
      const targetY = nextCell.row * world.tileSize + world.tileSize / 2;

      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 8) {
        if (this.waypointTimer <= 0 && this.currentWaypoint !== this.pathIndex) {
          this.currentWaypoint = this.pathIndex;
          this.waypointTimer = this.hesitationTime;

          this.hesitationTime = Utils.randFloat(0.8, 1.8);

        }
        this.pathIndex++;
      } else {

        const speedMult = this.collisionTimer > 0 ? 0.15 : 1.0;

        const moveX = (dx / dist) * this.speed * dt * speedMult;
        const moveY = (dy / dist) * this.speed * dt * speedMult;
        this.x += moveX;
        this.y += moveY;
        this.angle = Math.atan2(dy, dx);
      }
    }

    this.bobTimer += dt * 6;

    const bounds = world.tileSize * 0.4;
    this.x = Utils.clamp(this.x, bounds, world.cols * world.tileSize - bounds);
    this.y = Utils.clamp(this.y, bounds, world.rows * world.tileSize - bounds);
  }

  _recalculatePath(world) {
    const profCol = Math.floor(this.x / world.tileSize);
    const profRow = Math.floor(this.y / world.tileSize);

    const bfsGrid = world.grid.map(row =>
      row.map(t => (t === world.TILE.WALL ? 1 : 0))
    );

    const result = Algorithms.bfs(
      bfsGrid,
      profCol, profRow,
      this.goalCol, this.goalRow
    );

    if (Math.random() < this.pathRandomness && result.path.length > 3) {

      const randomVisited = Utils.pick(result.visited);
      if (randomVisited) {

        const detourResult = Algorithms.bfs(
          bfsGrid,
          randomVisited.col, randomVisited.row,
          this.goalCol, this.goalRow
        );
        if (detourResult.path.length > 0) {
          this.currentPath = [
            { col: profCol, row: profRow },
            ...result.path.slice(0, Math.floor(result.path.length * 0.4)),
            ...detourResult.path
          ];
        } else {
          this.currentPath = result.path;
        }
      } else {
        this.currentPath = result.path;
      }
    } else {
      this.currentPath = result.path;
    }

    this.pathIndex = 0;
  }

  recordCollision() {
    this.collisionTimer = 2.0;

  }

  hasReachedGoal(world) {
    const goalX = this.goalCol * world.tileSize + world.tileSize / 2;
    const goalY = this.goalRow * world.tileSize + world.tileSize / 2;
    const dist = Utils.dist(this.x, this.y, goalX, goalY);
    return dist < world.tileSize * 0.7;
  }
}
