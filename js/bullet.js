/**
 * 총알(장애물) 클래스 — 모바일 세로 캔버스 전용
 * 캔버스 비례 스케일링, left/right/top 3방향 발사
 */

export class Bullet {
  constructor(canvasWidth, canvasHeight, type, baseSpeed) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.type = type; // 'left', 'right', 'top'
    this.speed = baseSpeed;

    this.isOutOfBoundary = false;
    this.hasGrazed = false;

    // 스케일 팩터 (기준 너비 400px)
    const scale = canvasWidth / 400;

    if (this.type === 'left' || this.type === 'right') {
      // 수평 총알
      this.width = Math.round(36 * scale);
      this.height = Math.round(14 * scale);

      // Y좌표: 플레이어 활동 영역에만 생성 (바닥 ~ 2단 점프 최대 높이)
      const groundY = canvasHeight * 0.94;
      const maxJumpReach = canvasHeight * 0.45; // 2단 점프 최대 도달 높이
      const minY = groundY - maxJumpReach;
      const maxY = groundY - canvasHeight * 0.04; // 바닥 약간 위
      this.y = minY + Math.random() * (maxY - minY);

      if (this.type === 'left') {
        this.x = -this.width;
        this.vx = this.speed;
      } else {
        this.x = canvasWidth;
        this.vx = -this.speed;
      }
      this.vy = 0;
    } else {
      // 수직 총알 (위에서 떨어짐)
      this.width = Math.round(14 * scale);
      this.height = Math.round(36 * scale);

      this.x = Math.random() * (canvasWidth - this.width);
      this.y = -this.height;
      this.vx = 0;
      this.vy = this.speed;
    }

    // SVG 이미지 로드
    this.imgH = new Image();
    this.imgH.src = 'assets/svg/bullet-h.svg';
    this.imgHLoaded = false;
    this.imgH.onload = () => { this.imgHLoaded = true; };
    this.imgH.onerror = () => { this.imgHLoaded = false; };

    this.imgV = new Image();
    this.imgV.src = 'assets/svg/bullet-v.svg';
    this.imgVLoaded = false;
    this.imgV.onload = () => { this.imgVLoaded = true; };
    this.imgV.onerror = () => { this.imgVLoaded = false; };
  }

  // 매 프레임 업데이트
  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.type === 'left' && this.x > this.canvasWidth) {
      this.isOutOfBoundary = true;
    } else if (this.type === 'right' && this.x + this.width < 0) {
      this.isOutOfBoundary = true;
    } else if (this.type === 'top' && this.y > this.canvasHeight) {
      this.isOutOfBoundary = true;
    }
  }

  // 축소된 히트박스
  getHitbox() {
    const paddingX = this.width * 0.15;
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

    if (this.type === 'left' || this.type === 'right') {
      if (this.type === 'right') {
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
      }

      if (this.imgHLoaded) {
        ctx.drawImage(this.imgH, this.x, this.y, this.width, this.height);
      } else {
        this.drawFallbackH(ctx);
      }
    } else {
      if (this.imgVLoaded) {
        ctx.drawImage(this.imgV, this.x, this.y, this.width, this.height);
      } else {
        this.drawFallbackV(ctx);
      }
    }

    ctx.restore();
  }

  // 수평 총알 Fallback 드로잉
  drawFallbackH(ctx) {
    const px = this.x;
    const py = this.y;
    const w = this.width;
    const h = this.height;

    const grad = ctx.createLinearGradient(px + w, py + h / 2, px, py + h / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, '#ffeb3b');
    grad.addColorStop(0.6, '#ff3d00');
    grad.addColorStop(1, 'rgba(213, 0, 249, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px + w, py + h / 2);
    ctx.quadraticCurveTo(px + w * 0.7, py, px, py + h * 0.3);
    ctx.quadraticCurveTo(px + w * 0.2, py + h / 2, px, py + h / 2);
    ctx.quadraticCurveTo(px + w * 0.2, py + h * 0.7, px, py + h * 0.7);
    ctx.quadraticCurveTo(px + w * 0.7, py + h, px + w, py + h / 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(px + w * 0.8, py + h / 2, w * 0.15, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 수직 총알 Fallback 드로잉
  drawFallbackV(ctx) {
    const px = this.x;
    const py = this.y;
    const w = this.width;
    const h = this.height;

    const grad = ctx.createLinearGradient(px + w / 2, py + h, px + w / 2, py);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, '#00e5ff');
    grad.addColorStop(0.6, '#2979ff');
    grad.addColorStop(1, 'rgba(41, 121, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py + h);
    ctx.quadraticCurveTo(px, py + h * 0.7, px + w * 0.3, py);
    ctx.lineTo(px + w * 0.7, py);
    ctx.quadraticCurveTo(px + w, py + h * 0.7, px + w / 2, py + h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(px + w / 2, py + h * 0.8, w * 0.2, h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
