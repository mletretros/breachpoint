import { WEAPONS } from './weapon.js';

export function createMatch(opts) {
  const { world, player, bots, audio, hud, seed } = opts;
  
  const state = {
    phase: 'warmup',
    roundNumber: 1,
    scoreVanta: 0,
    scoreHalo: 0,
    phaseEndsAt: 0,
    credits: 800,
    uplinkProgress: 0,
    uplinkHolder: null,
    timeLeft: 0
  };

  let roundKills = 0;

  function setPhase(newPhase, durationMs, now) {
    state.phase = newPhase;
    state.phaseEndsAt = now + durationMs;
  }

  function checkWin() {
    if (state.scoreHalo >= 5) return 'halo';
    if (state.scoreVanta >= 5) return 'vanta';
    return null;
  }

  return {
    get state() {
      return state;
    },

    start(now) {
      state.roundNumber = 1;
      state.scoreVanta = 0;
      state.scoreHalo = 0;
      state.credits = 800;
      this.startBuyPhase(now);
    },

    startBuyPhase(now) {
      roundKills = 0;
      const isStartOrHalf = (state.roundNumber === 1 || state.roundNumber === 4);
      setPhase('buy', isStartOrHalf ? 8000 : 12000, now);
      
      const spawn = world.spawns.halo[0];
      player.respawnAt(spawn.x, spawn.z);
      
      bots.spawnWave(4, 1.0);
    },

    startLive(now) {
      setPhase('live', 100000, now);
      state.uplinkProgress = 0;
      state.uplinkHolder = null;
    },

    endRound(winner, reason, now) {
      if (state.phase !== 'live') return;
      
      if (winner === 'halo') state.scoreHalo++;
      else if (winner === 'vanta') state.scoreVanta++;
      
      const matchWinner = checkWin();
      if (matchWinner) {
        setPhase('matchEnd', 10000, now);
      } else if (state.roundNumber === 3) {
        setPhase('halftime', 5000, now);
      } else {
        setPhase('roundEnd', 5000, now);
      }
      
      const winMoney = 2900;
      const lossMoney = 1900;
      const killMoney = Math.min(roundKills * 800, 2400);
      
      if (winner === 'halo') {
        state.credits += winMoney + killMoney;
      } else {
        state.credits += lossMoney + killMoney;
      }
      state.credits = Math.min(state.credits, 9000);
      
      if (audio && audio.roundEnd) audio.roundEnd(winner);
    },

    notifyPlayerDeath(now) {
      if (state.phase === 'live') {
        this.endRound('vanta', 'elimination', now);
      }
    },

    notifyBotKill() {
      roundKills++;
    },

    buy(weaponId) {
      if (state.phase !== 'buy') return false;
      if (weaponId === 'armour') {
        if (state.credits < 650 || player.armour >= 100) return false;
        state.credits -= 650;
        player.armour = 100;
        return true;
      }
      const def = WEAPONS.find(w => w.id === weaponId);
      if (!def || state.credits < def.price) return false;
      
      state.credits -= def.price;
      player.equip(weaponId);
      return true;
    },

    creditsForRound(n) {
      return state.credits;
    },

    resetForHalf(now) {
      state.credits = 800;
      this.startBuyPhase(now);
    },

    update(dt, now) {
      state.timeLeft = Math.max(0, state.phaseEndsAt - now);
      
      if (state.phase === 'buy' && state.timeLeft === 0) {
        this.startLive(now);
      } else if (state.phase === 'live') {
        if (state.timeLeft === 0) {
          this.endRound('halo', 'time', now);
        } else {
          // Check player X/Z position against pad bounds (ignoring Y as player is above it)
          const pad = world.pads[0];
          const px = player.position.x;
          const pz = player.position.z;
          const inPad = (px >= pad.min.x && px <= pad.max.x && pz >= pad.min.z && pz <= pad.max.z);
          
          const botsAlive = bots.aliveCount() > 0;
          
          if (inPad && botsAlive) {
            state.uplinkHolder = 'halo';
            state.uplinkProgress += dt / 6.0;
            if (state.uplinkProgress >= 1.0) {
              state.uplinkProgress = 1.0;
              this.endRound('halo', 'uplink', now);
            }
          } else {
            state.uplinkHolder = null;
          }
          
          if (!botsAlive && state.phase === 'live') {
            this.endRound('halo', 'elimination', now);
          }
        }
      } else if (state.phase === 'roundEnd' && state.timeLeft === 0) {
        state.roundNumber++;
        this.startBuyPhase(now);
      } else if (state.phase === 'halftime' && state.timeLeft === 0) {
        state.roundNumber++;
        this.resetForHalf(now);
      }
    },

    snapshot() {
      return { ...state };
    }
  };
}
