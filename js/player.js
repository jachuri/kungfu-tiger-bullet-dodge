/**
 * 플레이어(쿵푸 호랑이) 클래스 — 모바일 세로 캔버스 전용
 * 2단 점프, 숙이기 지원, 캔버스 비례 스케일링
 */

export class Player {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // 호랑이 크기 (캔버스 너비 비례)
    this.width = Math.round(canvasWidth * 0.15);
    this.height = Math.round(canvasWidth * 0.15);
    this.baseHeight = this.height;
    this.duckHeight = Math.round(this.height * 0.53);

    // 물리 변수
    this.groundY = canvasHeight - Math.round(canvasHeight * 0.06);
    this.x = canvasWidth / 2 - this.width / 2;
    this.y = this.groundY - this.height;

    this.vx = 0;
    this.vy = 0;

    // 물리 상수 (캔버스 크기 비례 스케일링)
    const scale = canvasWidth / 400; // 기준 너비 400px
    this.speed = 5.5 * scale;
    this.jumpForce = -13.5 * scale;
    this.gravity = 0.6 * scale;
    this.friction = 0.85;

    // 상태 변수
    this.isJumping = false;
    this.jumpCount = 0;
    this.maxJumps = 2; // 2단 점프
    this.facing = 'right';
    this.isDead = false;
    this.isDucking = false;
    this.hasJustJumped = false;
    this.hasJustDucked = false;

    // 이미지 로드
    this.imgStanding = new Image();
    this.imgStanding.src = 'assets/svg/tiger.svg';
    this.imgStandingLoaded = false;
    this.imgStanding.onload = () => { this.imgStandingLoaded = true; };
    this.imgStanding.onerror = () => { this.imgStandingLoaded = false; };

    this.imgJumping = new Image();
    this.imgJumping.src = 'assets/svg/tiger-jump.svg';
    this.imgJumpingLoaded = false;
    this.imgJumping.onload = () => { this.imgJumpingLoaded = true; };
    this.imgJumping.onerror = () => { this.imgJumpingLoaded = false; };

