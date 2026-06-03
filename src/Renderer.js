const Renderer = (() => {

  const C = {
    floor:      '#1a1d2e',
    floorAlt:   '#1c2033',
    wall:       '#0d0f1a',
    wallTop:    '#252a42',
    door:       '#8b6914',
    doorOpen:   '#5a4010',
    crowd:      'rgba(255, 100, 50, 0.12)',
    classroom:  '#1a3a1a',
    pathLine:   'rgba(78,205,196,0.75)',
    pathWave:   'rgba(78,205,196,0.18)',
    ring1:      'rgba(245,197,66,0.12)',
    ring2:      'rgba(245,197,66,0.07)',
    ring3:      'rgba(245,197,66,0.04)',
    debug:      'rgba(245,197,66,0.6)',
    debugRect:  'rgba(255,107,107,0.4)',
    debugCirc:  'rgba(78,205,196,0.4)',
  };

  let camX = 0;
  let camY = 0;

  function updateCamera(player, world, canvasW, canvasH) {
    const worldW = world.cols * world.tileSize;
    const worldH = world.rows * world.tileSize;
    camX = Utils.clamp(player.x - canvasW / 2, 0, Math.max(0, worldW - canvasW));
    camY = Utils.clamp(player.y - canvasH / 2, 0, Math.max(0, worldH - canvasH));
  }

  function drawFrame(ctx, canvas, state, debugMode) {
    const { world, player, students, carts, doors, powerups, professorAI, bfsResult, bfsAnimFrame } = state;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = C.wall;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camX, -camY);

    drawMap(ctx, world);
    drawDistanceRings(ctx, player, world);

    if (bfsResult && bfsResult.path.length > 0) {
      drawBFSOverlay(ctx, bfsResult, bfsAnimFrame, world.tileSize);
    }

    drawCrowdZones(ctx, world);
    drawClassroomBeacon(ctx, world, state.beaconTimer);
    drawPowerups(ctx, powerups);

    students.forEach(s => drawStudent(ctx, s));
    carts.forEach(c => drawCart(ctx, c));

    if (professorAI) {
      drawProfessor(ctx, professorAI);
    }

    doors.forEach(d => drawDoor(ctx, d, player));

    drawCoffeeTrail(ctx, player);

    drawPlayer(ctx, player, state.time);

    if (debugMode) {
      drawDebugOverlay(ctx, player, students, carts, doors, world);
    }

    ctx.restore();

    drawLightingOverlay(ctx, canvas, player, camX, camY);
  }

  function drawMap(ctx, world) {
    const { grid, cols, rows, tileSize, TILE } = world;
    const ts = tileSize;

    const startCol = Math.max(0, Math.floor(camX / ts) - 1);
    const endCol   = Math.min(cols, Math.ceil((camX + 2000) / ts) + 1);
    const startRow = Math.max(0, Math.floor(camY / ts) - 1);
    const endRow   = Math.min(rows, Math.ceil((camY + 1200) / ts) + 1);

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tile = grid[r][c];
        const px = c * ts;
        const py = r * ts;

        if (tile === TILE.WALL) {
          _drawWall(ctx, px, py, ts, c, r, grid, cols, rows);
        } else if (tile === TILE.FLOOR) {
          _drawFloor(ctx, px, py, ts, c, r);
        } else if (tile === TILE.DOOR) {
          _drawFloor(ctx, px, py, ts, c, r);

        } else if (tile === TILE.CLASSROOM) {
          _drawClassroomTile(ctx, px, py, ts);
        } else if (tile === TILE.CROWD) {
          _drawFloor(ctx, px, py, ts, c, r);
        }
      }
    }
  }

  function _drawFloor(ctx, px, py, ts, c, r) {

    const alt = (c + r) % 2 === 0;
    ctx.fillStyle = alt ? C.floor : C.floorAlt;
    ctx.fillRect(px, py, ts, ts);

    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(px, py, ts, ts);
  }

  function _drawWall(ctx, px, py, ts, c, r, grid, cols, rows) {

    ctx.fillStyle = C.wall;
    ctx.fillRect(px, py, ts, ts);

    const hasFloorBelow = r + 1 < rows && grid[r + 1][c] !== 1;
    if (hasFloorBelow) {
      ctx.fillStyle = C.wallTop;
      ctx.fillRect(px, py, ts, ts * 0.22);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(px + 2, py + 3, ts - 4, 2);
    ctx.fillRect(px + 2, py + ts / 2, ts - 4, 2);
  }

  function _drawClassroomTile(ctx, px, py, ts) {
    ctx.fillStyle = C.classroom;
    ctx.fillRect(px, py, ts, ts);

    ctx.strokeStyle = 'rgba(105,240,174,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
  }

  function drawClassroomBeacon(ctx, world, beaconTimer) {
    const { goalCol, goalRow, tileSize: ts } = world;
    const cx = goalCol * ts + ts / 2;
    const cy = goalRow * ts + ts / 2;

    const pulse = 1 + 0.25 * Math.sin(beaconTimer * 4);
    const r = ts * 0.42 * pulse;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
    grad.addColorStop(0, 'rgba(105,240,174,0.35)');
    grad.addColorStop(0.5, 'rgba(105,240,174,0.1)');
    grad.addColorStop(1, 'rgba(105,240,174,0)');

    ctx.save();
    ctx.translate(cx, cy);

    ctx.scale(pulse, pulse);

    ctx.translate(-cx, -cy);

    ctx.beginPath();
    ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.font = `${Math.round(ts * 0.55)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎓', cx, cy);

    ctx.restore();
  }

  function drawCrowdZones(ctx, world) {
    const { grid, cols, rows, tileSize: ts, TILE } = world;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === TILE.CROWD) {
          const px = c * ts;
          const py = r * ts;
          ctx.fillStyle = C.crowd;
          ctx.fillRect(px, py, ts, ts);
          ctx.fillStyle = 'rgba(255,150,50,0.08)';
          ctx.fillRect(px, py, ts, ts);

          ctx.font = `${Math.round(ts * 0.45)}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('👥', px + ts / 2, py + ts / 2);
        }
      }
    }
  }

  function drawPowerups(ctx, powerups) {
    powerups.forEach(pu => {
      if (pu.collected) return;
      const { x, drawY: y, r, type, bobTimer } = pu;

      const pulse = 1 + 0.15 * Math.sin(bobTimer * 3);

      const glowSize = r * 2.2 * pulse;
      const gcolor = type === 'coffee' ? 'rgba(245,197,66,' : 'rgba(78,205,196,';
      const grad = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
      grad.addColorStop(0, gcolor + '0.5)');
      grad.addColorStop(1, gcolor + '0)');
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.translate(-x, -y);

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = type === 'coffee' ? 'rgba(245,197,66,0.25)' : 'rgba(78,205,196,0.25)';
      ctx.fill();
      ctx.strokeStyle = type === 'coffee' ? '#f5c542' : '#4ecdc4';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      const ts = pu.tileSize;
      ctx.font = `${Math.round(ts * 0.4)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(type === 'coffee' ? '☕' : '👥', x, y);
    });
  }

  function drawStudent(ctx, s) {

    Utils.drawTransformed(ctx, (c) => {
      const r = s.r;

      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fillStyle = s.color;
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)';
      c.lineWidth = 1;
      c.stroke();

      c.fillStyle = '#222';
      c.beginPath(); c.arc(r * 0.3, -r * 0.2, r * 0.15, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.3,  r * 0.2, r * 0.15, 0, Math.PI * 2); c.fill();

      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(-r * 0.5, -r * 0.4, r * 0.35, r * 0.8);

    }, s.x, s.y, s.angle, 1, 1);
  }

  function drawCart(ctx, cart) {
    Utils.drawTransformed(ctx, (c) => {
      const r = cart.r;

      c.fillStyle = '#aaa';
      c.fillRect(-r, -r * 0.7, r * 2, r * 1.4);

      c.strokeStyle = '#777';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-r, -r * 0.7);
      c.lineTo(-r * 1.3, -r * 1.3);
      c.stroke();

      c.fillStyle = '#5af';
      c.fillRect(-r * 0.4, -r * 1.1, r * 0.8, r * 0.5);

      c.fillStyle = '#555';
      c.beginPath(); c.arc(-r * 0.6, r * 0.7, r * 0.22, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc( r * 0.6, r * 0.7, r * 0.22, 0, Math.PI * 2); c.fill();

      c.strokeStyle = 'rgba(245,197,66,0.7)';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke();

    }, cart.x, cart.y, cart.angle, 1, 1);
  }

  function drawProfessor(ctx, prof) {
    const bob = Math.sin(prof.bobTimer) * (prof.r * 0.08);

    Utils.drawTransformed(ctx, (c) => {
      const r = prof.r;

      const bodyGrad = c.createRadialGradient(0, -r * 0.2, 0, 0, 0, r);
      bodyGrad.addColorStop(0, '#e8cbb5');
      bodyGrad.addColorStop(1, '#d4a574');
      c.beginPath();
      c.arc(0, bob, r, 0, Math.PI * 2);
      c.fillStyle = bodyGrad;
      c.fill();

      c.fillStyle = '#2c2c2c';
      c.fillRect(-r * 0.6, -r * 0.4 + bob, r * 0.5, r * 0.85);

      c.fillStyle = '#c41e3a';
      c.fillRect(-r * 0.15, -r * 0.3 + bob, r * 0.3, r * 0.5);

      c.fillStyle = '#fff';
      c.beginPath(); c.arc(r * 0.25, -r * 0.15 + bob, r * 0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.25,  r * 0.15 + bob, r * 0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1d2e';
      c.beginPath(); c.arc(r * 0.35, -r * 0.15 + bob, r * 0.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.35,  r * 0.15 + bob, r * 0.1, 0, Math.PI * 2); c.fill();

      c.strokeStyle = 'rgba(105,240,174,0.6)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, bob, r + 2 + Math.sin(prof.bobTimer * 2) * 2, 0, Math.PI * 2);
      c.stroke();

    }, prof.x, prof.y, prof.angle, 1, 1);
  }

  function drawDoor(ctx, door, player) {
    if (door.open) return;

    const { x, y, w, h } = door.aabb;

    ctx.fillStyle = door.progress > 0 ? '#6b4f12' : C.door;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 2);
    ctx.lineTo(x + w / 2, y + h - 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + w * 0.7, y + h / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f5c542';
    ctx.fill();

    if (door.progress > 0) {
      ctx.fillStyle = 'rgba(105,240,174,0.3)';
      ctx.fillRect(x, y + h - 5, w * door.progress, 5);
      ctx.fillStyle = '#69f0ae';
      ctx.fillRect(x, y + h - 5, w * door.progress, 3);
    }

    const pdx = player.x - (x + w / 2);
    const pdy = player.y - (y + h / 2);
    const dist = Math.sqrt(pdx * pdx + pdy * pdy);
    if (dist < door.tileSize * 2) {
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('HOLD SPACE', x + w / 2, y - 6);
    }
  }

  function drawCoffeeTrail(ctx, player) {
    player.trail.forEach((t, i) => {
      const size = player.r * 0.5 * t.alpha;
      ctx.save();
      ctx.globalAlpha = t.alpha * 0.7;
      ctx.fillStyle = '#f5c542';
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawPlayer(ctx, player, time) {
    const bob = Math.sin(player.bobTimer) * (player.r * 0.06);

    if (player.invincible > 0 && Math.floor(player.invincible * 8) % 2 === 0) {
      return;

    }

    Utils.drawTransformed(ctx, (c) => {
      const r = player.r;
      const s = player.scale;

      c.scale(s, s);

      const bodyGrad = c.createRadialGradient(0, -r * 0.2, 0, 0, 0, r);
      bodyGrad.addColorStop(0, '#a0d8ef');
      bodyGrad.addColorStop(1, '#3a7fc1');
      c.beginPath();
      c.arc(0, bob, r, 0, Math.PI * 2);
      c.fillStyle = bodyGrad;
      c.fill();

      c.fillStyle = '#1e5a9e';
      c.fillRect(-r * 0.55, -r * 0.5 + bob, r * 0.45, r);

      c.strokeStyle = 'rgba(255,255,255,0.3)';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-r*0.5, bob); c.lineTo(r*0.5, bob); c.stroke();

      c.fillStyle = '#fff';
      c.beginPath(); c.arc(r * 0.35, -r*0.15 + bob, r*0.2, 0, Math.PI*2); c.fill();
      c.beginPath(); c.arc(r * 0.35,  r*0.15 + bob, r*0.2, 0, Math.PI*2); c.fill();
      c.fillStyle = '#1a1d2e';
      c.beginPath(); c.arc(r*0.45, -r*0.15 + bob, r*0.1, 0, Math.PI*2); c.fill();
      c.beginPath(); c.arc(r*0.45,  r*0.15 + bob, r*0.1, 0, Math.PI*2); c.fill();

      if (player.hasCoffee) {
        c.strokeStyle = 'rgba(245,197,66,0.8)';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, bob, r + 3 + 2 * Math.sin(time * 8), 0, Math.PI * 2);
        c.stroke();
      }

      if (player.hasFriend) {
        c.strokeStyle = 'rgba(78,205,196,0.7)';
        c.lineWidth = 2;
        c.setLineDash([3, 3]);
        c.beginPath();
        c.arc(0, bob, r + 4, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
      }

    }, player.x, player.y, player.angle, 1, 1);
  }

  function drawBFSOverlay(ctx, bfsResult, animFrame, tileSize) {
    const ts = tileSize;
    const half = ts / 2;

    const visCount = Math.floor(bfsResult.visited.length * Math.min(1, animFrame * 3));
    bfsResult.visited.slice(0, visCount).forEach(({ col, row }) => {
      const px = col * ts + half;
      const py = row * ts + half;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, half);
      grad.addColorStop(0, C.pathWave);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, half * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });

    const path = bfsResult.path;
    if (path.length < 2) return;

    const segCount = Math.floor((path.length - 1) * Math.min(1, animFrame * 2));

    ctx.save();
    ctx.strokeStyle = C.pathLine;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -animFrame * 20;

    ctx.beginPath();
    ctx.moveTo(path[0].col * ts + half, path[0].row * ts + half);
    for (let i = 1; i <= segCount; i++) {
      ctx.lineTo(path[i].col * ts + half, path[i].row * ts + half);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 1; i <= segCount; i += 3) {
      const px = path[i].col * ts + half;
      const py = path[i].row * ts + half;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#4ecdc4';
      ctx.fill();
    }

    ctx.restore();
  }

  function drawDistanceRings(ctx, player, world) {
    const { goalCol, goalRow, tileSize: ts } = world;

    const goalX = goalCol * ts + ts / 2;
    const goalY = goalRow * ts + ts / 2;
    const distance = Utils.dist(player.x, player.y, goalX, goalY);

    const ringScale = Math.min(1, distance / (ts * 10));

    [C.ring1, C.ring2, C.ring3].forEach((color, i) => {
      const r = (i + 1) * ts * 1.5 * ringScale + ts * 0.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function drawDebugOverlay(ctx, player, students, carts, doors, world) {
    ctx.save();
    ctx.lineWidth = 1;

    ctx.strokeStyle = C.debugRect;
    const pa = player.aabb;
    ctx.strokeRect(pa.x, pa.y, pa.w, pa.h);

    ctx.strokeStyle = C.debugCirc;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = C.debug;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + player.vx * 0.15, player.y + player.vy * 0.15);
    ctx.stroke();

    const headAngle = Math.atan2(player.vy, player.vx);
    const headLen = 8;
    if (player.vx !== 0 || player.vy !== 0) {
      const ex = player.x + player.vx * 0.15;
      const ey = player.y + player.vy * 0.15;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(headAngle - 0.4), ey - headLen * Math.sin(headAngle - 0.4));
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(headAngle + 0.4), ey - headLen * Math.sin(headAngle + 0.4));
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(245,197,66,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 6, 0, player.angle);
    ctx.stroke();

    students.forEach(s => {
      ctx.strokeStyle = C.debugCirc;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    });

    carts.forEach(c => {
      ctx.strokeStyle = C.debugRect;
      ctx.lineWidth = 1;
      const a = c.aabb;
      ctx.strokeRect(a.x, a.y, a.w, a.h);
    });

    doors.forEach(d => {
      if (d.open) return;
      ctx.strokeStyle = 'rgba(139,105,20,0.6)';
      ctx.lineWidth = 1;
      const a = d.aabb;
      ctx.strokeRect(a.x, a.y, a.w, a.h);
    });

    const gx = world.goalCol * world.tileSize + world.tileSize / 2;
    const gy = world.goalRow * world.tileSize + world.tileSize / 2;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(105,240,174,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = C.debug;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`pos: (${Math.round(player.x)}, ${Math.round(player.y)})`, player.x + player.r + 4, player.y - 10);
    ctx.fillText(`vel: (${Math.round(player.vx)}, ${Math.round(player.vy)})`, player.x + player.r + 4, player.y);
    ctx.fillText(`angle: ${(player.angle * 180 / Math.PI).toFixed(1)}°`, player.x + player.r + 4, player.y + 10);

    ctx.restore();
  }

  function drawLightingOverlay(ctx, canvas, player, camX, camY) {

    const screenX = player.x - camX;
    const screenY = player.y - camY;

    const lightRadius = canvas.height * 0.35;

    const grad = ctx.createRadialGradient(
      screenX, screenY, 0,
      screenX, screenY, lightRadius * 1.5
    );

    grad.addColorStop(0, 'rgba(0, 0, 0, 0.0)');

    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');

    grad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  return { updateCamera, drawFrame };
})();
