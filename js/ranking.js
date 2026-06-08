/**
 * LocalStorage 기반 랭킹 관리 모듈 (TOP 10) — 모바일 전용
 */

const STORAGE_KEY = 'kungfu_tiger_bullet_avoidance_mobile_rankings';

export class RankingSystem {
  // 랭킹 리스트 가져오기
  static getRankings() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('로컬 스토리지를 읽어오는 데 실패했습니다:', e);
      return [];
    }
  }

  // 랭킹 저장하기
  static saveRankings(rankings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rankings));
    } catch (e) {
      console.error('로컬 스토리지에 저장하는 데 실패했습니다:', e);
    }
  }

  // 신기록(TOP 10 진입) 여부 판단
  static isNewRecord(timeInSeconds) {
    const rankings = this.getRankings();
    if (rankings.length < 10) {
      return timeInSeconds > 0;
    }
    return timeInSeconds > rankings[rankings.length - 1].score;
  }

  // 새 기록 등록
  static addScore(name, timeInSeconds) {
    const cleanName = name.trim() || '무명 호랑이';
    const rankings = this.getRankings();
    const newEntry = {
      name: cleanName,
      score: parseFloat(timeInSeconds.toFixed(2)),
      date: new Date().toLocaleDateString('ko-KR', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
      })
    };

    rankings.push(newEntry);
    rankings.sort((a, b) => b.score - a.score);
    const topTen = rankings.slice(0, 10);
    this.saveRankings(topTen);
  }

  // 랭킹 전체 삭제
  static clearRankings() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // 시간을 MM:SS.SS 형태로 변환
  static formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  // 랭킹 HTML 테이블 렌더링
  static renderRankingTable(tableBodyEl, noRankingsEl) {
    const rankings = this.getRankings();
    tableBodyEl.innerHTML = '';

    if (rankings.length === 0) {
      noRankingsEl.classList.remove('hidden');
      tableBodyEl.parentElement.style.display = 'none';
      return;
    }

    noRankingsEl.classList.add('hidden');
    tableBodyEl.parentElement.style.display = 'table';

    rankings.forEach((entry, index) => {
      const tr = document.createElement('tr');
      tr.className = `rank-${index + 1}`;

      let medal = (index + 1).toString();
      if (index === 0) medal = '🥇 1';
      else if (index === 1) medal = '🥈 2';
      else if (index === 2) medal = '🥉 3';

      tr.innerHTML = `
        <td>${medal}</td>
        <td>${this.escapeHTML(entry.name)}</td>
        <td>${this.formatTime(entry.score)}</td>
        <td>${entry.date}</td>
      `;
      tableBodyEl.appendChild(tr);
    });
  }

  // XSS 방지를 위한 HTML 이스케이프
  static escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
}
