"use strict";

(() => {
  const canvas = document.querySelector("#gameCanvas");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const scoreValue = document.querySelector("#scoreValue");
  const bestValue = document.querySelector("#bestValue");
  const levelValue = document.querySelector("#levelValue");
  const statusValue = document.querySelector("#statusValue");
  const message = document.querySelector("#gameMessage");
  const messageTitle = document.querySelector("#messageTitle");
  const messageText = document.querySelector("#messageText");
  const startButton = document.querySelector("#startButton");
  const controls = document.querySelectorAll("[data-control]");
  const width = canvas.width;
  const height = canvas.height;
  const storageKey = "yoojin-space-runner-best";
  const keys = { left: false, right: false };
  const stars = Array.from({ length: 48 }, (_, index) => ({
    x: (index * 83) % width,
    y: (index * 47) % height,
    size: index % 4 === 0 ? 2 : 1,
    speed: 12 + (index % 5) * 5,
  }));

  const state = {
    mode: "idle",
    score: 0,
    best: readBestScore(),
    level: 1,
    growth: 0,
    elapsed: 0,
    spawnTimer: 0,
    pickupTimer: 0,
    animationFrameId: null,
    lastTime: 0,
    obstacles: [],
    pickups: [],
    ship: { x: width / 2 - 22, y: height - 72, width: 44, height: 50, speed: 320 },
  };

  function readBestScore() {
    try {
      return Number.parseInt(localStorage.getItem(storageKey) || "0", 10) || 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBestScore() {
    try {
      localStorage.setItem(storageKey, String(state.best));
    } catch (error) {
      // Storage may be disabled; the session score still works.
    }
  }

  function resetState() {
    state.score = 0;
    state.level = 1;
    state.growth = 0;
    state.elapsed = 0;
    state.spawnTimer = 0;
    state.pickupTimer = 0;
    state.obstacles = [];
    state.pickups = [];
    state.ship.x = width / 2 - state.ship.width / 2;
    updateHud();
  }

  function startGame() {
    resetState();
    state.mode = "running";
    hideMessage();
    updateStatus("비행 중");
    startLoop();
  }

  function endGame() {
    state.mode = "over";
    stopLoop();
    if (state.score > state.best) {
      state.best = state.score;
      saveBestScore();
    }
    updateHud();
    updateStatus("게임 오버");
    showMessage("비행 종료", `점수 ${state.score}점 · Enter 또는 버튼으로 다시 시작하세요.`);
  }

  function togglePause() {
    if (state.mode === "running") {
      state.mode = "paused";
      updateStatus("일시정지");
      showMessage("잠시 멈춤", "P 키 또는 일시정지 버튼으로 계속 비행하세요.", false);
    } else if (state.mode === "paused") {
      state.mode = "running";
      hideMessage();
      updateStatus("비행 중");
      startLoop();
    }
  }

  function startLoop() {
    if (state.animationFrameId !== null) return;
    state.lastTime = performance.now();
    state.animationFrameId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (state.animationFrameId !== null) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }
  }

  function tick(now) {
    state.animationFrameId = null;
    if (state.mode !== "running") return;
    const delta = Math.min((now - state.lastTime) / 1000, 0.05);
    state.lastTime = now;
    update(delta);
    draw();
    state.animationFrameId = requestAnimationFrame(tick);
  }

  function update(delta) {
    state.elapsed += delta;
    state.score = Math.floor(state.elapsed * 2) + state.growth * 3;
    state.level = 1 + Math.floor(state.score / 25);
    state.spawnTimer += delta * 1000;
    state.pickupTimer += delta * 1000;
    const spawnEvery = Math.max(440, 960 - state.level * 34);

    if (state.spawnTimer >= spawnEvery) {
      state.spawnTimer = 0;
      spawnObstacle();
    }
    if (state.pickupTimer >= 1850) {
      state.pickupTimer = 0;
      spawnPickup();
    }

    const direction = Number(keys.right) - Number(keys.left);
    state.ship.x += direction * state.ship.speed * delta;
    state.ship.x = Math.max(8, Math.min(width - state.ship.width - 8, state.ship.x));

    state.obstacles.forEach((obstacle) => {
      obstacle.y += obstacle.speed * delta;
      obstacle.x += obstacle.drift * delta;
      if (obstacle.x < 4 || obstacle.x + obstacle.width > width - 4) obstacle.drift *= -1;
    });
    state.pickups.forEach((pickup) => { pickup.y += pickup.speed * delta; });
    state.obstacles = state.obstacles.filter((obstacle) => obstacle.y < height + 80);
    state.pickups = state.pickups.filter((pickup) => pickup.y < height + 30 && !pickup.collected);

    if (state.obstacles.some((obstacle) => overlaps(state.ship, obstacle))) {
      endGame();
      return;
    }
    state.pickups.forEach((pickup) => {
      if (overlaps(state.ship, pickup)) {
        pickup.collected = true;
        state.growth = Math.min(12, state.growth + 1);
      }
    });
    updateHud();
  }

  function spawnObstacle() {
    const meteor = Math.random() > 0.42;
    const size = meteor ? 28 + Math.random() * 20 : 32 + Math.random() * 34;
    state.obstacles.push({
      type: meteor ? "meteor" : "structure",
      x: 12 + Math.random() * (width - size - 24),
      y: -size - 12,
      width: size,
      height: size,
      speed: 175 + Math.random() * 90 + state.level * 8,
      drift: meteor ? (Math.random() - 0.5) * 90 : 0,
      rotation: Math.random() * Math.PI,
    });
  }

  function spawnPickup() {
    state.pickups.push({ x: 20 + Math.random() * (width - 40), y: -20, width: 18, height: 18, speed: 130 + state.level * 5, collected: false });
  }

  function overlaps(first, second) {
    return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y;
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#10182b";
    context.fillRect(0, 0, width, height);
    drawStars();
    state.pickups.forEach(drawPickup);
    state.obstacles.forEach(drawObstacle);
    drawShip();
  }

  function drawStars() {
    stars.forEach((star) => {
      const offset = state.elapsed * star.speed;
      const y = (star.y + offset) % height;
      context.fillStyle = star.size === 2 ? "#ffd75e" : "#7c8baa";
      context.fillRect(star.x, y, star.size, star.size);
    });
  }

  function drawShip() {
    const scale = 1 + state.growth * 0.025;
    const centerX = state.ship.x + state.ship.width / 2;
    const bottom = state.ship.y + state.ship.height;
    context.save();
    context.translate(centerX, state.ship.y + state.ship.height / 2);
    context.scale(scale, scale);
    context.fillStyle = "#a8f0d1";
    context.beginPath();
    context.moveTo(0, -26);
    context.lineTo(21, 22);
    context.lineTo(0, 15);
    context.lineTo(-21, 22);
    context.closePath();
    context.fill();
    context.fillStyle = "#ff4f8b";
    context.beginPath();
    context.arc(0, -5, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffd75e";
    context.fillRect(-11, 20, 8, 11);
    context.fillRect(3, 20, 8, 11);
    context.restore();
    context.fillStyle = "rgba(255, 215, 94, .18)";
    context.fillRect(centerX - 15, bottom, 30, 3);
  }

  function drawObstacle(obstacle) {
    context.save();
    context.translate(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
    context.rotate(obstacle.rotation);
    if (obstacle.type === "meteor") {
      context.fillStyle = "#ff8a67";
      context.beginPath();
      context.moveTo(0, -obstacle.height / 2);
      context.lineTo(obstacle.width / 2, -obstacle.height / 4);
      context.lineTo(obstacle.width / 3, obstacle.height / 2);
      context.lineTo(-obstacle.width / 2, obstacle.height / 3);
      context.lineTo(-obstacle.width / 2, -obstacle.height / 3);
      context.closePath();
      context.fill();
    } else {
      context.fillStyle = "#7357ff";
      context.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
      context.fillStyle = "#a8f0d1";
      context.fillRect(-obstacle.width / 4, -obstacle.height / 4, obstacle.width / 2, obstacle.height / 2);
    }
    context.restore();
  }

  function drawPickup(pickup) {
    context.fillStyle = "#ffd75e";
    context.beginPath();
    context.moveTo(pickup.x + pickup.width / 2, pickup.y);
    context.lineTo(pickup.x + pickup.width, pickup.y + pickup.height / 2);
    context.lineTo(pickup.x + pickup.width / 2, pickup.y + pickup.height);
    context.lineTo(pickup.x, pickup.y + pickup.height / 2);
    context.closePath();
    context.fill();
  }

  function updateHud() {
    scoreValue.textContent = String(state.score);
    bestValue.textContent = String(Math.max(state.best, state.score));
    levelValue.textContent = String(state.level);
  }

  function updateStatus(text) { statusValue.textContent = text; }

  function showMessage(title, text, showButton = true) {
    messageTitle.textContent = title;
    messageText.textContent = text;
    startButton.textContent = state.mode === "over" ? "다시 시작" : "게임 시작";
    startButton.hidden = !showButton;
    message.hidden = false;
  }

  function hideMessage() { message.hidden = true; }

  function setDirection(direction, active) {
    if (active) {
      keys.left = direction === "left";
      keys.right = direction === "right";
    } else {
      keys[direction] = false;
    }
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      setDirection(event.key === "ArrowLeft" ? "left" : "right", true);
    }
    if (event.key.toLowerCase() === "p") togglePause();
    if (event.key === "Enter" && (state.mode === "idle" || state.mode === "over")) startGame();
  }

  function handleKeyUp(event) {
    if (event.key === "ArrowLeft") setDirection("left", false);
    if (event.key === "ArrowRight") setDirection("right", false);
  }

  document.addEventListener("keydown", handleKeyDown, { passive: false });
  document.addEventListener("keyup", handleKeyUp);
  startButton.addEventListener("click", startGame);

  controls.forEach((control) => {
    const action = control.dataset.control;
    if (action === "pause") control.addEventListener("click", togglePause);
    if (action === "restart") control.addEventListener("click", startGame);
    if (action === "left" || action === "right") {
      control.addEventListener("pointerdown", () => setDirection(action, true));
      control.addEventListener("pointerup", () => setDirection(action, false));
      control.addEventListener("pointerleave", () => setDirection(action, false));
      control.addEventListener("pointercancel", () => setDirection(action, false));
    }
  });

  updateHud();
  draw();
})();
