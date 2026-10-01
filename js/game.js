var requestAnimFrame = (function(){
  return window.requestAnimationFrame       ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame    ||
    window.oRequestAnimationFrame      ||
    window.msRequestAnimationFrame     ||
    function(callback){
      window.setTimeout(callback, 1000 / 60);
    };
})();

//create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext('2d');
var updateables = [];
var fireballs = [];
var player = new Mario.Player([0,0]);

//HUD / scoring state
var score = 0;
var coins = 0;
var lives = 3;
var time = 400;
var timeAccum = 0;
var gameOver = false;
var scorePopups = [];

//we might have to get the size and calculate the scaling
//but this method should let us make it however big.
//Cool!
//TODO: Automatically scale the game to work and look good on widescreen.
//TODO: fiddling with scaled sprites looks BETTER, but not perfect. Hmm.
canvas.width = 762;
canvas.height = 720;
ctx.scale(3,3);
document.body.appendChild(canvas);

//viewport
var vX = 0,
    vY = 0,
    vWidth = 256,
    vHeight = 240;

//load our images
resources.load([
  'sprites/player.png',
  'sprites/enemy.png',
  'sprites/tiles.png',
  'sprites/playerl.png',
  'sprites/items.png',
  'sprites/enemyr.png',
]);

resources.onReady(init);
var level;
var sounds;
var music;

//initialize
var lastTime;
function init() {
  music = {
    overworld: new Audio('sounds/aboveground_bgm.ogg'),
    underground: new Audio('sounds/underground_bgm.ogg'),
    clear: new Audio('sounds/stage_clear.wav'),
    death: new Audio('sounds/mariodie.wav')
  };
  sounds = {
    smallJump: new Audio('sounds/jump-small.wav'),
    bigJump: new Audio('sounds/jump-super.wav'),
    breakBlock: new Audio('sounds/breakblock.wav'),
    bump: new Audio('sounds/bump.wav'),
    coin: new Audio('sounds/coin.wav'),
    fireball: new Audio('sounds/fireball.wav'),
    flagpole: new Audio('sounds/flagpole.wav'),
    kick: new Audio('sounds/kick.wav'),
    pipe: new Audio('sounds/pipe.wav'),
    itemAppear: new Audio('sounds/itemAppear.wav'),
    powerup: new Audio('sounds/powerup.wav'),
    stomp: new Audio('sounds/stomp.wav')
  };
  restartGame();
  document.addEventListener('keydown', function(e) {
    //Press Enter or Z on the game over screen to restart.
    if ((e.keyCode === 13 || e.keyCode === 90) && gameOver) {
      restartGame();
    }
  });
  lastTime = Date.now();
  main();
}

var gameTime = 0;

//set up the game loop
function main() {
  var now = Date.now();
  var dt = (now - lastTime) / 1000.0;

  update(dt);
  render();

  lastTime = now;
  requestAnimFrame(main);
}

function update(dt) {
  gameTime += dt;

  if (gameOver) return; //freeze the world on the game over screen

  handleInput(dt);
  updateEntities(dt, gameTime);

  checkCollisions();
  updateTimer(dt);
}

function handleInput(dt) {
  if (gameOver) return;
  if (player.piping || player.dying || player.noInput) return; //don't accept input

  if (input.isDown('RUN')){
    player.run();
  } else {
    player.noRun();
  }
  if (input.isDown('JUMP')) {
    player.jump();
  } else {
    //we need this to handle the timing for how long you hold it
    player.noJump();
  }

  if (input.isDown('DOWN')) {
    player.crouch();
  } else {
    player.noCrouch();
  }

  if (input.isDown('LEFT')) { // 'd' or left arrow
    player.moveLeft();
  }
  else if (input.isDown('RIGHT')) { // 'k' or right arrow
    player.moveRight();
  } else {
    player.noWalk();
  }
}

//update all the moving stuff
function updateEntities(dt, gameTime) {
  player.update(dt, vX);
  updateables.forEach (function(ent) {
    ent.update(dt, gameTime);
  });

  //This should stop the jump when he switches sides on the flag.
  if (player.exiting) {
    if (player.pos[0] > vX + 96)
      vX = player.pos[0] - 96
  }else if (level.scrolling && player.pos[0] > vX + 80) {
    vX = player.pos[0] - 80;
  }

  if (player.powering.length !== 0 || player.dying) { return; }
  level.items.forEach (function(ent) {
    ent.update(dt);
  });

  level.enemies.forEach (function(ent) {
    ent.update(dt, vX);
  });

  fireballs.forEach(function(fireball) {
    fireball.update(dt);
  });
  level.pipes.forEach (function(pipe) {
    pipe.update(dt);
  });
}

//scan for collisions
function checkCollisions() {
  if (player.powering.length !== 0 || player.dying) { return; }
  player.checkCollisions();

  //Apparently for each will just skip indices where things were deleted.
  level.items.forEach(function(item) {
    item.checkCollisions();
  });
  level.enemies.forEach (function(ent) {
    ent.checkCollisions();
  });
  fireballs.forEach(function(fireball){
    fireball.checkCollisions();
  });
  level.pipes.forEach (function(pipe) {
    pipe.checkCollisions();
  });
}

