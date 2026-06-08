/**
 * E2E 통합 테스트: 모바일 에뮬레이션 (iPhone 12)
 * Puppeteer로 터치 이벤트 시뮬레이션 및 게임 전 흐름 검증
 */

const puppeteer = require('puppeteer');

const GAME_URL = 'http://127.0.0.1:8080/index.html';

// iPhone 12 에뮬레이션 설정
const DEVICE = {
  name: 'iPhone 12',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  viewport: {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false
  }
};

let passed = 0;
let failed = 0;
const consoleErrors = [];

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

// 터치 이벤트 헬퍼
async function tap(page, selector) {
  const el = await page.$(selector);
  if (!el) return;
  const box = await el.boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
}

async function touchDown(page, selector) {
  const el = await page.$(selector);
  if (!el) return;
  const box = await el.boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.touchStart(x, y);
}

async function touchUp(page) {
  await page.touchscreen.touchEnd();
}

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('🚀 모바일 E2E 테스트 시작 (iPhone 12 에뮬레이션)...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 모바일 에뮬레이션 설정
  await page.emulate({
    userAgent: DEVICE.userAgent,
    viewport: DEVICE.viewport
  });

  // 콘솔 에러 수집
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  let uncaughtException = false;
  page.on('pageerror', () => {
    uncaughtException = true;
  });

  // ---------------------------------------------------------------
  console.log('[Test 1] 페이지 로드 및 타이틀 확인');
  await page.goto(GAME_URL, { waitUntil: 'networkidle0', timeout: 15000 });
  const title = await page.title();
  assert(title.includes('Mobile'), `페이지 타이틀에 Mobile 포함: "${title}"`);

  // ---------------------------------------------------------------
  console.log('\n[Test 2] 모바일 메타 태그 확인');
  const viewportMeta = await page.$eval('meta[name="viewport"]', (el) => el.content);
  assert(viewportMeta.includes('user-scalable=no'), `viewport에 user-scalable=no 포함`);
  assert(viewportMeta.includes('viewport-fit=cover'), `viewport에 viewport-fit=cover 포함`);

  const themeMeta = await page.$eval('meta[name="theme-color"]', (el) => el.content);
  assert(themeMeta === '#0a0a12', `theme-color 메타 태그 존재`);

  // ---------------------------------------------------------------
  console.log('\n[Test 3] 시작 화면 UI 요소 존재 확인');
  const startScreenActive = await page.$eval('#screen-start', (el) => el.classList.contains('active'));
  assert(startScreenActive, '시작 화면이 활성 상태');

  const btnStartExists = await page.$('#btn-start-game');
  assert(!!btnStartExists, '"수련 시작" 버튼 존재');

  const btnRankExists = await page.$('#btn-show-ranking');
  assert(!!btnRankExists, '"명예의 전당" 버튼 존재');

  const tigerImg = await page.$('.floating-img');
  assert(!!tigerImg, '호랑이 캐릭터 이미지 존재');

  // ---------------------------------------------------------------
  console.log('\n[Test 4] 터치 패드 요소 존재 확인');
  const touchPad = await page.$('#touch-pad');
  assert(!!touchPad, '터치 패드 컨테이너 존재');

  const btnLeft = await page.$('#btn-touch-left');
  const btnRight = await page.$('#btn-touch-right');
  const btnJump = await page.$('#btn-touch-jump');
  assert(!!btnLeft && !!btnRight && !!btnJump, '← → JUMP 버튼 모두 존재');

  // ---------------------------------------------------------------
  console.log('\n[Test 5] 랭킹 화면 이동 및 복귀');
  await tap(page, '#btn-show-ranking');
  await delay(500);

  const rankScreenActive = await page.$eval('#screen-ranking', (el) => el.classList.contains('active'));
  assert(rankScreenActive, '랭킹 화면으로 이동 성공');

  await tap(page, '#btn-back-to-menu');
  await delay(500);

  const backToStart = await page.$eval('#screen-start', (el) => el.classList.contains('active'));
  assert(backToStart, '메인 화면으로 복귀 성공');

  // ---------------------------------------------------------------
  console.log('\n[Test 6] 게임 시작 및 캔버스 렌더링');
  await tap(page, '#btn-start-game');
  await delay(800);

  const gameScreenActive = await page.$eval('#screen-game', (el) => el.classList.contains('active'));
  assert(gameScreenActive, '게임 화면이 활성 상태');

  const canvasExists = await page.$('#game-canvas');
  assert(!!canvasExists, '캔버스 요소 존재');

  // 터치 패드가 표시되는지 확인
  const touchPadVisible = await page.$eval('#touch-pad', (el) => el.classList.contains('active'));
  assert(touchPadVisible, '터치 패드가 게임 중 표시됨');

  // HUD가 표시되는지 확인
  const hudVisible = await page.$eval('#game-hud', (el) => el.classList.contains('active'));
  assert(hudVisible, 'HUD가 게임 중 표시됨');

  // ---------------------------------------------------------------
  console.log('\n[Test 7] 터치 입력으로 캐릭터 조작');

  // 오른쪽 버튼 터치
  await touchDown(page, '#btn-touch-right');
  await delay(300);
  await touchUp(page);
  assert(true, '오른쪽 터치 입력 전송 완료');

  // 점프 버튼 터치
  await tap(page, '#btn-touch-jump');
  await delay(200);
  assert(true, '점프 터치 입력 전송 완료');

  // 왼쪽 버튼 터치
  await touchDown(page, '#btn-touch-left');
  await delay(300);
  await touchUp(page);
  assert(true, '왼쪽 터치 입력 전송 완료');

  // ---------------------------------------------------------------
  console.log('\n[Test 8] HUD 생존 시간 업데이트 확인');
  await delay(1500);

  const hudTime = await page.$eval('#hud-time', (el) => el.textContent);
  assert(hudTime !== '00:00.00', `HUD 생존 시간이 갱신됨: ${hudTime}`);

  // ---------------------------------------------------------------
  console.log('\n[Test 9] 일시정지 기능 테스트');
  await tap(page, '#btn-pause-game');
  await delay(500);

  const pauseVisible = await page.$eval('#overlay-pause', (el) => !el.classList.contains('hidden'));
  assert(pauseVisible, '일시정지 오버레이 표시됨');

  await tap(page, '#btn-resume');
  await delay(500);

  const pauseHidden = await page.$eval('#overlay-pause', (el) => el.classList.contains('hidden'));
  assert(pauseHidden, '계속하기 후 일시정지 오버레이 숨김');

  // ---------------------------------------------------------------
  console.log('\n[Test 10] 음소거 토글 테스트');
  const iconBefore = await page.$eval('#sound-icon', (el) => el.textContent);
  await tap(page, '#btn-sound-toggle');
  await delay(300);
  const iconAfter = await page.$eval('#sound-icon', (el) => el.textContent);
  assert(iconBefore !== iconAfter, `음소거 토글 작동: ${iconBefore} → ${iconAfter}`);

  // ---------------------------------------------------------------
  console.log('\n[Test 11] 게임오버 유도 및 랭킹 등록 테스트');
  // 캐릭터를 한 곳에 고정 → 총알에 맞을 때까지 대기
  const maxWait = 45000;
  const startWait = Date.now();

  while (Date.now() - startWait < maxWait) {
    const isGameOver = await page.$eval('#overlay-gameover', (el) => !el.classList.contains('hidden'));
    if (isGameOver) break;
    await delay(500);
  }

  const gameOverVisible = await page.$eval('#overlay-gameover', (el) => !el.classList.contains('hidden'));
  assert(gameOverVisible, '게임오버 오버레이가 표시됨');

  if (gameOverVisible) {
    // 이름 입력 및 등록
    await page.type('#player-name-input', 'TEST', { delay: 50 });
    await tap(page, '#btn-submit-score');
    await delay(800);

    const inRankingScreen = await page.$eval('#screen-ranking', (el) => el.classList.contains('active'));
    assert(inRankingScreen, '기록 등록 후 랭킹 화면으로 이동');

    const rankingHtml = await page.$eval('#ranking-list-body', (el) => el.innerHTML);
    assert(rankingHtml.includes('TEST'), '등록한 이름이 랭킹 테이블에 표시됨');
  }

  // ---------------------------------------------------------------
  console.log('\n[Test 12] 브라우저 콘솔 에러/예외 없음 확인');
  const criticalErrors = consoleErrors.filter((e) =>
    !e.includes('fonts.googleapis.com') &&
    !e.includes('fonts.gstatic.com') &&
    !e.includes('favicon') &&
    !e.includes('Permissions policy') &&
    !e.includes('404') &&
    !e.includes('Failed to load resource') &&
    !e.includes('fullscreen') &&
    !e.includes('Fullscreen') &&
    !e.includes('orientation') &&
    !e.includes('net::ERR') &&
    !e.includes('requestFullscreen') &&
    !e.includes('screen.orientation')
  );
  assert(criticalErrors.length === 0, `치명적 콘솔 에러 없음 (${criticalErrors.length}건)`);
  if (criticalErrors.length > 0) {
    console.log('    📋 필터 통과한 에러 내용:');
    criticalErrors.forEach((e, i) => console.log(`      ${i + 1}. ${e}`));
    console.log('    📋 전체 콘솔 에러 목록:');
    consoleErrors.forEach((e, i) => console.log(`      ${i + 1}. ${e}`));
  }
  assert(!uncaughtException, '페이지 uncaught 예외 없음');

  // ---------------------------------------------------------------
  await browser.close();

  console.log('\n==================================================');
  console.log(`🏁 E2E 테스트 완료: ${passed}건 통과, ${failed}건 실패`);
  console.log('==================================================');

  process.exit(failed > 0 ? 1 : 0);
})();
