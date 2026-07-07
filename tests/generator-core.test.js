import { describe, it, expect, beforeEach } from 'vitest';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import * as Blockly from 'blockly';

function emptyCode() {
  const ws = new Blockly.Workspace();
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('ArduinoGenerator 코어', () => {
  it('빈 워크스페이스 → 빈 setup/loop 스켈레톤', () => {
    expect(emptyCode()).toBe('void setup() {\n}\n\nvoid loop() {\n}\n');
  });

  it('include/선언/함수/셋업은 key당 1회, 순서대로 조립된다', () => {
    const ws = new Blockly.Workspace();
    g.init(ws);
    g.addInclude('servo', '#include <Servo.h>');
    g.addInclude('servo', '#include <Servo.h>');
    g.addDeclaration('servo_9', 'Servo servo_9;');
    g.addFunction('helper', 'int helper() {\n  return 1;\n}');
    g.addSetup('servo_9', 'servo_9.attach(9);');
    g.setupBody_ = '  digitalWrite(13, HIGH);\n';
    g.loopBody_ = '  delay(100);\n';
    const code = g.finish('');
    ws.dispose();
    expect(code).toBe(
      '#include <Servo.h>\n\n' +
      'Servo servo_9;\n\n' +
      'int helper() {\n  return 1;\n}\n\n' +
      'void setup() {\n  servo_9.attach(9);\n  digitalWrite(13, HIGH);\n}\n\n' +
      'void loop() {\n  delay(100);\n}\n'
    );
  });

  it('한글 변수는 C 식별자로 치환되고 float 전역으로 선언된다', () => {
    const ws = new Blockly.Workspace();
    ws.createVariable('속도');
    ws.createVariable('count');
    const code = g.workspaceToCode(ws);
    ws.dispose();
    expect(code).toContain('float var1 = 0;');   // '속도' → var1
    expect(code).toContain('float count = 0;');  // ASCII 이름은 유지
  });
});
