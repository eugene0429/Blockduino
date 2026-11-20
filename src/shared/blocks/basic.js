'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');

Blockly.defineBlocksWithJsonArray([
  {
    type: 'basic_setup',
    message0: '%{BKY_BD_SETUP}',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'BODY' }],
    colour: 120,
    tooltip: '%{BKY_BD_SETUP_TOOLTIP}',
  },
  {
    type: 'basic_loop',
    message0: '%{BKY_BD_LOOP}',
    args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'BODY' }],
    colour: 120,
    tooltip: '%{BKY_BD_LOOP_TOOLTIP}',
  },
  {
    type: 'basic_delay',
    message0: '%{BKY_BD_DELAY}',
    args0: [{ type: 'input_value', name: 'SECONDS', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: 120,
    tooltip: '%{BKY_BD_DELAY_TOOLTIP}',
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
