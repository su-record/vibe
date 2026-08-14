/**
 * 경량 glob → RegExp 변환 — code-check.js·scope-guard.js 공용 (중복 제거).
 *  - `**` : 경로 구분자 포함 임의 문자열
 *  - `*`  : 구분자 제외 임의 문자열
 *  - `?`  : 구분자 제외 한 글자
 *  - 기타 정규식 메타문자는 이스케이프
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  const normalized = glob.replace(/\\/g, '/');
  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (c === '*') {
      if (normalized[i + 1] === '*') {
        out += '.*';
        i++;
        if (normalized[i + 1] === '/') i++; // `**/` → `.*`
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else if ('.+^$()|{}[]\\'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
}
