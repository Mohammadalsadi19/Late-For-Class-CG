
const Events = (() => {

  const EVENT_TYPES = {
    CLUB_FAIR:    'club_fair',
    MAINTENANCE:  'maintenance',
    ELEVATOR_OUT: 'elevator_out',
    QUIET_DAY:    'quiet_day',
    EXAM_WEEK:    'exam_week',
  };

  const EVENT_DATA = {
    club_fair: {
      name: 'Club Fair',
      description: 'A student club fair is taking place. Some hallways are crowded.',
      emoji: '🎪',
      color: '#4ecdc4',
    },
    maintenance: {
      name: 'Maintenance Work',
      description: 'Maintenance staff are working. Some corridors are busier.',
      emoji: '🔨',
      color: '#ff6b6b',
    },
    elevator_out: {
      name: 'Elevator Out of Service',
      description: 'The elevator is unavailable. Expect detours.',
      emoji: '🚫',
      color: '#f5c542',
    },
    quiet_day: {
      name: 'Quiet Day',
      description: 'The campus is unusually calm. Campus traffic is low.',
      emoji: '🤫',
      color: '#69f0ae',
    },
    exam_week: {
      name: 'Exam Week',
      description: 'Students are rushing between exams. Hallways are busier.',
      emoji: '📚',
      color: '#ff9ff3',
    },
  };

  function pickRandomEvent() {
    const keys = Object.values(EVENT_TYPES);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  function getEventData(eventType) {
    return EVENT_DATA[eventType] || null;
  }

  function applyEvent(eventType, world) {
    switch (eventType) {
      case EVENT_TYPES.CLUB_FAIR:    _applyClubFair(world);    break;
      case EVENT_TYPES.MAINTENANCE:  _applyMaintenance(world); break;
      case EVENT_TYPES.ELEVATOR_OUT: _applyElevatorOut(world); break;
      case EVENT_TYPES.QUIET_DAY:    _applyQuietDay(world);    break;
      case EVENT_TYPES.EXAM_WEEK:    _applyExamWeek(world);    break;
    }
  }

  function _getFreeTiles(world, minDist) {
    const tiles = [];
    for (let r = 1; r < world.rows - 1; r++) {
      for (let c = 1; c < world.cols - 1; c++) {
        if (world.grid[r][c] !== world.TILE.FLOOR) continue;
        if (Utils.manhattan(c, r, world.spawnCol, world.spawnRow) < minDist) continue;
        if (Utils.manhattan(c, r, world.goalCol,  world.goalRow)  < minDist) continue;
        tiles.push({ col: c, row: r });
      }
    }
    return Utils.shuffle(tiles);
  }

  
  function _isStillConnected(world) {
    const g = world.grid.map(row => row.map(t => (t === world.TILE.WALL ? 1 : 0)));
    const { path } = Algorithms.bfs(g, world.spawnCol, world.spawnRow, world.goalCol, world.goalRow);
    return path.length > 0;
  }


  function _applyClubFair(world) {
    const tiles = _getFreeTiles(world, 5);
    const count = Math.min(4, tiles.length);
    for (let i = 0; i < count; i++) {
      world.obstacleSeeds.push({ col: tiles[i].col, row: tiles[i].row, type: 'student' });
    }
  }

  function _applyMaintenance(world) {
    const tiles = _getFreeTiles(world, 6);
    for (const tile of tiles.slice(0, 30)) {
      world.grid[tile.row][tile.col] = world.TILE.WALL;
      if (_isStillConnected(world)) return; 
      world.grid[tile.row][tile.col] = world.TILE.FLOOR; 
    }
   
    if (tiles.length > 0) {
      world.obstacleSeeds.push({ col: tiles[0].col, row: tiles[0].row, type: 'cart' });
    }
  }

  function _applyElevatorOut(world) {
    for (const tile of tiles.slice(0, 30)) {
      world.grid[tile.row][tile.col] = world.TILE.WALL;
      if (_isStillConnected(world)) return;
      world.grid[tile.row][tile.col] = world.TILE.FLOOR;
    }
    const count = Math.min(2, tiles.length);
    for (let i = 0; i < count; i++) {
      world.obstacleSeeds.push({ col: tiles[i].col, row: tiles[i].row, type: 'student' });
    }
  }

  function _applyQuietDay(world) {
    const removeCount = Math.max(0, Math.floor(world.obstacleSeeds.length * 0.3));
    for (let i = 0; i < removeCount; i++) {
      const idx = world.obstacleSeeds.findIndex(s => s.type === 'student');
      if (idx !== -1) world.obstacleSeeds.splice(idx, 1);
    }
  }

  function _applyExamWeek(world) {
    const tiles = _getFreeTiles(world, 4);
    const count = Math.min(6, tiles.length);
    for (let i = 0; i < count; i++) {
      world.obstacleSeeds.push({ col: tiles[i].col, row: tiles[i].row, type: 'student' });
    }
  }

  return { pickRandomEvent, getEventData, applyEvent };
})();