import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';

function loopCode(bodyBlock) {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [
    { type: 'basic_loop', inputs: { BODY: { block: bodyBlock } } },
  ] } }, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('입출력 블록', () => {
  it('LED 켜기 → pinMode OUTPUT + digitalWrite HIGH', () => {
    const code = loopCode({ type: 'io_led', fields: { PIN: '13', STATE: 'HIGH' } });
    expect(code).toContain('pinMode(13, OUTPUT);');
    expect(code).toContain('digitalWrite(13, HIGH);');
  });

  it('버튼 → INPUT_PULLUP, 눌림은 LOW 비교', () => {
    const code = loopCode({
      type: 'controls_if',
      inputs: { IF0: { block: { type: 'io_button', fields: { PIN: '2' } } } },
    });
    expect(code).toContain('pinMode(2, INPUT_PULLUP);');
    expect(code).toContain('if (digitalRead(2) == LOW) {');
  });

  it('부저 → tone + delay + noTone', () => {
    const code = loopCode({ type: 'io_buzzer_tone', fields: { PIN: '8', NOTE: '262', BEAT: '1' } });
    expect(code).toContain('tone(8, 262);');
    expect(code).toContain('delay(500 * 1);');
    expect(code).toContain('noTone(8);');
  });

  it('아날로그 쓰기 → analogWrite', () => {
    const code = loopCode({
      type: 'io_analog_write', fields: { PIN: '9' },
      inputs: { VALUE: { block: { type: 'math_number', fields: { NUM: 128 } } } },
    });
    expect(code).toContain('analogWrite(9, 128);');
  });
});