//draw the game!
function render() {
  updateables = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = level.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  //scenery gets drawn first to get layering right.
  for(var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++){
      if (level.scenery[i][j]) {
        renderEntity(level.scenery[i][j]);
      }
    }
  }

  //then items
  level.items.forEach (function (item) {
    renderEntity(item);
  });

  level.enemies.forEach (function(enemy) {
    renderEntity(enemy);
  });



  fireballs.forEach(function(fireball) {
    renderEntity(fireball);
  })

  //then we draw every static object.
  for(var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++){
      if (level.statics[i][j]) {
        renderEntity(level.statics[i][j]);
      }
      if (level.blocks[i][j]) {
        renderEntity(level.blocks[i][j]);
        updateables.push(level.blocks[i][j]);
      }
    }
  }

  //then the player
  if (player.invincibility % 2 === 0) {
    renderEntity(player);
  }

  //Mario goes INTO pipes, so naturally they go after.
  level.pipes.forEach (function(pipe) {
    renderEntity(pipe);
  });

  //HUD and floating score popups on top of everything.
  drawHUD(ctx);
  drawScorePopups(ctx);
  if (gameOver) drawGameOver(ctx);
}

function renderEntity(entity) {
  entity.render(ctx, vX, vY);
}

// ================= HUD / Score / Timer / Lives =================

function resetMusicSpeed() {
  music.overworld.playbackRate = 1;
  music.underground.playbackRate = 1;
}

function zeroPad(n, len) {
  var s = String(n);
  while (s.length < len) s = '0' + s;
  return s;
}

function addScore(points, pos, label) {
  score += points;
  scorePopups.push({
    x: pos ? pos[0] : vX + 128,
    y: pos ? pos[1] : 100,
    life: 45,
    text: label ? String(label) : String(points),
    color: '#fff'
  });
  if (scorePopups.length > 12) scorePopups.shift();
}

function coinGained(x, y, isBlockCoin) {
  coins += 1;
  if (player) player.coins = coins;
  addScore(isBlockCoin ? 200 : 100, [x, y]);
  //Every 100 coins, a 1UP! (Extra life, just like the NES game.)
  if (coins % 100 === 0) {
    lives += 1;
    sounds.powerup.play();
    addScore(0, [x, y - 12], '1UP');
  }
}

function updateTimer(dt) {
  if (gameOver) return;
  timeAccum += dt;
  if (timeAccum >= 1) {
    timeAccum -= 1;
    if (!player.dying && !player.exiting) {
      time -= 1;
      if (time <= 0) {
        time = 0;
        player.die();
      }
    }
  }
  //classic "hurry up!" music speedup.
  var rate = 1;
  if (time <= 100) rate = 1.15;
  if (time <= 50) rate = 1.3;
  if (music.overworld.playbackRate !== rate) music.overworld.playbackRate = rate;
  if (music.underground.playbackRate !== rate) music.underground.playbackRate = rate;
}

function handlePlayerDeath() {
  if (gameOver) return;
  scorePopups = [];
  lives -= 1;
  if (lives > 0) {
    //restart the current level with a fresh player.
    player = new Mario.Player(level.playerPos);
    level.loader.call();
    input.reset();
    time = 400;
    timeAccum = 0;
    resetMusicSpeed();
  } else {
    gameOver = true;
  }
}

function restartGame() {
  if (music) {
    music.death.pause();
    music.clear.pause();
  }
  score = 0;
  coins = 0;
  lives = 3;
  time = 400;
  timeAccum = 0;
  gameOver = false;
  scorePopups = [];
  input.reset();
  Mario.oneone();
  player = new Mario.Player(level.playerPos);
  resetMusicSpeed();
}

function drawHUD(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, vWidth, 16);
  ctx.textBaseline = 'top';
  ctx.font = '8px monospace';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  //labels
  ctx.fillText('SCORE', 4, 2);
  ctx.fillText('\u00D7' + zeroPad(coins, 2), 88, 2);
  ctx.fillText('WORLD 1-1', 150, 2);
  ctx.fillText('TIME', 218, 2);
  //values
  ctx.fillText(zeroPad(score, 6), 4, 10);
  ctx.fillText('LIVES ' + lives, 88, 10);
  ctx.fillText(zeroPad(time, 3), 218, 10);
  ctx.restore();
}

function drawScorePopups(ctx) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '7px monospace';
  ctx.fillStyle = '#fff';
  for (var i = scorePopups.length - 1; i >= 0; i--) {
    var p = scorePopups[i];
    p.y -= 0.35;
    p.life -= 1;
    if (p.life <= 0) {
      scorePopups.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = Math.min(1, p.life / 12);
    ctx.fillText(p.text, p.x - vX, p.y);
  }
  ctx.restore();
}

function drawGameOver(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, vWidth, vHeight);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  ctx.fillText('GAME OVER', vWidth / 2, 96);
  ctx.font = '8px monospace';
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillText('PRESS ENTER TO RESTART', vWidth / 2, 122);
  }
  ctx.restore();
}
