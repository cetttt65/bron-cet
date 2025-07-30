const canvas = document.getElementById("gameCanvas");
const img = document.getElementById("map");
canvas.width = img.clientWidth;
canvas.height = img.clientHeight;
const ctx = canvas.getContext("2d");

const droneImg = new Image();
droneImg.src = "assets/drone.png";

const batteryImg = new Image();
batteryImg.src = "assets/battery.png";

const citiesPercent = [
  { name: "Київ", xPct: 0.47, yPct: 0.28 },
  { name: "Харків", xPct: 0.8, yPct: 0.37 },
  { name: "Одеса", xPct: 0.47, yPct: 0.70 },
  { name: "Дніпро", xPct: 0.7, yPct: 0.50 },
  { name: "Львів", xPct: 0.13, yPct: 0.4 },
  { name: "Миколаїв", xPct: 0.53, yPct: 0.63 }
];

function calcCities() {
  return citiesPercent.map(c => ({
    name: c.name,
    x: Math.floor(c.xPct * canvas.width),
    y: Math.floor(c.yPct * canvas.height)
  }));
}

let allCities = calcCities();
let activeCities = [allCities[0]];
let targetIndex = 0;
let target = activeCities[targetIndex];

let batteries = [];
let drones = [];
let explosions = [];

let score = 0;
let money = 7000;
let wave = 1;
let placingMode = false;
let selectedBattery = null;
let missedDrones = 0;

const maxRadius = 100;
const upgradeStep = 10;

document.getElementById("money").textContent = money;
document.getElementById("score").textContent = score;
document.getElementById("wave").textContent = wave;

function spawnDrone() {
  const count = Math.floor(wave * 1.5);
  for (let i = 0; i < count; i++) {
    drones.push({
      x: canvas.width,
      y: Math.random() * canvas.height,
      speed: 0.5 + Math.random() * 0.4,
      targetX: target.x,
      targetY: target.y,
      health: 2 + Math.floor(wave / 5),
    });
  }
}

canvas.addEventListener("click", e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (placingMode && money >= 1000) {
    batteries.push({
      x,
      y,
      radius: 40,
      cooldown: 0,
      cooldownMax: 12,
      upgradeLevel: 1
    });
    money -= 1000;
    placingMode = false;
    selectedBattery = null; // сброс выбора при установке нового ППО
    updateStats();
  } else {
    selectedBattery = batteries.find(b => Math.hypot(b.x - x, b.y - y) < 20) || null;
    updateStats();
  }
});

document.getElementById("buyPPO").onclick = () => {
  if (money >= 1000) placingMode = true;
};

document.getElementById("upgradePPO").onclick = () => {
  if (selectedBattery) {
    if (!selectedBattery.upgradeLevel) {
      selectedBattery.upgradeLevel = 1;
    }

    if (selectedBattery.radius < maxRadius) {
      const cost = 500 * selectedBattery.upgradeLevel;
      if (money >= cost) {
        selectedBattery.radius += upgradeStep;
        money -= cost;
        selectedBattery.upgradeLevel++;
        updateStats();
      } else {
        alert(`Потрібно ${cost}₴ для покращення.`);
      }
    } else {
      alert("Досягнуто максимального радіуса ППО.");
    }
  }
};

document.getElementById("sellPPO").onclick = () => {
  if (selectedBattery) {
    money += 1000;
    batteries = batteries.filter(b => b !== selectedBattery);
    selectedBattery = null;
    updateStats();
  }
};

function updateStats() {
  document.getElementById("money").textContent = money;
  document.getElementById("score").textContent = score;
  document.getElementById("wave").textContent = wave;
  document.getElementById("missed").textContent = missedDrones;

  const upgradeBtn = document.getElementById("upgradePPO");
  if (selectedBattery) {
    const level = selectedBattery.upgradeLevel || 1;
    const cost = 500 * level;
    upgradeBtn.textContent = `Покращити ППО (${cost}₴)`;
  } else {
    upgradeBtn.textContent = "Покращити ППО";
  }
}

function update() {
  for (const d of drones) {
    const dx = d.targetX - d.x;
    const dy = d.targetY - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist !== 0) {
      d.x += (dx / dist) * d.speed;
      d.y += (dy / dist) * d.speed;
    }
  }

  for (const b of batteries) {
    if (b.cooldown > 0) b.cooldown--;

    let nearestDrone = null;
    let nearestDist = Infinity;
    for (const d of drones) {
      const dist = Math.hypot(d.x - b.x, d.y - b.y);
      if (dist < b.radius && dist < nearestDist) {
        nearestDist = dist;
        nearestDrone = d;
      }
    }

    if (nearestDrone && b.cooldown === 0) {
      nearestDrone.health--;
      b.cooldown = b.cooldownMax;

      if (nearestDrone.health <= 0) {
        explosions.push({ x: nearestDrone.x, y: nearestDrone.y, radius: 0, maxRadius: 30, alpha: 1 });
        drones = drones.filter(d => d !== nearestDrone);
        score++;
        money += 100;
        updateStats();
      }
    }
  }

  explosions = explosions.filter(ex => {
    ex.radius += 2;
    ex.alpha -= 0.05;
    return ex.alpha > 0;
  });

  drones = drones.filter(d => {
    const reached = Math.hypot(d.x - d.targetX, d.y - d.targetY) < 10;
    if (reached) {
      missedDrones++;
      updateStats();
      return false;
    }
    return true;
  });

  if (drones.length === 0) {
    wave++;
    if (wave % 5 === 0 && activeCities.length < allCities.length) {
      activeCities.push(allCities[activeCities.length]);
    }
    targetIndex++;
    if (targetIndex >= activeCities.length) targetIndex = 0;
    target = activeCities[targetIndex];
    spawnDrone();
    updateStats();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  activeCities.forEach(city => {
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(city.x, city.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(target.x, target.y, 7, 0, Math.PI * 2);
  ctx.fill();

  batteries.forEach(b => {
    ctx.drawImage(batteryImg, b.x - 16, b.y - 16, 32, 32);

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.strokeStyle = (b === selectedBattery) ? "cyan" : "gray";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (b === selectedBattery) {
      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("LVL " + (b.upgradeLevel || 1), b.x, b.y - 25);
    }

    let nearestDrone = null;
    let nearestDist = Infinity;
    for (const d of drones) {
      const dist = Math.hypot(d.x - b.x, d.y - b.y);
      if (dist < b.radius && dist < nearestDist) {
        nearestDist = dist;
        nearestDrone = d;
      }
    }

    if (nearestDrone) {
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(nearestDrone.x, nearestDrone.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  drones.forEach(d => {
    ctx.drawImage(droneImg, d.x - 12, d.y - 12, 24, 24);
  });

  explosions.forEach(ex => {
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 69, 0, ${ex.alpha})`;
    ctx.fill();
  });
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

spawnDrone();
updateStats();
gameLoop();
