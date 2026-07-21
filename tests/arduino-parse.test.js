import { describe, it, expect } from 'vitest';
import { parseBoardList } from '../src/main/arduino.js';
import { friendlyError } from '../src/main/messages.js';

describe('parseBoardList', () => {
  it('한글 라벨 + 아두이노 우선 정렬, 무관한 포트는 제외', () => {
    const stdout = JSON.stringify({ detected_ports: [
      { port: { address: 'COM5', protocol: 'serial', properties: { vid: '0x05AC' } } }, // 기타 장치
      { port: { address: 'COM4', protocol: 'serial',
        properties: { vid: '0x1A86', pid: '0x7523' } } },                              // CH340 호환보드
      { port: { address: 'COM3', protocol: 'serial' },
        matching_boards: [{ name: 'Arduino Uno', fqbn: 'arduino:avr:uno' }] },          // 정품 우노
      { port: { address: '/dev/cu.Bluetooth-Incoming-Port', protocol: 'serial' } },     // 숨김
      { port: { address: '/dev/cu.wlan-debug', protocol: 'serial' } },                  // 숨김
      { port: { address: '192.168.0.2', protocol: 'network' } },                        // 숨김
    ] });
    expect(parseBoardList(stdout)).toEqual([
      { port: 'COM3', label: '아두이노 보드 (COM3)', isUno: true, rank: 0 },
      { port: 'COM4', label: '아두이노 호환 보드 (COM4)', isUno: false, rank: 1 },
      { port: 'COM5', label: '기타 포트 (COM5)', isUno: false, rank: 2 },
    ]);
  });

  it('FTDI/CP210x 칩도 호환 보드로 인식', () => {
    const stdout = JSON.stringify({ detected_ports: [
      { port: { address: 'COM7', protocol: 'serial', properties: { vid: '0x0403' } } },
      { port: { address: 'COM8', protocol: 'serial', properties: { vid: '0x10C4' } } },
    ] });
    const r = parseBoardList(stdout);
    expect(r.map((p) => p.rank)).toEqual([1, 1]);
    expect(r[0].label).toBe('아두이노 호환 보드 (COM7)');
  });

  it('네이티브 USB(VID 0843) 보드도 호환 보드로 인식', () => {
    const stdout = JSON.stringify({ detected_ports: [
      { port: { address: '/dev/cu.usbmodemFX2348N1', protocol: 'serial',
        properties: { vid: '0x0843', pid: '0x5740' } } },
    ] });
    const r = parseBoardList(stdout);
    expect(r[0].rank).toBe(1);
    expect(r[0].label).toBe('아두이노 호환 보드 (/dev/cu.usbmodemFX2348N1)');
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
