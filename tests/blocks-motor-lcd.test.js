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

describe('서보/LCD 블록', () => {
  it('서보 → include/객체/attach/write', () => {
    const code = loopCode({
      type: 'motor_servo', fields: { PIN: '9' },
      inputs: { ANGLE: { block: { type: 'math_number', fields: { NUM: 90 } } } },
    });
    expect(code).toContain('#include <Servo.h>');
    expect(code).toContain('Servo servo_9;');
    expect(code).toContain('servo_9.attach(9);');
    expect(code).toContain('servo_9.write(90);');
  });

  it('LCD 출력 → include/init/setCursor/print', () => {
    const code = loopCode({
      type: 'lcd_print', fields: { ROW: '1' },
      inputs: { TEXT: { block: { type: 'text', fields: { TEXT: 'hi' } } } },
    });
    expect(code).toContain('#include <LiquidCrystal_I2C.h>');
    expect(code).toContain('LiquidCrystal_I2C lcd(0x27, 16, 2);');
    expect(code).toContain('lcd.init();');
    expect(code).toContain('lcd.setCursor(0, 1);');
    expect(code).toContain('lcd.print("hi");');
  });

  it('LCD 지우기', () => {
    const code = loopCode({ type: 'lcd_clear' });
    expect(code).toContain('lcd.clear();');
  });
});
