/**
 * Web Audio API 기반 프로그래밍 사운드 시스템 (모바일 최적화)
 * 별도 MP3/WAV 없이 오실레이터와 노이즈 버퍼로 효과음 및 BGM 구현
 */

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmIntervalId = null;
    this.isMuted = false;

    // BGM 음계 (펜타토닉/쿵푸 느낌의 레트로 8비트 멜로디)
    this.bgmNotes = [
      261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66,
      392.00, 440.00, 523.25, 440.00, 392.00, 329.63, 293.66, 261.63
    ];
    this.bgmStep = 0;
  }

  // 모바일 Safari 등에서는 사용자 제스처 이후에만 AudioContext 시작 가능
  init() {
    if (this.ctx) {
      // 이미 생성되었지만 suspended 상태일 수 있음 (모바일)
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  // 음소거 토글
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : 0.3;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // BGM 시작
  startBGM() {
    this.init();
    if (!this.ctx) return;
    this.stopBGM();

    const tempo = 200;
    this.bgmStep = 0;

    this.bgmIntervalId = setInterval(() => {
      if (this.ctx.state === 'suspended') return;
      const freq = this.bgmNotes[this.bgmStep];
      this.playBeep(freq, 0.15, 'triangle', 0.5);
      this.bgmStep = (this.bgmStep + 1) % this.bgmNotes.length;
    }, tempo);
  }

  // BGM 중지
  stopBGM() {
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  // 레트로 비프음 재생 헬퍼
  playBeep(freq, duration, type = 'sine', volume = 1.0) {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // 점프 효과음
  playJumpSound() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.15);

    gainNode.gain.setValueAtTime(0.6, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // 총알 밟기 성공 효과음 (상승 아르페지오 + 반짝이는 느낌)
  playStompSound() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    // 메인 상승음
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc1.frequency.exponentialRampToValueAtTime(1046.50, this.ctx.currentTime + 0.12); // C6
    gain1.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start();
    osc1.stop(this.ctx.currentTime + 0.2);

    // 보조 반짝음 (약간 딜레이)
    setTimeout(() => {
      if (!this.ctx || this.isMuted) return;
      this.playBeep(1318.51, 0.1, 'sine', 0.35); // E6
    }, 60);

    setTimeout(() => {
      if (!this.ctx || this.isMuted) return;
      this.playBeep(1567.98, 0.08, 'sine', 0.25); // G6
    }, 120);
  }

  // 총알 통과 사운드
  playPassSound() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);

    gainNode.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  // 피격 폭발음
  playExplosionSound() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.35);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    noiseSource.start();
    noiseSource.stop(this.ctx.currentTime + 0.4);

    this.playBeep(90, 0.3, 'sawtooth', 0.7);
  }

  // 게임 오버 멜로디
  playGameOverSound() {
    this.init();
    this.stopBGM();
    if (!this.ctx || this.isMuted) return;

    const notes = [392.00, 349.23, 311.13, 261.63];
    const noteDuration = 0.25;

    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (this.isMuted) return;
        this.playBeep(freq, noteDuration - 0.05, 'sawtooth', 0.5);
      }, idx * noteDuration * 1000);
    });
  }
}

// 싱글톤 인스턴스 수출
export const gameAudio = new AudioSystem();
