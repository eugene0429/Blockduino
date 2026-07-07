'use strict';

function friendlyError(stage, output) {
  const detail = output || '';
  if (stage === 'no-port') {
    return { message: '아두이노가 연결되어 있는지 확인해 주세요', detail };
  }
  if (/access is denied|permission denied|resource busy/i.test(detail)) {
    return { message: '다른 프로그램이 보드를 사용 중이에요. 시리얼 모니터 등을 닫고 다시 시도해 주세요', detail };
  }
  if (/stk500|programmer is not responding|can't open device|no device found/i.test(detail)) {
    return { message: 'USB 케이블을 다시 연결하고 시도해 주세요', detail };
  }
  if (stage === 'compile') {
    return { message: '코드를 만드는 중 문제가 생겼어요. [자세히 보기]를 눌러 확인해 주세요', detail };
  }
  return { message: '업로드에 실패했어요. 보드와 케이블을 확인하고 다시 시도해 주세요', detail };
}

module.exports = { friendlyError };
