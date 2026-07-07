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
  it('예제는 3종이고 모두 로드/코드 생성이 된다', () => {
    expect(EXAMPLES.map((e) => e.id)).toEqual(['light', 'door', 'fire']);
    for (const ex of EXAMPLES) {
      expect(ex.title).toBeTruthy();
      expect(ex.description).toBeTruthy();
      expect(codeOf(ex.id)).toContain('void loop()');
    }
  });

  it('센서등: 조도 < 300이면 LED 켜고 아니면 끈다', () => {
    const code = codeOf('light');
    expect(code).toContain('if (analogRead(A0) < 300) {');
    expect(code).toContain('digitalWrite(13, HIGH);');
    expect(code).toContain('digitalWrite(13, LOW);');
    expect(code).toContain('pinMode(13, OUTPUT);');
  });

  it('자동문: 10cm 이내면 서보 90도 + 1초 대기, 아니면 0도', () => {
    const code = codeOf('door');
    expect(code).toContain('#include <Servo.h>');
    expect(code).toContain('if (readUltrasonic(7, 6) < 10) {');
    expect(code).toContain('servo_9.write(90);');
    expect(code).toContain('delay((1) * 1000);');
    expect(code).toContain('servo_9.write(0);');
  });

  it('화재 경보기: 온도 > 40이면 경보음', () => {
    const code = codeOf('fire');
    expect(code).toContain('DHT dht_4(4, DHT11);');
    expect(code).toContain('if (dht_4.readTemperature() > 40) {');
    expect(code).toContain('tone(8, 523);');
  });
});
