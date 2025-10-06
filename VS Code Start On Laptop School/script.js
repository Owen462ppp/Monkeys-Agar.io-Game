// Mini Agar.io style game, single cell, food, simple bots

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// World settings
const WORLD = { w: 3000, h: 3000 };
const GRID = 50;                // background grid spacing
const FOOD_COUNT = 350;
const BOT_COUNT = 6;

// Player
const player = {
  x: WORLD.w / 2,
  y: WORLD.h / 2,
  mass: 100,                    // start mass
  color: "#4caf50",
  vx: 0,
  vy: 0,
  boost: 0                      // boost timer
};

// Camera center on player
const camera = { x: player.x, y: player.y };

// Input
const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
let paused = false;
window.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});
window.addEventListener("keydown", e => {
  if (e.code === "Space") player.boost = 0.25;   // short boost
  if (e.key.toLowerCase() === "p") paused = !paused;
});

// Helpers
function massToRadius(m) {
  // r^2 proportional to mass, tweak factor for feel
  return Math.sqrt(m) * 2.5;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b)); }
function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// Entities
const pellets = [];
const bots = [];

// Create food pellets
function spawnFood(n) {
  for (let i = 0; i < n; i++) {
    pellets.push({
      x: rand(0, WORLD.w),
      y: rand(0, WORLD.h),
      mass: rand(2, 6),
      color: `hsl(${randInt(0, 360)}, 70%, 60%)`
    });
  }
}

// Create simple bots
function spawnBots(n) {
  for (let i = 0; i < n; i++) {
    const m = rand(80, 260);
    bots.push({
      x: rand(200, WORLD.w - 200),
      y: rand(200, WORLD.h - 200),
      mass: m,
      color: `hsl(${randInt(0, 360)}, 65%, 55%)`,
      dir: rand(0, Math.PI * 2),
      timer: rand(1, 3)
    });
  }
}

spawnFood(FOOD_COUNT);
spawnBots(BOT_COUNT);

// Game loop
let last = performance.now();
requestAnimationFrame(loop);
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (!paused) update(dt);
  draw();

  requestAnimationFrame(loop);
}

// Update
function update(dt) {
  // Desired direction toward mouse in world space
  const r = massToRadius(player.mass);
  const worldMouseX = camera.x - canvas.width  / 2 + mouse.x;
  const worldMouseY = camera.y - canvas.height / 2 + mouse.y;

  let dx = worldMouseX - player.x;
  let dy = worldMouseY - player.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

  // Speed inverse to size, plus small boost
  const baseSpeed = 260 / (1 + r * 0.15);
  const boostMult = player.boost > 0 ? 1.8 : 1.0;
  const speed = baseSpeed * boostMult;

  player.vx = dx * speed;
  player.vy = dy * speed;

  // Move player
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Wall clamp
  player.x = clamp(player.x, r, WORLD.w - r);
  player.y = clamp(player.y, r, WORLD.h - r);

  // Fade boost
  player.boost = Math.max(0, player.boost - dt);

  // Eat pellets
  eatPellets();

  // Bots AI and collisions
  updateBots(dt);

  // Camera follows player smoothly
  const smoothing = 0.1;
  camera.x += (player.x - camera.x) * smoothing;
  camera.y += (player.y - camera.y) * smoothing;
}

// Eat pellets if overlapping
function eatPellets() {
  const r = massToRadius(player.mass);
  const r2 = r * r;
  for (let i = pellets.length - 1; i >= 0; i--) {
    const p = pellets[i];
    if (dist2(player.x, player.y, p.x, p.y) <= (r + 3) * (r + 3)) {
      player.mass += p.mass;
      pellets.splice(i, 1);
    }
  }
  // Respawn to keep the map lively
  if (pellets.length < FOOD_COUNT) spawnFood(FOOD_COUNT - pellets.length);
}

