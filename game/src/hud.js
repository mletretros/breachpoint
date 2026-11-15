import { PALETTE } from './palette.js';
import { WEAPONS } from './weapon.js';

export function createHud() {
  const container = document.getElementById('hud');
  container.innerHTML = ''; // clear

  if (!document.getElementById('hud-styles')) {
    const style = document.createElement('style');
    style.id = 'hud-styles';
    style.textContent = `
      :root {
        --canvas: ${PALETTE.canvas};
        --surface: ${PALETTE.surface};
        --hairline: ${PALETTE.hairline};
        --ink: ${PALETTE.ink};
        --muted: ${PALETTE.muted};
        --accent: ${PALETTE.accent};
        --jade: ${PALETTE.jade};
        --surface-plate: rgba(27, 31, 36, 0.6);
        --font-ui: system-ui, -apple-system, sans-serif;
        --font-readout: ui-monospace, 'SF Mono', monospace;
      }
      .hud-layer {
        position: absolute;
        inset: 0;
        font-family: var(--font-ui);
        color: var(--ink);
        text-shadow: 1px 1px 0 var(--hairline), -1px -1px 0 var(--hairline), 1px -1px 0 var(--hairline), -1px 1px 0 var(--hairline);
        pointer-events: none;
      }
      .hud-top-center {
        position: absolute;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .score-bar {
        display: flex;
        gap: 16px;
        font-size: 24px;
        font-weight: bold;
        background: var(--surface-plate);
        padding: 8px 16px;
        border-radius: 4px;
        border: 1px solid var(--hairline);
      }
      .score-vanta { color: var(--jade); }
      .score-halo { color: var(--accent); }
      .timer-phase {
        font-family: var(--font-readout);
        font-size: 16px;
        background: var(--surface-plate);
        padding: 4px 12px;
        border-radius: 4px;
        color: #fff;
      }
      .hud-bottom-left {
        position: absolute;
        bottom: 24px;
        left: 32px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .credits {
        font-family: var(--font-readout);
        font-size: 20px;
        color: var(--jade);
        background: var(--surface-plate);
        padding: 4px 12px;
        border-radius: 4px;
      }
      .health-armour {
        display: flex;
        gap: 16px;
        font-family: var(--font-readout);
        font-size: 32px;
        color: #fff;
        background: var(--surface-plate);
        padding: 4px 12px;
        border-radius: 4px;
      }
      .hud-bottom-right {
        position: absolute;
        bottom: 24px;
        right: 32px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
      }
      .weapon-name {
        font-size: 20px;
        color: var(--muted);
        background: var(--surface-plate);
        padding: 4px 12px;
        border-radius: 4px;
      }
      .ammo {
        display: flex;
        align-items: baseline;
        gap: 8px;
        font-family: var(--font-readout);
        font-size: 48px;
        color: #fff;
        background: var(--surface-plate);
        padding: 4px 12px;
        border-radius: 4px;
      }
      .ammo.reloading { color: var(--muted); }
      .ammo-reserve { font-size: 20px; color: var(--muted); }
      .hud-uplink {
        position: absolute;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        width: 300px;
        height: 12px;
        background: var(--surface-plate);
        border: 1px solid var(--hairline);
        border-radius: 6px;
        overflow: hidden;
        display: none;
      }
      .hud-uplink-bar {
        height: 100%;
        width: 0%;
        background: var(--accent);
        transition: width 0.1s linear;
      }
      .hud-killfeed {
        position: absolute;
        top: 24px;
        right: 32px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: flex-end;
      }
      .kill-item {
        background: var(--surface);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 14px;
        opacity: 1;
        transition: opacity 0.5s ease;
      }
      .crosshair {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
      }
      .crosshair i {
        position: absolute;
        background: var(--ink);
        opacity: 0.8;
      }
      .crosshair i.t { top: -10px; left: -1px; width: 2px; height: 6px; }
      .crosshair i.b { bottom: -10px; left: -1px; width: 2px; height: 6px; }
      .crosshair i.l { left: -10px; top: -1px; width: 6px; height: 2px; }
      .crosshair i.r { right: -10px; top: -1px; width: 6px; height: 2px; }
      
      .hitmarker {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(45deg);
        opacity: 0;
        transition: opacity 0.1s;
      }
      .hitmarker.on { opacity: 1; }
      .hitmarker i {
        position: absolute;
        background: var(--ink);
      }
      .hitmarker.kill i { background: var(--accent); }
      .hitmarker i.t { top: -12px; left: -1px; width: 2px; height: 8px; }
      .hitmarker i.b { bottom: -12px; left: -1px; width: 2px; height: 8px; }
      .hitmarker i.l { left: -12px; top: -1px; width: 8px; height: 2px; }
      .hitmarker i.r { right: -12px; top: -1px; width: 8px; height: 2px; }

      .overlay {
        position: absolute;
        inset: 0;
        background: rgba(16, 18, 21, 0.85);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }
      .overlay[hidden] { display: none; }
      .overlay-panel {
        background: var(--surface);
        padding: 32px;
        border: 1px solid var(--hairline);
        border-radius: 8px;
        text-align: center;
        min-width: 300px;
        transition: transform 0.2s;
      }
      .overlay-title { font-size: 32px; margin: 0 0 16px; }
      .overlay-copy { font-size: 16px; color: var(--muted); margin: 0 0 24px; }
      .btn {
        background: var(--accent);
        color: var(--canvas);
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: bold;
        border-radius: 4px;
        cursor: pointer;
      }
      .btn:hover { background: var(--ink); }
      .buy-menu {
        display: flex;
        gap: 16px;
        margin-top: 24px;
      }
      .buy-btn {
        background: var(--surface);
        border: 1px solid var(--hairline);
        color: var(--ink);
        padding: 16px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 100px;
      }
      .buy-btn:hover:not(:disabled) { border-color: var(--accent); }
      .buy-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .buy-price { color: var(--jade); font-family: var(--font-readout); }
    `;
    document.head.appendChild(style);
  }

  const layer = document.createElement('div');
  layer.className = 'hud-layer';
  container.appendChild(layer);

  // Top Center
  const topCenter = document.createElement('div');
  topCenter.className = 'hud-top-center';
  const scoreBar = document.createElement('div');
  scoreBar.className = 'score-bar';
  const scoreVantaEl = document.createElement('span');
  scoreVantaEl.className = 'score-vanta';
  scoreVantaEl.textContent = 'VANTA 0';
  const scoreHaloEl = document.createElement('span');
  scoreHaloEl.className = 'score-halo';
  scoreHaloEl.textContent = '0 HALO';
  scoreBar.appendChild(scoreVantaEl);
  scoreBar.appendChild(document.createTextNode(' - '));
  scoreBar.appendChild(scoreHaloEl);
  const timerPhase = document.createElement('div');
  timerPhase.className = 'timer-phase';
  topCenter.appendChild(scoreBar);
  topCenter.appendChild(timerPhase);
  layer.appendChild(topCenter);

  // Bottom Left
  const bottomLeft = document.createElement('div');
  bottomLeft.className = 'hud-bottom-left';
  const creditsEl = document.createElement('div');
  creditsEl.className = 'credits';
  const healthArmour = document.createElement('div');
  healthArmour.className = 'health-armour';
  const healthEl = document.createElement('span');
  const armourEl = document.createElement('span');
  healthArmour.appendChild(healthEl);
  healthArmour.appendChild(armourEl);
  bottomLeft.appendChild(creditsEl);
  bottomLeft.appendChild(healthArmour);
  layer.appendChild(bottomLeft);

  // Bottom Right
  const bottomRight = document.createElement('div');
  bottomRight.className = 'hud-bottom-right';
  const weaponName = document.createElement('div');
  weaponName.className = 'weapon-name';
  const ammoEl = document.createElement('div');
  ammoEl.className = 'ammo';
  const ammoMag = document.createElement('span');
  const ammoReserve = document.createElement('span');
  ammoReserve.className = 'ammo-reserve';
  ammoEl.appendChild(ammoMag);
  ammoEl.appendChild(ammoReserve);
  bottomRight.appendChild(weaponName);
  bottomRight.appendChild(ammoEl);
  layer.appendChild(bottomRight);

  // Uplink
  const uplinkEl = document.createElement('div');
  uplinkEl.className = 'hud-uplink';
  const uplinkBar = document.createElement('div');
  uplinkBar.className = 'hud-uplink-bar';
  uplinkEl.appendChild(uplinkBar);
  layer.appendChild(uplinkEl);

  // Killfeed
  const killfeedEl = document.createElement('div');
  killfeedEl.className = 'hud-killfeed';
  layer.appendChild(killfeedEl);

  // Crosshair
  const crosshair = document.createElement('div');
  crosshair.className = 'crosshair';
  const chT = document.createElement('i'); chT.className = 't';
  const chB = document.createElement('i'); chB.className = 'b';
  const chL = document.createElement('i'); chL.className = 'l';
  const chR = document.createElement('i'); chR.className = 'r';
  crosshair.appendChild(chT); crosshair.appendChild(chB);
  crosshair.appendChild(chL); crosshair.appendChild(chR);
  layer.appendChild(crosshair);

  // Hitmarker
  const hitmarker = document.createElement('div');
  hitmarker.className = 'hitmarker';
  const hmT = document.createElement('i'); hmT.className = 't';
  const hmB = document.createElement('i'); hmB.className = 'b';
  const hmL = document.createElement('i'); hmL.className = 'l';
  const hmR = document.createElement('i'); hmR.className = 'r';
  hitmarker.appendChild(hmT); hitmarker.appendChild(hmB);
  hitmarker.appendChild(hmL); hitmarker.appendChild(hmR);
  layer.appendChild(hitmarker);

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.hidden = true;
  const overlayPanel = document.createElement('div');
  overlayPanel.className = 'overlay-panel';
  const overlayTitle = document.createElement('h1');
  overlayTitle.className = 'overlay-title';
  const overlayCopy = document.createElement('p');
  overlayCopy.className = 'overlay-copy';
  const playBtn = document.createElement('button');
  playBtn.className = 'btn';
  playBtn.textContent = 'Play';
  
  const buyMenu = document.createElement('div');
  buyMenu.className = 'buy-menu';
  const weapons = [
    ...WEAPONS,
    { id: 'armour', name: 'Armour', price: 650 }
  ];
  const buyBtns = [];
  for (const w of weapons) {
    const btn = document.createElement('button');
    btn.className = 'buy-btn';
    btn.innerHTML = `<span>${w.name}</span><span class="buy-price">$${w.price}</span>`;
    btn.dataset.id = w.id;
    btn.dataset.price = w.price;
    buyMenu.appendChild(btn);
    buyBtns.push(btn);
  }

  overlayPanel.appendChild(overlayTitle);
  overlayPanel.appendChild(overlayCopy);
  overlayPanel.appendChild(playBtn);
  overlayPanel.appendChild(buyMenu);
  overlay.appendChild(overlayPanel);
  container.appendChild(overlay);

  let hitTimer = 0;
  let currentCredits = 0;
  let playHandler = null;
  let buyHandler = null;

  playBtn.addEventListener('click', () => {
    if (playHandler) playHandler();
  });

  for (const btn of buyBtns) {
    btn.addEventListener('click', () => {
      if (buyHandler) buyHandler(btn.dataset.id);
    });
  }

  return {
    setHealth(hp, armour) {
      const displayHp = (hp > 0) ? Math.max(1, Math.ceil(hp)) : Math.ceil(hp);
      healthEl.textContent = `+${displayHp}`;
      armourEl.textContent = `*${Math.ceil(armour)}`;
      
      for (const btn of buyBtns) {
        if (btn.dataset.id === 'armour') {
          btn.disabled = currentCredits < 650 || armour >= 100;
        }
      }
    },
    setAmmo(mag, reserve, reloading) {
      ammoMag.textContent = mag;
      ammoReserve.textContent = `/ ${reserve}`;
      if (reloading) ammoEl.classList.add('reloading');
      else ammoEl.classList.remove('reloading');
    },
    setRound({ phase, roundNumber, scoreHalo, scoreVanta, timeLeft, credits }) {
      currentCredits = credits;
      scoreVantaEl.textContent = `VANTA ${scoreVanta}`;
      scoreHaloEl.textContent = `${scoreHalo} HALO`;
      const secs = Math.ceil(timeLeft / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      timerPhase.textContent = `R${roundNumber} ${phase.toUpperCase()} - ${m}:${s.toString().padStart(2, '0')}`;
      creditsEl.textContent = `$${credits}`;
      
      for (const btn of buyBtns) {
        if (btn.dataset.id !== 'armour') {
          btn.disabled = credits < parseInt(btn.dataset.price, 10);
        }
      }
    },
    setWeapon(name) {
      weaponName.textContent = name;
    },
    hitMarker(killed) {
      hitmarker.classList.add('on');
      if (killed) hitmarker.classList.add('kill');
      else hitmarker.classList.remove('kill');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
      }, 100);
    },
    setUplink(progress, holder) {
      if (holder) {
        uplinkEl.style.display = 'block';
        uplinkBar.style.width = `${progress * 100}%`;
        uplinkBar.style.background = holder === 'halo' ? PALETTE.accent : PALETTE.jade;
      } else {
        uplinkEl.style.display = 'none';
      }
    },
    killFeed(text) {
      const item = document.createElement('div');
      item.className = 'kill-item';
      item.textContent = text;
      killfeedEl.appendChild(item);
      setTimeout(() => {
        item.style.opacity = '0';
        setTimeout(() => item.remove(), 500);
      }, 4000);
    },
    setCrosshairSpread(radians) {
      const offset = Math.max(4, radians * 800);
      chT.style.transform = `translateY(-${offset}px)`;
      chB.style.transform = `translateY(${offset}px)`;
      chL.style.transform = `translateX(-${offset}px)`;
      chR.style.transform = `translateX(${offset}px)`;
    },
    showOverlay(kind, payload) {
      overlay.hidden = false;
      buyMenu.style.display = kind === 'buy' ? 'flex' : 'none';
      playBtn.style.display = kind === 'buy' ? 'none' : 'block';
      
      if (kind === 'start') {
        overlayTitle.textContent = 'Breachpoint';
        overlayCopy.textContent = 'Click to play.';
        playBtn.textContent = 'Play';
        overlayPanel.style.transform = 'none';
      } else if (kind === 'buy') {
        overlayTitle.textContent = 'Buy Phase';
        overlayCopy.textContent = 'Select your weapon.';
        overlayPanel.style.transform = 'translateX(-30%)';
      } else if (kind === 'paused') {
        overlayTitle.textContent = 'Paused';
        overlayCopy.textContent = 'Click to resume.';
        playBtn.textContent = 'Resume';
        overlayPanel.style.transform = 'none';
      } else if (kind === 'roundEnd') {
        overlayTitle.textContent = 'Round Over';
        overlayCopy.textContent = `Winner: ${payload}`;
        playBtn.textContent = 'Next Round';
        overlayPanel.style.transform = 'none';
      } else if (kind === 'matchEnd') {
        overlayTitle.textContent = 'Match Over';
        overlayCopy.textContent = `Winner: ${payload}`;
        playBtn.textContent = 'Play Again';
        overlayPanel.style.transform = 'none';
      }
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      playHandler = handler;
    },
    onBuy(handler) {
      buyHandler = handler;
    }
  };
}