    this.imgDucking = new Image();
    this.imgDucking.src = 'assets/svg/tiger-duck.svg';
    this.imgDuckingLoaded = false;
    this.imgDucking.onload = () => { this.imgDuckingLoaded = true; };
    this.imgDucking.onerror = () => { this.imgDuckingLoaded = false; };
  }

  // 캔버스 리사이즈 시 호출
  resize(canvasWidth, canvasHeight) {
    const oldGroundY = this.groundY;
    const oldWidth = this.width;

    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.width = Math.round(canvasWidth * 0.15);
    this.height = Math.round(canvasWidth * 0.15);
    this.baseHeight = this.height;
    this.duckHeight = Math.round(this.height * 0.53);
    this.groundY = canvasHeight - Math.round(canvasHeight * 0.06);

    const scale = canvasWidth / 400;
    this.speed = 5.5 * scale;
    this.jumpForce = -13.5 * scale;
    this.gravity = 0.6 * scale;

    // 위치 보정
    this.x = (this.x / (this.canvasWidth || 1)) * canvasWidth;
    if (this.y + this.height >= oldGroundY) {
      this.y = this.groundY - this.height;
    }
  }

  // 초기 상태 재설정
  reset() {
    this.height = this.baseHeight;
    this.x = this.canvasWidth / 2 - this.width / 2;
    this.y = this.groundY - this.height;
    this.vx = 0;
    this.vy = 0;
    this.isJumping = false;
    this.jumpCount = 0;
    this.facing = 'right';
    this.isDead = false;
    this.isDucking = false;
    this.hasJustJumped = false;
    this.hasJustDucked = false;
  }

  // 매 프레임 업데이트
  update(keys) {
    if (this.isDead) return;

    this.hasJustJumped = false;
    this.hasJustDucked = false;

    // 1. 좌우 이동 입력 처리
    let moveDirection = 0;
    if (keys['ArrowLeft']) {
      moveDirection = -1;
      this.facing = 'left';
    }
    if (keys['ArrowRight']) {
      moveDirection = 1;
      this.facing = 'right';
    }

    // 가속도 및 마찰 적용
    if (moveDirection !== 0) {
      this.vx = moveDirection * this.speed;
    } else {
      this.vx *= this.friction;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    // X축 위치 이동 및 벽 제한
    this.x += this.vx;
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    } else if (this.x + this.width > this.canvasWidth) {
      this.x = this.canvasWidth - this.width;
      this.vx = 0;
    }

    // 2. 점프 입력 및 중력 (2단 점프)
    if ((keys['ArrowUp'] || keys[' ']) && this.jumpCount < this.maxJumps) {
      if (!this._jumpKeyWasDown) {
        this.vy = this.jumpForce;
        this.isJumping = true;
        this.jumpCount++;
        this.hasJustJumped = true;

        // 숙이기 상태에서 점프하면 숙이기 해제
        if (this.isDucking) {
          this.isDucking = false;
          this.height = this.baseHeight;
          this.y -= (this.baseHeight - this.duckHeight);
        }
      }
    }
    this._jumpKeyWasDown = !!(keys['ArrowUp'] || keys[' ']);

    // 3. 숙이기 입력 처리 (바닥에 있을 때만)
    if (keys['ArrowDown'] && !this.isJumping) {
      if (!this.isDucking) {
        this.isDucking = true;
        this.height = this.duckHeight;
        this.y = this.groundY - this.height;
        this.hasJustDucked = true;
      }
    } else if (!keys['ArrowDown'] && this.isDucking && !this.isJumping) {
      this.isDucking = false;
      this.height = this.baseHeight;
      this.y = this.groundY - this.height;
    }

    // 중력 적용
    this.vy += this.gravity;
    this.y += this.vy;

    // 바닥 착지
    if (this.y + this.height >= this.groundY) {
      this.y = this.groundY - this.height;
      this.vy = 0;
      this.isJumping = false;
      this.jumpCount = 0;
    }
  }

  // 현재 상태 반환
  getState() {
    if (this.isJumping) return 'jumping';
    if (this.isDucking) return 'ducking';
    return 'standing';
  }

  // 충돌 히트박스
  getHitbox() {
    const paddingX = this.width * 0.22;
    const paddingY = this.height * 0.15;
    return {
      x: this.x + paddingX,
      y: this.y + paddingY,
      width: this.width - (paddingX * 2),
      height: this.height - (paddingY * 2)
    };
  }

  // 그리기
  draw(ctx) {
    ctx.save();

    // 방향에 따른 수평 뒤집기
    if (this.facing === 'left') {
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
    }

    const state = this.getState();
    let currentImg, isLoaded;

    if (state === 'jumping') {
      currentImg = this.imgJumping;
      isLoaded = this.imgJumpingLoaded;
    } else if (state === 'ducking') {
      currentImg = this.imgDucking;
      isLoaded = this.imgDuckingLoaded;
    } else {
      currentImg = this.imgStanding;
      isLoaded = this.imgStandingLoaded;
    }

    if (isLoaded) {
      ctx.drawImage(currentImg, this.x, this.y, this.width, this.height);
    } else {
      this.drawFallback(ctx);
    }

    ctx.restore();
  }

  // Fallback 캔버스 드로잉
  drawFallback(ctx) {
    const px = this.x;
    const py = this.y;
    const w = this.width;
    const h = this.height;

    // 머리
    ctx.fillStyle = '#f27c22';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + h / 3, w * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // 귀
    ctx.beginPath();
    ctx.arc(px + w / 2 - w * 0.2, py + h / 3 - h * 0.2, w * 0.08, 0, Math.PI * 2);
    ctx.arc(px + w / 2 + w * 0.2, py + h / 3 - h * 0.2, w * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f9a7a7';
    ctx.beginPath();
    ctx.arc(px + w / 2 - w * 0.2, py + h / 3 - h * 0.2, w * 0.04, 0, Math.PI * 2);
    ctx.arc(px + w / 2 + w * 0.2, py + h / 3 - h * 0.2, w * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // 눈
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(px + w / 2 - w * 0.09, py + h / 3 - h * 0.02, 2.5, 0, Math.PI * 2);
    ctx.arc(px + w / 2 + w * 0.09, py + h / 3 - h * 0.02, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 몸통 (녹색 도복)
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    if (this.isJumping) {
      ctx.moveTo(px + w * 0.35, py + h * 0.5);
      ctx.lineTo(px + w * 0.75, py + h * 0.45);
      ctx.lineTo(px + w * 0.7, py + h * 0.75);
      ctx.lineTo(px + w * 0.4, py + h * 0.75);
    } else {
      ctx.moveTo(px + w * 0.3, py + h * 0.5);
      ctx.lineTo(px + w * 0.7, py + h * 0.5);
      ctx.lineTo(px + w * 0.65, py + h * 0.8);
      ctx.lineTo(px + w * 0.35, py + h * 0.8);
    }
    ctx.closePath();
    ctx.fill();

    // 띠
    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(px + w * 0.33, py + h * 0.75, w * 0.34, 3);

    // 다리 (짙은 녹색)
    ctx.fillStyle = '#1B5E20';
    if (this.isJumping) {
      ctx.fillRect(px + w * 0.65, py + h * 0.7, w * 0.25, h * 0.12);
    } else {
      ctx.fillRect(px + w * 0.25, py + h * 0.8, w * 0.12, h * 0.12);
      ctx.fillRect(px + w * 0.63, py + h * 0.8, w * 0.12, h * 0.12);
    }
  }
}
