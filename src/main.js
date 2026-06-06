(function () {

  const screens = {
    menu:      document.getElementById('screen-menu'),
    professor: document.getElementById('screen-professor'),
    game:      document.getElementById('screen-game'),
    pause:     document.getElementById('screen-pause'),
    win:       document.getElementById('screen-win'),
    lose:      document.getElementById('screen-lose'),
  };

  const canvas = document.getElementById('gameCanvas');

  const hudLives   = document.getElementById('hud-lives');
  const hudTimer   = document.getElementById('hud-timer');
  const hudProfMsg = document.getElementById('hud-prof-msg');
  const hudPowerup = document.getElementById('hud-powerup');
  const debugBadge = document.getElementById('overlay-debug');
  const eventNotif = document.getElementById('event-notification'); // может быть null

 
  const profAvatar  = document.getElementById('prof-avatar');
  const profName    = document.getElementById('prof-name');
  const profType    = document.getElementById('prof-type');
  const profMessage = document.getElementById('prof-message');
  const profTime    = document.getElementById('prof-time');

 
  const winMessage  = document.getElementById('win-message');
  const winStats    = document.getElementById('win-stats');
  const loseTitle   = document.getElementById('lose-title');
  const loseMessage = document.getElementById('lose-message');
  const loseReason  = document.getElementById('lose-reason');

  
  const difficultyButtons = document.querySelectorAll('.difficulty-btn');

  
  const input = { up:false, down:false, left:false, right:false, space:false };

  const KEY_MAP = {
    'ArrowUp':'up',   'w':'up',
    'ArrowDown':'down','s':'down',
    'ArrowLeft':'left','a':'left',
    'ArrowRight':'right','d':'right',
    ' ':'space',
  };

  document.addEventListener('keydown', e => {
    const key    = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const action = KEY_MAP[key];
    if (action) {
      input[action] = true;
      if (isInGame()) e.preventDefault();
    }

   
    if (key === 'g' && isInGame()) {
      const on = Game.toggleDebug();
      debugBadge.classList.toggle('hidden', !on);
    }

   
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && isInGame() && Game.isRunning()) {
      showScreen('pause');
      Game.setRunning(false);
    }
  });

  document.addEventListener('keyup', e => {
    const key    = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const action = KEY_MAP[key];
    if (action) { input[action] = false; }
  });

  function isInGame() {
    return screens.game.classList.contains('active');
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  function _getDifficulty(level) {
    const settings = {
      easy: {
        level:'easy',   label:'Easy',   timeScale:1.25, playerSpeedScale:1.04, obstacleSpeedScale:0.85,
        moodClass:'friendly', moodEmoji:'😄', moodLabel:'HAPPY',
      },
      normal: {
        level:'normal', label:'Normal', timeScale:1,    playerSpeedScale:1,    obstacleSpeedScale:1,
        moodClass:'normal',   moodEmoji:'😐', moodLabel:'HALF MOOD',
      },
      hard: {
        level:'hard',   label:'Hard',   timeScale:0.85, playerSpeedScale:0.98, obstacleSpeedScale:1.12,
        moodClass:'strict',   moodEmoji:'😠', moodLabel:'ANGRY',
      },
    };
    return settings[level] || settings.normal;
  }

  let selectedDifficulty = _getDifficulty('normal');

  difficultyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDifficulty = _getDifficulty(btn.dataset.difficulty);
      difficultyButtons.forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  let currentProfessor = null;

  document.getElementById('btn-play').addEventListener('click', () => {
    currentProfessor = pickProfessor();
    _showProfessorScreen(currentProfessor);
    showScreen('professor');
  });

  document.getElementById('btn-go').addEventListener('click', () => _startGame(currentProfessor));

  document.getElementById('btn-pause').addEventListener('click', () => {
    if (Game.isRunning()) { showScreen('pause'); Game.setRunning(false); }
  });

  document.getElementById('btn-resume').addEventListener('click', () => {
    showScreen('game'); Game.setRunning(true);
  });

  document.getElementById('btn-quit').addEventListener('click', () => {
    Game.setRunning(false); showScreen('menu');
  });

  document.getElementById('btn-win-again').addEventListener('click', () => {
    currentProfessor = pickProfessor();
    _showProfessorScreen(currentProfessor);
    showScreen('professor');
  });
  document.getElementById('btn-win-menu').addEventListener('click', () => showScreen('menu'));

  document.getElementById('btn-lose-again').addEventListener('click', () => {
    currentProfessor = pickProfessor();
    _showProfessorScreen(currentProfessor);
    showScreen('professor');
  });
  document.getElementById('btn-lose-menu').addEventListener('click', () => showScreen('menu'));

  function _showProfessorScreen(prof) {
    const mood = selectedDifficulty;
    profAvatar.textContent  = mood.moodEmoji;
    profName.textContent    = prof.name;
    profType.textContent    = mood.moodLabel;
    profType.className      = 'prof-type-badge ' + mood.moodClass;
    profMessage.textContent = prof.startMsg;
    profTime.textContent    = `Time allowed: ${Math.round(prof.time * mood.timeScale)}s (${mood.label})`;
  }

  function _startGame(prof) {
    showScreen('game');
    debugBadge.classList.add('hidden');

    Game.init(canvas, prof, selectedDifficulty,
   
      stats => {
        showScreen('win');
        winMessage.textContent = prof.winMsg;
        winStats.innerHTML = `
          <span>Time remaining</span><span>${Utils.formatTime(stats.timeLeft)}</span>
          <span>Lives left</span>    <span>${'❤️'.repeat(stats.lives)}</span>
          <span>Professor</span>     <span>${prof.name}</span>
        `;
      },
   
      reason => {
        showScreen('lose');
        loseMessage.textContent = prof.loseMsg;
        if (reason === 'time') {
          loseTitle.textContent  = 'YOU WERE LATE!';
          loseReason.textContent = 'TIME RAN OUT';
        } else if (reason === 'professor') {
          loseTitle.textContent  = 'THE PROFESSOR GOT THERE FIRST!';
          loseReason.textContent = 'BETTER LUCK NEXT TIME';
        } else {
          loseTitle.textContent  = 'YOU GAVE UP!';
          loseReason.textContent = 'NO LIVES LEFT';
        }
      }
    );

    _showEventNotification();
    hudProfMsg.textContent = prof.name + ' — ' + prof.startMsg;
    if (!loopRunning) startLoop();
  }

  function _showEventNotification() {
    if (!eventNotif) return;                     
    const event     = Game.getActiveEvent();
    const eventData = event ? Events.getEventData(event) : null;
    if (!eventData) return;

    eventNotif.innerHTML = `
      <div class="event-notif-content">
        <span class="event-emoji">${eventData.emoji}</span>
        <div class="event-text">
          <div class="event-name">${eventData.name}</div>
          <div class="event-desc">${eventData.description}</div>
        </div>
      </div>
    `;
    eventNotif.classList.add('show');
    setTimeout(() => eventNotif.classList.remove('show'), 3500);
  }

  function _updateHUD() {
    const lives = Game.getLives();
    let livesHTML = '';
    for (let i = 0; i < 3; i++)
      livesHTML += i < lives ? '❤️' : '<span style="opacity:.25">🖤</span>';
    hudLives.innerHTML = livesHTML;

    const t = Game.getTimeLeft();
    hudTimer.textContent = Utils.formatTime(t);
    hudTimer.classList.toggle('urgent', t < 15);

    if (Game.hasCoffee()) {
      hudPowerup.textContent = `☕ ${Game.getCoffeeTime().toFixed(1)}s`;
      hudPowerup.className   = 'hud-powerup coffee';
    } else if (Game.hasFriend()) {
      hudPowerup.textContent = `👥 PATH ${Game.getFriendTime().toFixed(1)}s`;
      hudPowerup.className   = 'hud-powerup friend';
    } else {
      hudPowerup.textContent = '';
      hudPowerup.className   = 'hud-powerup';
    }
  }

  let lastTime    = 0;
  let loopRunning = false;
  const MAX_DT    = 0.05;

  function loop(timestamp) {
    requestAnimationFrame(loop);
    const dt = Math.min((timestamp - lastTime) / 1000, MAX_DT);
    lastTime = timestamp;
    if (!isInGame()) return;
    if (Game.isRunning()) { Game.update(dt, { ...input }); _updateHUD(); }
    Game.draw();
  }

  function startLoop() {
    loopRunning = true;
    lastTime    = performance.now();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => Game.handleResize());

  showScreen('menu');
  startLoop();

})();