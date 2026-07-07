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

const num = (n) => ({ type: 'math_number', fields: { NUM: n } });

describe('논리/반복/변수 생성기', () => {
  it('만약~라면 + 비교', () => {
    const code = loopCode({
      type: 'controls_if',
      inputs: {
        IF0: { block: { type: 'logic_compare', fields: { OP: 'GT' },
          inputs: { A: { block: num(1) }, B: { block: num(2) } } } },
        DO0: { block: { type: 'basic_delay',
          inputs: { SECONDS: { block: num(1) } } } },
      },
    });
    expect(code).toContain('if (1 > 2) {\n    delay((1) * 1000);\n  }');
  });

  it('N번 반복 → for문', () => {
    const code = loopCode({
      type: 'controls_repeat_ext',
      inputs: {
        TIMES: { block: num(3) },
        DO: { block: { type: 'basic_delay', inputs: { SECONDS: { block: num(1) } } } },
      },
    });
    expect(code).toContain('for (int i = 0; i < 3; i++) {');
  });

  it('변수 설정/읽기 → float 전역 + 대입', () => {
    const ws = new Blockly.Workspace();
    const v = ws.createVariable('점수');
    Blockly.serialization.workspaces.load({
      blocks: { languageVersion: 0, blocks: [
        { type: 'basic_loop', inputs: { BODY: { block: {
          type: 'variables_set', fields: { VAR: { id: v.getId() } },
          inputs: { VALUE: { block: num(10) } },
        } } } },
      ] },
      variables: [{ name: '점수', id: v.getId() }],
    }, ws);
    const code = g.workspaceToCode(ws);
    ws.dispose();
    expect(code).toContain('float var1 = 0;');
    expect(code).toContain('var1 = 10;');
  });

  it('문자열 블록 → 큰따옴표 C 문자열', () => {
    const ws = new Blockly.Workspace();
    g.init(ws);
    const b = ws.newBlock('text');
    b.setFieldValue('안녕 "친구"', 'TEXT');
    const [expr] = g.forBlock['text'](b, g);
    ws.dispose();
    expect(expr).toBe('"안녕 \\"친구\\""');
  });
});
