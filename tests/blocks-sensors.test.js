import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';

function loopWithSet(valueBlock) {
  const ws = new Blockly.Workspace();
  const v = ws.createVariable('x');
  Blockly.serialization.workspaces.load({
    blocks: { languageVersion: 0, blocks: [
      { type: 'basic_loop', inputs: { BODY: { block: {
        type: 'variables_set', fields: { VAR: { id: v.getId() } },
        inputs: { VALUE: { block: valueBlock } },
      } } } },
    ] },
    variables: [{ name: 'x', id: v.getId() }],
  }, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('센서 블록', () => {
  it('초음파 → 헬퍼 함수 1회 정의 + 호출', () => {
    const code = loopWithSet({ type: 'sensor_ultrasonic', fields: { TRIG: '7', ECHO: '6' } });
    expect(code).toContain('float readUltrasonic(int trigPin, int echoPin)');
    expect(code).toContain('x = readUltrasonic(7, 6);');
  });

  it('DHT11 온도 → include/객체/begin/readTemperature', () => {
    const code = loopWithSet({ type: 'sensor_dht', fields: { PIN: '4', MODE: 'TEMP' } });
    expect(code).toContain('#include <DHT.h>');
    expect(code).toContain('DHT dht_4(4, DHT11);');
    expect(code).toContain('dht_4.begin();');
    expect(code).toContain('x = dht_4.readTemperature();');
  });

  it('조도 센서 → analogRead', () => {
    const code = loopWithSet({ type: 'sensor_cds', fields: { PIN: 'A0' } });
    expect(code).toContain('x = analogRead(A0);');
  });
});
