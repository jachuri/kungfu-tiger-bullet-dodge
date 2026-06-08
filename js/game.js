/**
 * 게임 엔진 — 모바일 세로 캔버스 전용
 * 동적 리사이즈, 터치 입력 연동, devicePixelRatio 대응
 */

import { Player } from './player.js';
import { Bullet } from './bullet.js';
import { gameAudio } from './audio.js';
import { RankingSystem } from './ranking.js';

export class GameEngine {
  constructor(canvasId, touchManager, callbacks) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.touchManager = touchManager;

    // 콜백 바인딩
    this.onGameOver = callbacks.onGameOver;
    this.onTimeUpdate = callbacks.onTimeUpdate;
    this.onResetBestScore = callbacks.onResetBestScore;

    // 캔버스 크기 설정 (동적)
    this._setupCanvas();

    // 게임 상태
    this.state = 'ready'; // 'ready', 'playing', 'paused', 'gameover'

    // 객체
    this.player = new Player(this.canvasWidth, this.canvasHeight);
    this.bullets = [];

    // 시간/난이도
    this.elapsedTime = 0;
    this.lastTime = 0;
    this.spawnTimer = 0;

    // 글로벌 게임 속도 배수 (1.0 = 기본, 0.85 = 15% 감속)
    this.gameSpeed = 0.85;

    // 파티클
    this.particles = [];

    // 떠오르는 텍스트 (Nice! 등)
    this.floatingTexts = [];

    // 밟기 콤보
    this.stompCombo = 0;

    // 최고 기록
    this.bestScore = 0;
    this.loadBestScore();

