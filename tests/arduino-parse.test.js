import { describe, it, expect } from 'vitest';
import { parseBoardList } from '../src/main/arduino.js';
import { friendlyError } from '../src/main/messages.js';

describe('parseBoardList', () => {
  it('시리얼 포트만 추려 Uno 여부와 함께 반환', () => {
    const stdout = JSON.stringify({ detected_ports: [
      { port: { address: 'COM3', protocol: 'serial', label: 'COM3' },
        matching_boards: [{ name: 'Arduino Uno', fqbn: 'arduino:avr:uno' }] },
      { port: { address: 'COM4', protocol: 'serial', label: 'COM4' } },
      { port: { address: '192.168.0.2', protocol: 'network', label: 'net' } },
    ] });
    expect(parseBoardList(stdout)).toEqual([
      { port: 'COM3', label: 'COM3 (Arduino Uno)', isUno: true },
      { port: 'COM4', label: 'COM4', isUno: false },
    ]);
  });

  it('빈 출력/깨진 JSON → 빈 배열', () => {
    expect(parseBoardList('')).toEqual([]);
    expect(parseBoardList('not json')).toEqual([]);
  });
});

describe('friendlyError', () => {
  it('포트 없음', () => {
    expect(friendlyError('no-port', '').message)
      .toBe('아두이노가 연결되어 있는지 확인해 주세요');
  });
  it('업로드 통신 실패 (avrdude stk500)', () => {
    const r = friendlyError('upload', 'avrdude: stk500_recv(): programmer is not responding');
    expect(r.message).toBe('USB 케이블을 다시 연결하고 시도해 주세요');
    expect(r.detail).toContain('stk500_recv');
  });
  it('포트 접근 거부', () => {
    const r = friendlyError('upload', "can't open device \"COM3\": Access is denied");
    expect(r.message).toBe('다른 프로그램이 보드를 사용 중이에요. 시리얼 모니터 등을 닫고 다시 시도해 주세요');
  });
  it('컴파일 실패 → 원문 로그를 detail로', () => {
    const r = friendlyError('compile', 'error: expected ; before }');
    expect(r.message).toBe('코드를 만드는 중 문제가 생겼어요. [자세히 보기]를 눌러 확인해 주세요');
    expect(r.detail).toContain('expected ;');
  });
});