// Bots update, simple wander and greedy behavior near player
function updateBots(dt) {
  for (let i = bots.length - 1; i >= 0; i--) {
    const b = bots[i];
    const br = massToRadius(b.mass);

    // Change direction every few seconds
    b.timer -= dt;
    if (b.timer <= 0) {
      b.timer = rand(1.2, 2.5);
      b.dir += rand(-1.0, 1.0);
    }

    // Behavior, flee if player is larger, chase if player is smaller
    const d2 = dist2(b.x, b.y, player.x, player.y);
    const d = Math.sqrt(d2);
    const pr = massToRadius(player.mass);
    const sizeRatio = player.mass / b.mass;

    if (d < 600) {
      if (sizeRatio > 1.2) {
        // Player bigger, bot flees
        b.dir = Math.atan2(b.y - player.y, b.x - player.x) + rand(-0.2, 0.2);
      } else if (sizeRatio < 0.8) {
        // Bot bigger, chase
        b.dir = Math.atan2(player.y - b.y, player.x - b.x) + rand(-0.1, 0.1);
      }
    }

    const bSpeed = 230 / (1 + br * 0.12);
    b.x += Math.cos(b.dir) * bSpeed * dt;
    b.y += Math.sin(b.dir) * bSpeed * dt;

    // Clamp to world
    b.x = clamp(b.x, br, WORLD.w - br);
    b.y = clamp(b.y, br, WORLD.h - br);

    // Bots eat pellets
    for (let p = pellets.length - 1; p >= 0; p--) {
      const food = pellets[p];
      if (dist2(b.x, b.y, food.x, food.y) <= (br + 3) * (br + 3)) {
        b.mass += food.mass * 0.9;
        pellets.splice(p, 1);
      }
    }

    // Player vs bot collision
    const collideDist = pr + br;
    if (dist2(player.x, player.y, b.x, b.y) <= collideDist * collideDist) {
      if (player.mass > b.mass * 1.15) {
        // Player eats bot
        player.mass += b.mass * 0.8;
        bots.splice(i, 1);
        continue;
      } else if (b.mass > player.mass * 1.15) {
        // Bot eats player, reset player
        resetPlayer();
        continue;
      }
      // If similar size, bounce slightly
      const ang = Math.atan2(b.y - player.y, b.x - player.x);
      const push = 40;
      player.x -= Math.cos(ang) * push * dt;
      player.y -= Math.sin(ang) * push * dt;
      b.x += Math.cos(ang) * push * dt;
      b.y += Math.sin(ang) * push * dt;
    }
  }

  // Respawn bots if needed
  if (bots.length < BOT_COUNT) spawnBots(BOT_COUNT - bots.length);
}

// Reset if eaten
function resetPlayer() {
  player.x = WORLD.w / 2;
  player.y = WORLD.h / 2;
  player.mass = 100;
  player.boost = 0;
}

// Draw
function draw() {
  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Camera top left
  const camLeft = camera.x - canvas.width / 2;
  const camTop  = camera.y - canvas.height / 2;

  // Grid
  drawGrid(camLeft, camTop);

  // Food
  for (const p of pellets) {
    const sx = p.x - camLeft;
    const sy = p.y - camTop;
    if (sx < -10 || sy < -10 || sx > canvas.width + 10 || sy > canvas.height + 10) continue;
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  // Bots
  for (const b of bots) {
    drawCell(b, camLeft, camTop);
  }

  // Player
  drawCell(player, camLeft, camTop, true);

  // UI
  const massText = (player.mass / 10).toFixed(1);
  document.getElementById("score").textContent = `Mass: ${massText}`;
}

// Draw helper for cells
function drawCell(ent, camLeft, camTop, isPlayer = false) {
  const r = Math.max(6, massToRadius(ent.mass));
  const sx = ent.x - camLeft;
  const sy = ent.y - camTop;

  // circle
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = ent.color;
  ctx.fill();

  // subtle outline
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();

  // player eye for feedback
  if (isPlayer) {
    const dx = (mouse.x + camLeft) - ent.x;
    const dy = (mouse.y + camTop) - ent.y;
    const len = Math.hypot(dx, dy) || 1;
    const ex = sx + (dx / len) * Math.min(8, r * 0.4);
    const ey = sy + (dy / len) * Math.min(8, r * 0.4);
    ctx.beginPath();
    ctx.arc(ex, ey, Math.max(2, r * 0.08), 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  }
}

// Background grid relative to world
function drawGrid(camLeft, camTop) {
  ctx.save();
  ctx.translate(-camLeft, -camTop);
  ctx.beginPath();
  ctx.lineWidth = 1;

  const startX = Math.floor(camLeft / GRID) * GRID;
  const startY = Math.floor(camTop  / GRID) * GRID;

  for (let x = startX; x < camLeft + canvas.width + GRID; x += GRID) {
    ctx.moveTo(x, camTop);
    ctx.lineTo(x, camTop + canvas.height);
  }
  for (let y = startY; y < camTop + canvas.height + GRID; y += GRID) {
    ctx.moveTo(camLeft, y);
    ctx.lineTo(camLeft + canvas.width, y);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.stroke();

  // World border
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);

  ctx.restore();
}

// Handle resize
window.addEventListener("resize", () => {
  // keep fixed canvas size for simplicity, you can also make it fill window
});

// Start text for a moment
setTimeout(() => {}, 1500);
