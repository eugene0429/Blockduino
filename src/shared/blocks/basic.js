'use strict';
import Blockly from 'blockly/core';
import { arduinoGenerator as g, Order } from '../arduino-generator.js';

Blockly.defineBlocksWithJsonArray([
  {
    type: 'basic_setup',
    message0: '시작하면 %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'BODY' }],
    colour: 120,
    tooltip: '전원이 켜지거나 리셋될 때 한 번만 실행돼요.',
  },
  {
    type: 'basic_loop',
    message0: '계속 반복하기 %1 %2',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'BODY' }],
    colour: 120,
    tooltip: '전원이 켜져 있는 동안 계속 반복 실행돼요.',
  },
  {
    type: 'basic_delay',
    message0: '%1 초 기다리기',
    args0: [{ type: 'input_value', name: 'SECONDS', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
    tooltip: '정해진 시간만큼 멈춰요.',
  },
]);

g.forBlock['basic_setup'] = function (block, gen) {
  gen.setupBody_ = gen.statementToCode(block, 'BODY');
  return '';
};

g.forBlock['basic_loop'] = function (block, gen) {
  gen.loopBody_ = gen.statementToCode(block, 'BODY');
  return '';
};

g.forBlock['basic_delay'] = function (block, gen) {
  const sec = gen.valueToCode(block, 'SECONDS', Order.NONE) || '0';
  return `delay((${sec}) * 1000);\n`;
};

// math_number 최소 구현 (Task 4에서 나머지 내장 블록과 함께 확장)
g.forBlock['math_number'] = function (block) {
  return [String(block.getFieldValue('NUM')), Order.ATOMIC];
};
