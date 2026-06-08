/**
 * 터치 입력 매니저 — 가상 패드 기반 멀티터치 지원
 * 키보드 keys 객체와 동일한 인터페이스를 제공하여 Player와 호환
 */

export class TouchManager {
  constructor() {
    // 키보드 호환 키 상태 객체
    this.keys = {
      'ArrowLeft': false,
      'ArrowRight': false,
      'ArrowUp': false,
      'ArrowDown': false,
    };

    // 활성 터치 포인트 추적 (멀티터치용)
    this._activeTouches = new Map();

    // 버튼 요소 참조
    this._btnLeft = null;
    this._btnRight = null;
    this._btnJump = null;
    this._btnDuck = null;

    // 점프 키 누름 추적 (2단 점프 키 반복 방지용)
    this._jumpTouchActive = false;
  }

  // 가상 패드 버튼 요소 바인딩
  init(btnLeftEl, btnRightEl, btnJumpEl, btnDuckEl) {
    this._btnLeft = btnLeftEl;
    this._btnRight = btnRightEl;
    this._btnJump = btnJumpEl;
    this._btnDuck = btnDuckEl;

    // 각 버튼에 터치 이벤트 바인딩
    this._bindButton(btnLeftEl, 'ArrowLeft');
    this._bindButton(btnRightEl, 'ArrowRight');
    this._bindButton(btnDuckEl, 'ArrowDown');
    this._bindJumpButton(btnJumpEl);

    // 마우스 이벤트 fallback (데스크톱 테스트용)
    this._bindMouseButton(btnLeftEl, 'ArrowLeft');
    this._bindMouseButton(btnRightEl, 'ArrowRight');
    this._bindMouseButton(btnDuckEl, 'ArrowDown');
    this._bindMouseJumpButton(btnJumpEl);

    // 전역 터치 이벤트로 놓침 방지
    document.addEventListener('touchend', (e) => this._handleGlobalTouchEnd(e), { passive: false });
    document.addEventListener('touchcancel', (e) => this._handleGlobalTouchEnd(e), { passive: false });
  }

  // 마우스 방향 버튼 fallback
  _bindMouseButton(el, keyName) {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.keys[keyName] = true;
      el.classList.add('active');
    });
    el.addEventListener('mouseup', () => {
      this.keys[keyName] = false;
      el.classList.remove('active');
    });
    el.addEventListener('mouseleave', () => {
      this.keys[keyName] = false;
      el.classList.remove('active');
    });
  }

  // 마우스 점프 버튼 fallback
  _bindMouseJumpButton(el) {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.keys['ArrowUp'] = true;
      el.classList.add('active');
    });
    el.addEventListener('mouseup', () => {
      this.keys['ArrowUp'] = false;
      el.classList.remove('active');
    });
    el.addEventListener('mouseleave', () => {
      this.keys['ArrowUp'] = false;
      el.classList.remove('active');
    });
  }

  // 방향 버튼 바인딩 (연속 입력)
  _bindButton(el, keyName) {
    el.addEventListener('touchstart', (e) => {
      if (e.cancelable) e.preventDefault();
      this.keys[keyName] = true;
      el.classList.add('active');
      this._hapticTap();

      // 터치 ID 기록
      for (const touch of e.changedTouches) {
        this._activeTouches.set(touch.identifier, { el, keyName });
      }
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      if (e.cancelable) e.preventDefault();
      // 해당 버튼의 터치가 모두 떼어졌는지 확인
      for (const touch of e.changedTouches) {
        this._activeTouches.delete(touch.identifier);
      }
      // 아직 이 버튼에 다른 터치가 남아있는지 확인
      let stillTouching = false;
      for (const [, info] of this._activeTouches) {
        if (info.keyName === keyName) {
          stillTouching = true;
          break;
        }
      }
      if (!stillTouching) {
        this.keys[keyName] = false;
        el.classList.remove('active');
      }
    }, { passive: false });

    el.addEventListener('touchcancel', (e) => {
      if (e.cancelable) e.preventDefault();
      for (const touch of e.changedTouches) {
        this._activeTouches.delete(touch.identifier);
      }
      this.keys[keyName] = false;
      el.classList.remove('active');
    }, { passive: false });
  }

  // 점프 버튼 바인딩 (탭 방식 — 누를 때마다 새 점프 트리거)
  _bindJumpButton(el) {
    el.addEventListener('touchstart', (e) => {
      if (e.cancelable) e.preventDefault();
      // 매번 false → true 전환으로 Player의 _jumpKeyWasDown 감지 트리거
      this.keys['ArrowUp'] = true;
      el.classList.add('active');
      this._hapticTap();

      for (const touch of e.changedTouches) {
        this._activeTouches.set(touch.identifier, { el, keyName: 'ArrowUp', isJump: true });
      }
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      if (e.cancelable) e.preventDefault();
      for (const touch of e.changedTouches) {
        this._activeTouches.delete(touch.identifier);
      }
      let stillTouching = false;
      for (const [, info] of this._activeTouches) {
        if (info.keyName === 'ArrowUp') {
          stillTouching = true;
          break;
        }
      }
      if (!stillTouching) {
        this.keys['ArrowUp'] = false;
        el.classList.remove('active');
      }
    }, { passive: false });

    el.addEventListener('touchcancel', (e) => {
      if (e.cancelable) e.preventDefault();
      for (const touch of e.changedTouches) {
        this._activeTouches.delete(touch.identifier);
      }
      this.keys['ArrowUp'] = false;
      el.classList.remove('active');
    }, { passive: false });
  }

  // 전역 터치 종료 핸들러 (손가락이 버튼 밖으로 벗어났을 때 처리)
  _handleGlobalTouchEnd(e) {
    for (const touch of e.changedTouches) {
      const info = this._activeTouches.get(touch.identifier);
      if (info) {
        this._activeTouches.delete(touch.identifier);
        // 해당 키에 다른 터치가 남아있는지 확인
        let stillTouching = false;
        for (const [, other] of this._activeTouches) {
          if (other.keyName === info.keyName) {
            stillTouching = true;
            break;
          }
        }
        if (!stillTouching) {
          this.keys[info.keyName] = false;
          if (info.el) info.el.classList.remove('active');
        }
      }
    }
  }

  // 모든 입력 초기화 (게임 재시작 시)
  reset() {
    this.keys['ArrowLeft'] = false;
    this.keys['ArrowRight'] = false;
    this.keys['ArrowUp'] = false;
    this.keys['ArrowDown'] = false;
    this._activeTouches.clear();

    if (this._btnLeft) this._btnLeft.classList.remove('active');
    if (this._btnRight) this._btnRight.classList.remove('active');
    if (this._btnJump) this._btnJump.classList.remove('active');
    if (this._btnDuck) this._btnDuck.classList.remove('active');
  }

  // 가벼운 햅틱(진동) 피드백
  _hapticTap() {
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
  }

  // 강한 햅틱(진동) 피드백 — 피격 시 외부에서 호출
  hapticHit() {
    if (navigator.vibrate) {
      navigator.vibrate([30, 20, 50]);
    }
  }
}
