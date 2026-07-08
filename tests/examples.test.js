import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';
import { EXAMPLES } from '../src/shared/examples.js';

function codeOf(id) {
  const ex = EXAMPLES.find((e) => e.id === id);
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(ex.workspace, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('예제 데모', () => {
  it('예제는 6종이고 모두 로드/코드 생성이 된다', () => {
    expect(EXAMPLES.map((e) => e.id)).toEqual(['light', 'light2', 'door', 'door2', 'fire', 'fire2']);
    for (const ex of EXAMPLES) {
      expect(ex.title).toBeTruthy();
      expect(ex.description).toBeTruthy();
      expect(codeOf(ex.id)).toContain('void loop()');
    }
  });

  it('센서등 1: 조도 < 300이면 LED 켜고 아니면 끈다', () => {
    const code = codeOf('light');
    expect(code).toContain('if (analogRead(A0) < 300) {');
    expect(code).toContain('digitalWrite(13, HIGH);');
    expect(code).toContain('digitalWrite(13, LOW);');
    expect(code).toContain('pinMode(13, OUTPUT);');
    expect(EXAMPLES.find((e) => e.id === 'light').title).toBe('센서등 1');
  });

  it('센서등 2: 밝기 변수 + 3단계 신호등 (빨강/노랑/초록)', () => {
    const code = codeOf('light2');
    expect(code).toContain('float var1 = 0;');            // 변수 '밝기'
    expect(code).toContain('var1 = analogRead(A0);');
    expect(code).toContain('if (var1 < 200) {');           // 어두움 → 빨강
    expect(code).toContain('else if (var1 < 600) {');      // 중간 → 노랑
    expect(code).toContain('digitalWrite(11, HIGH);');
    expect(code).toContain('digitalWrite(12, HIGH);');
    expect(code).toContain('digitalWrite(13, HIGH);');
    for (const pin of [11, 12, 13]) {
      expect(code).toContain(`pinMode(${pin}, OUTPUT);`);
      expect(code).toContain(`digitalWrite(${pin}, LOW);`);
    }
  });

  it('자동문: 10cm 이내면 서보 90도 + 1초 대기, 아니면 0도', () => {
    const code = codeOf('door');
    expect(code).toContain('#include <Servo.h>');
    expect(code).toContain('if (readUltrasonic(7, 6) < 10) {');
    expect(code).toContain('servo_9.write(90);');
    expect(code).toContain('delay((1) * 1000);');
    expect(code).toContain('servo_9.write(0);');
  });

  it('자동문 2: 거리 변수 + 3단계 문 열기 (기존 부품만 사용)', () => {
    const code = codeOf('door2');
    expect(code).toContain('var1 = readUltrasonic(7, 6);');   // 변수 '거리'
    expect(code).toContain('if (var1 < 5) {');                 // 아주 가까움 → 활짝
    expect(code).toContain('else if (var1 < 15) {');           // 가까움 → 반만
    expect(code).toContain('servo_9.write(180);');
    expect(code).toContain('servo_9.write(90);');
    expect(code).toContain('servo_9.write(0);');
  });

  it('화재 경보기 2: 온도 변수 + 단계별 경보음 (기존 부품만 사용)', () => {
    const code = codeOf('fire2');
    expect(code).toContain('var1 = dht_4.readTemperature();'); // 변수 '온도'
    expect(code).toContain('if (var1 > 40) {');                 // 위험 → 빠른 경보 3번
    expect(code).toContain('for (int i = 0; i < 3; i++) {');
    expect(code).toContain('tone(8, 523);');
    expect(code).toContain('else if (var1 > 30) {');            // 주의 → 낮은 음
    expect(code).toContain('tone(8, 262);');
    expect(code).toContain('noTone(8);');                       // 평상시 → 조용
  });

  it('화재 경보기: 온도 > 40이면 경보음', () => {
    const code = codeOf('fire');
    expect(code).toContain('DHT dht_4(4, DHT11);');
    expect(code).toContain('if (dht_4.readTemperature() > 40) {');
    expect(code).toContain('tone(8, 523);');
  });
});
