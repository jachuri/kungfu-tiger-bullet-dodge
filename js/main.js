/**
 * 앱 진입점 & UI 관리 — 모바일 전용
 * 터치 매니저 초기화, 화면 전환, 풀스크린/방향 잠금
 */

import { GameEngine } from './game.js';
import { gameAudio } from './audio.js';
import { RankingSystem } from './ranking.js';
import { TouchManager } from './touch.js';

// DOM 요소
const screens = {
  start: document.getElementById('screen-start'),
  game: document.getElementById('screen-game'),
  ranking: document.getElementById('screen-ranking')
};

const overlays = {
  pause: document.getElementById('overlay-pause'),
  gameover: document.getElementById('overlay-gameover')
};

const hud = {
  container: document.getElementById('game-hud'),
  time: document.getElementById('hud-time'),
  best: document.getElementById('hud-best')
};

const gameoverUI = {
  finalTime: document.getElementById('final-time'),
  newRecordBadge: document.getElementById('new-record-badge'),
  rankingForm: document.getElementById('ranking-form-container'),
  playerNameInput: document.getElementById('player-name-input'),
  btnSubmitScore: document.getElementById('btn-submit-score')
};

// 버튼
const btnStart = document.getElementById('btn-start-game');
const btnShowRank = document.getElementById('btn-show-ranking');
const btnBackMenu = document.getElementById('btn-back-to-menu');
const btnResetRank = document.getElementById('btn-reset-rankings');

const btnPause = document.getElementById('btn-pause-game');
const btnResume = document.getElementById('btn-resume');
const btnRestartPaused = document.getElementById('btn-restart-paused');
const btnQuitPaused = document.getElementById('btn-quit-paused');

const btnRestartOver = document.getElementById('btn-restart-over');
const btnQuitOver = document.getElementById('btn-quit-over');

const btnSoundToggle = document.getElementById('btn-sound-toggle');
const soundIcon = document.getElementById('sound-icon');

const touchPad = document.getElementById('touch-pad');

// 랭킹
const rankingTableBody = document.getElementById('ranking-list-body');
const noRankingsMsg = document.getElementById('no-rankings');

// 전역
let gameEngine = null;
let touchManager = null;
let savedFinalScore = 0;

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  touchManager = new TouchManager();
  touchManager.init(
    document.getElementById('btn-touch-left'),
    document.getElementById('btn-touch-right'),
    document.getElementById('btn-touch-jump'),
    document.getElementById('btn-touch-duck')
  );

  initGameEngine();
  bindUIEvents();
  bindKeyboardFallback();
  tryLockOrientation();
});

// 키보드 입력 fallback (데스크톱 테스트 & 외부 키보드 지원)
function bindKeyboardFallback() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') touchManager.keys['ArrowLeft'] = true;
    if (e.key === 'ArrowRight') touchManager.keys['ArrowRight'] = true;
    if (e.key === 'ArrowUp' || e.key === ' ') touchManager.keys['ArrowUp'] = true;
    if (e.key === 'ArrowDown') touchManager.keys['ArrowDown'] = true;

    // 점프 사운드 트리거
    if (gameEngine && gameEngine.state === 'playing' && (e.key === 'ArrowUp' || e.key === ' ')) {
      gameAudio.init();
    }

    // 방향키 기본 동작(스크롤 등) 방지
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') touchManager.keys['ArrowLeft'] = false;
    if (e.key === 'ArrowRight') touchManager.keys['ArrowRight'] = false;
    if (e.key === 'ArrowUp' || e.key === ' ') touchManager.keys['ArrowUp'] = false;
    if (e.key === 'ArrowDown') touchManager.keys['ArrowDown'] = false;
  });
}

// 게임 엔진 초기화
function initGameEngine() {
  gameEngine = new GameEngine('game-canvas', touchManager, {
    onGameOver: onGameOverCallback,
    onTimeUpdate: onTimeUpdateCallback,
    onResetBestScore: onBestScoreLoadedCallback
  });
}

// 콜백
function onGameOverCallback(finalTime) {
  savedFinalScore = finalTime;
  gameoverUI.finalTime.textContent = RankingSystem.formatTime(finalTime);

  if (RankingSystem.isNewRecord(finalTime)) {
    gameoverUI.newRecordBadge.classList.remove('hidden');
    gameoverUI.rankingForm.classList.remove('hidden');
    gameoverUI.playerNameInput.value = '';
    setTimeout(() => gameoverUI.playerNameInput.focus(), 200);
  } else {
    gameoverUI.newRecordBadge.classList.add('hidden');
    gameoverUI.rankingForm.classList.add('hidden');
  }

  overlays.gameover.classList.remove('hidden');
}