    // 리사이즈 이벤트
    window.addEventListener('resize', () => this._handleResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this._handleResize(), 100);
    });
  }

  // 캔버스 동적 크기 설정 (devicePixelRatio 대응)
  _setupCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // 게임 영역 비율 제한 (최대 3:4, 너비:높이)
    // 세로가 너무 길면 총알 범위가 넓어져 긴장감이 사라짐
    const maxRatio = 1.35; // height / width 최대값
    let logicW = rect.width;
    let logicH = rect.height;

    if (logicH / logicW > maxRatio) {
      logicH = Math.round(logicW * maxRatio);
    }

    // CSS 크기
    this.canvas.style.width = logicW + 'px';
    this.canvas.style.height = logicH + 'px';

    // 내부 해상도 (고DPI 대응)
    this.canvas.width = Math.round(logicW * dpr);
    this.canvas.height = Math.round(logicH * dpr);

    // 스케일 적용
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 논리적 크기 (게임 좌표계)
    this.canvasWidth = logicW;
    this.canvasHeight = logicH;
  }

  // 리사이즈 핸들러
  _handleResize() {
    this._setupCanvas();
    if (this.player) {
      this.player.resize(this.canvasWidth, this.canvasHeight);
    }
    // 현재 화면 다시 그리기
    if (this.state !== 'playing') {
      this.draw();
    }
  }

  // 최고 기록 로드
  loadBestScore() {
    const rankings = RankingSystem.getRankings();
    if (rankings.length > 0) {
      this.bestScore = rankings[0].score;
    } else {
      this.bestScore = 0;
    }
    this.onResetBestScore(this.bestScore);
  }

  // 게임 시작
  start() {
    this._setupCanvas();
    this.state = 'playing';
    this.elapsedTime = 0;
    this.spawnTimer = 0;
    this.bullets = [];
    this.particles = [];
    this.floatingTexts = [];
    this.stompCombo = 0;
    this.player = new Player(this.canvasWidth, this.canvasHeight);
    this.touchManager.reset();

    gameAudio.startBGM();

    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  // 일시정지 / 재개
  pause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      gameAudio.stopBGM();
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'playing';
      gameAudio.startBGM();
      this.lastTime = performance.now();
      requestAnimationFrame((time) => this.gameLoop(time));
    }
  }

  // 게임 루프
  gameLoop(currentTime) {
    if (this.state !== 'playing') return;

    const dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    const limitedDt = Math.min(dt, 0.1) * this.gameSpeed;

    this.update(limitedDt);
    this.draw();

    requestAnimationFrame((time) => this.gameLoop(time));
  }

  // 업데이트
  update(dt) {
    this.elapsedTime += dt;
    this.onTimeUpdate(this.elapsedTime);

    // 터치 매니저의 keys를 사용
    this.player.update(this.touchManager.keys);

    // 점프 사운드
    if (this.player.hasJustJumped) {
      gameAudio.playJumpSound();
    }

    // 점프 파티클
    if (this.player.isJumping && this.player.vy === this.player.jumpForce + this.player.gravity) {
      this.createJumpDust(this.player.x + this.player.width / 2, this.player.groundY);
    }

    // 난이도
    const difficulty = this.getDifficultyConfig();

    // 총알 생성
    this.spawnTimer += dt * 1000;
    if (this.spawnTimer >= difficulty.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnBullet(difficulty.speed);
    }

    // 총알 업데이트 및 충돌
    const playerHitbox = this.player.getHitbox();

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update();

      if (bullet.isOutOfBoundary) {
        this.bullets.splice(i, 1);
        continue;
      }

      const bulletHitbox = bullet.getHitbox();

      // 밟기(Stomp) 판정: 낙하 중 + 플레이어 하단이 총알 상단 근처
      if (this.player.vy > 0 && !this.player.isDead) {
        const playerBottom = playerHitbox.y + playerHitbox.height;
        const bulletTop = bulletHitbox.y;
        const stompMargin = this.canvasWidth * 0.04;

        if (
          playerBottom >= bulletTop - stompMargin &&
          playerBottom <= bulletTop + bulletHitbox.height * 0.4 &&
          playerHitbox.x + playerHitbox.width > bulletHitbox.x &&
          playerHitbox.x < bulletHitbox.x + bulletHitbox.width
        ) {
          // 밟기 성공!
          this.stompCombo++;
          this.bullets.splice(i, 1);

          // 바운스 (콤보가 높을수록 강하게)
          const bounceForce = this.player.jumpForce * (0.85 + Math.min(this.stompCombo, 5) * 0.06);
          this.player.vy = bounceForce;
          this.player.isJumping = true;
          this.player.jumpCount = 1;

          // "Nice!" 텍스트 (콤보별 변화)
          let stompText = 'Nice!';
          let textColor = '#00e5ff';
          if (this.stompCombo >= 5) {
            stompText = `INCREDIBLE! x${this.stompCombo}`;
            textColor = '#ff1744';
          } else if (this.stompCombo >= 3) {
            stompText = `AWESOME! x${this.stompCombo}`;
            textColor = '#d500f9';
          } else if (this.stompCombo >= 2) {
            stompText = `Great! x${this.stompCombo}`;
            textColor = '#ffeb3b';
          }

          this.createFloatingText(
            bullet.x + bullet.width / 2,
            bullet.y,
            stompText,
            textColor
          );

          // 밟기 파티클 (별 모양 터지는 효과)
          this.createStompParticles(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);

          // 사운드 & 햅틱
          gameAudio.playStompSound();
          this.touchManager.hapticHit();

          continue;
        }
      }

      if (this.checkCollision(playerHitbox, bulletHitbox)) {
        this.triggerGameOver();
        return;
      }

      // 스치기(Grazing) 효과
      if (!bullet.hasGrazed) {
        const grazeMargin = this.canvasWidth * 0.03;
        const grazeHitbox = {
          x: playerHitbox.x - grazeMargin,
          y: playerHitbox.y - grazeMargin,
          width: playerHitbox.width + grazeMargin * 2,
          height: playerHitbox.height + grazeMargin * 2
        };
        if (this.checkCollision(grazeHitbox, bulletHitbox)) {
          bullet.hasGrazed = true;
          gameAudio.playPassSound();
          this.createGrazeSpark(bullet.x, bullet.y);
        }
      }
    }

    // 파티클 업데이트
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 떠오르는 텍스트 업데이트
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= ft.decay;
      ft.scale += ft.scaleSpeed;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 바닥에 있으면 콤보 리셋
    if (!this.player.isJumping) {
      this.stompCombo = 0;
    }
  }

  // 난이도 곡선 (모바일: 좁은 화면이므로 약간 완화)
  getDifficultyConfig() {
    const time = this.elapsedTime;
    const scale = this.canvasWidth / 400;

    let baseSpeed = 4.5 * scale;
    let spawnInterval = 800;

    if (time < 10) {
      baseSpeed = (4.5 + (time / 10) * 0.6) * scale;
      spawnInterval = 800 - (time / 10) * 100;
    } else if (time < 20) {
      baseSpeed = (5.1 + ((time - 10) / 10) * 0.7) * scale;
      spawnInterval = 1400 - ((time - 10) / 10) * 200;
    } else if (time < 30) {
      baseSpeed = (5.8 + ((time - 20) / 10) * 0.7) * scale;
      spawnInterval = 1200 - ((time - 20) / 10) * 150;
    } else if (time < 45) {
      baseSpeed = (6.5 + ((time - 30) / 15) * 0.8) * scale;
      spawnInterval = 1050 - ((time - 30) / 15) * 150;
    } else if (time < 60) {
      baseSpeed = (7.3 + ((time - 45) / 15) * 0.8) * scale;
      spawnInterval = 900 - ((time - 45) / 15) * 150;
    } else if (time < 90) {
      baseSpeed = (8.1 + ((time - 60) / 30) * 1.0) * scale;
      spawnInterval = 750 - ((time - 60) / 30) * 150;
    } else {
      const factor = Math.min((time - 90) / 60, 1.0);
      baseSpeed = (9.1 + factor * 1.2) * scale;
      spawnInterval = 600 - factor * 100;
    }

    return { speed: baseSpeed, spawnInterval };
  }

  // 총알 소환
  spawnBullet(speedMultiplier) {
    const types = ['left', 'right', 'top'];
    const type = types[Math.floor(Math.random() * types.length)];
    const finalSpeed = speedMultiplier * (0.9 + Math.random() * 0.2);
    const bullet = new Bullet(this.canvasWidth, this.canvasHeight, type, finalSpeed);
    this.bullets.push(bullet);
  }

  // AABB 충돌 검출
  checkCollision(r1, r2) {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  }

  // 게임오버 트리거
  triggerGameOver() {
    this.state = 'gameover';
    this.player.isDead = true;

    gameAudio.playExplosionSound();
    gameAudio.playGameOverSound();

    // 햅틱 피드백
    this.touchManager.hapticHit();

    const hb = this.player.getHitbox();
    this.createExplosionParticles(hb.x + hb.width / 2, hb.y + hb.height / 2);

    // 폭발 연출 감상 후 오버레이
    setTimeout(() => {
      if (this.state === 'gameover') {
        this.onGameOver(this.elapsedTime);
      }
    }, 1000);
  }

  // 렌더링
  draw() {
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.drawDojoBackground();
    this.drawGround();

    // 파티클
    this.particles.forEach((p) => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 총알
    this.bullets.forEach((bullet) => {
      bullet.draw(this.ctx);
    });

    // 플레이어
    this.player.draw(this.ctx);

    // 떠오르는 텍스트 (최상위 레이어)
    this.floatingTexts.forEach((ft) => {
      this.ctx.save();
      this.ctx.globalAlpha = ft.alpha;
      this.ctx.fillStyle = ft.color;
      this.ctx.font = `900 ${Math.round(ft.fontSize * ft.scale)}px Orbitron, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      // 글로우 효과
      this.ctx.shadowColor = ft.color;
      this.ctx.shadowBlur = 12;

      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.shadowBlur = 0;
      this.ctx.restore();
    });
  }

  // 도장 배경
  drawDojoBackground() {
    const ctx = this.ctx;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    bgGrad.addColorStop(0, '#0c0c1b');
    bgGrad.addColorStop(1, '#05050f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // 격자
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = Math.round(this.canvasWidth / 10);

    for (let x = 0; x < this.canvasWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y < this.canvasHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvasWidth, y);
      ctx.stroke();
    }

    // 도장 심볼
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight * 0.4;
    const radius = this.canvasWidth * 0.28;

    ctx.strokeStyle = 'rgba(213, 0, 249, 0.05)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.03)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.15, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 바닥
  drawGround() {
    const ctx = this.ctx;
    const groundY = this.player.groundY;

    ctx.fillStyle = '#100e23';
    ctx.fillRect(0, groundY, this.canvasWidth, this.canvasHeight - groundY);

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(this.canvasWidth, groundY);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // 바닥 격자선
    ctx.strokeStyle = 'rgba(138, 138, 158, 0.2)';
    ctx.lineWidth = 1;
    const spacing = Math.round(this.canvasWidth / 8);
    for (let x = spacing; x < this.canvasWidth; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 10, this.canvasHeight);
      ctx.stroke();
    }
  }

  // 점프 먼지 파티클
  createJumpDust(x, y) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x, y: y - 2,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -Math.random() * 1.2,
        size: 2 + Math.random() * 3,
        color: 'rgba(255, 255, 255, 0.4)',
        alpha: 1.0,
        decay: 0.03 + Math.random() * 0.04
      });
    }
  }

  // 스치기 스파크
  createGrazeSpark(x, y) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        size: 1.5 + Math.random() * 1.5,
        color: '#ffeb3b',
        alpha: 1.0,
        decay: 0.05 + Math.random() * 0.05
      });
    }
  }

  // 폭발 파티클
  createExplosionParticles(x, y) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: Math.random() > 0.4 ? '#ff3d00' : '#ffeb3b',
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.02
      });
    }

    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 8,
        color: '#d500f9',
        alpha: 0.8,
        decay: 0.015 + Math.random() * 0.01
      });
    }
  }

  // 밟기 파티클 (별 모양 터지는 효과)
  createStompParticles(x, y) {
    const colors = ['#00e5ff', '#ffeb3b', '#00e676', '#ffffff'];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        size: 2.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: 0.025 + Math.random() * 0.015
      });
    }
  }

  // 떠오르는 텍스트 생성 (Nice!, Great!, AWESOME! 등)
  createFloatingText(x, y, text, color) {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      fontSize: Math.round(this.canvasWidth * 0.055),
      alpha: 1.0,
      decay: 0.012,
      vy: -1.8,
      scale: 0.5,
      scaleSpeed: 0.03
    });
  }
}
