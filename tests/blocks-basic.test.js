import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { arduinoGenerator as g } from '../src/shared/arduino-generator.js';
import '../src/shared/blocks/index.js';

export function codeFrom(blocksJson) {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: blocksJson } }, ws);
  const code = g.workspaceToCode(ws);
  ws.dispose();
  return code;
}

describe('기본 블록', () => {
  it('시작하면/계속 반복 + 기다리기 → setup/loop에 배치', () => {
    const code = codeFrom([
      { type: 'basic_setup', inputs: { BODY: { block: {
        type: 'basic_delay',
        inputs: { SECONDS: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
      } } } },
      { type: 'basic_loop', x: 0, y: 200, inputs: { BODY: { block: {
        type: 'basic_delay',
        inputs: { SECONDS: { shadow: { type: 'math_number', fields: { NUM: 0.5 } } } },
      } } } },
    ]);
    expect(code).toBe(
      'void setup() {\n  delay((1) * 1000);\n}\n\nvoid loop() {\n  delay((0.5) * 1000);\n}\n'
    );
  });
});