function onTimeUpdateCallback(elapsedTime) {
  hud.time.textContent = RankingSystem.formatTime(elapsedTime);
}

function onBestScoreLoadedCallback(bestScore) {
  hud.best.textContent = RankingSystem.formatTime(bestScore);
}

// UI 이벤트 바인딩 (touchstart 사용 — 300ms 지연 방지)
function bindUIEvents() {
  // 시작 화면
  addTapEvent(btnStart, () => {
    gameAudio.init(); // 모바일 첫 터치에서 AudioContext 활성화
    switchScreen('game');
    showGameUI(true);
    tryFullscreen();
    gameEngine.start();
  });

  addTapEvent(btnShowRank, () => {
    switchScreen('ranking');
    showGameUI(false);
    RankingSystem.renderRankingTable(rankingTableBody, noRankingsMsg);
  });

  // 랭킹 화면
  addTapEvent(btnBackMenu, () => {
    switchScreen('start');
    showGameUI(false);
  });

  addTapEvent(btnResetRank, () => {
    if (confirm('모든 기록이 삭제됩니다. 초기화하시겠습니까?')) {
      RankingSystem.clearRankings();
      RankingSystem.renderRankingTable(rankingTableBody, noRankingsMsg);
      gameEngine.loadBestScore();
    }
  });

  // 일시정지
  addTapEvent(btnPause, () => {
    triggerPause();
  });

  addTapEvent(btnResume, () => {
    triggerResume();
  });

  addTapEvent(btnRestartPaused, () => {
    overlays.pause.classList.add('hidden');
    gameEngine.start();
  });

  addTapEvent(btnQuitPaused, () => {
    overlays.pause.classList.add('hidden');
    gameEngine.state = 'ready';
    gameAudio.stopBGM();
    switchScreen('start');
    showGameUI(false);
  });

  // 게임오버
  addTapEvent(btnRestartOver, () => {
    overlays.gameover.classList.add('hidden');
    gameEngine.start();
  });

  addTapEvent(btnQuitOver, () => {
    overlays.gameover.classList.add('hidden');
    gameEngine.state = 'ready';
    switchScreen('start');
    showGameUI(false);
  });

  // 랭킹 등록
  addTapEvent(gameoverUI.btnSubmitScore, () => {
    submitScore();
  });

  gameoverUI.playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitScore();
      // 모바일 키보드 닫기
      gameoverUI.playerNameInput.blur();
    }
  });

  // 사운드 토글
  addTapEvent(btnSoundToggle, () => {
    gameAudio.init();
    const isMuted = gameAudio.toggleMute();
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
  });

  // ESC 키 (외부 키보드 연결 시)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (gameEngine.state === 'playing') {
        triggerPause();
      } else if (gameEngine.state === 'paused') {
        triggerResume();
      }
    }
  });
}

// 터치/클릭 이벤트 헬퍼 (300ms 지연 방지)
function addTapEvent(el, handler) {
  let handled = false;
  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handled = true;
    handler();
  }, { passive: false });

  el.addEventListener('click', () => {
    if (!handled) handler();
    handled = false;
  });
}

// 일시정지
function triggerPause() {
  gameEngine.pause();
  overlays.pause.classList.remove('hidden');
}

function triggerResume() {
  overlays.pause.classList.add('hidden');
  gameEngine.resume();
}

// 점수 등록
function submitScore() {
  const name = gameoverUI.playerNameInput.value.trim();
  if (!name) {
    alert('이름을 입력해 주세요!');
    return;
  }

  RankingSystem.addScore(name, savedFinalScore);
  overlays.gameover.classList.add('hidden');
  gameEngine.loadBestScore();

  switchScreen('ranking');
  showGameUI(false);
  RankingSystem.renderRankingTable(rankingTableBody, noRankingsMsg);
}

// 화면 전환
function switchScreen(targetScreenName) {
  Object.keys(screens).forEach((name) => {
    if (name === targetScreenName) {
      screens[name].classList.add('active');
    } else {
      screens[name].classList.remove('active');
    }
  });
}

// 게임 UI (HUD + 터치패드 + 일시정지 버튼) 표시/숨김
function showGameUI(show) {
  if (show) {
    hud.container.classList.add('active');
    touchPad.classList.add('active');
    btnPause.classList.remove('hidden');
  } else {
    hud.container.classList.remove('active');
    touchPad.classList.remove('active');
    btnPause.classList.add('hidden');
  }
}

// 세로 방향 잠금 시도
function tryLockOrientation() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('portrait').catch(() => {
      // 잠금 불가 환경 (데스크톱 브라우저 등)은 무시
    });
  }
}

// 풀스크린 시도
function tryFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  }
}
