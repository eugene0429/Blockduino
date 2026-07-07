'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');

// Monkey-patch Blockly's broken block initializers to work around validation errors
if (Blockly.Blocks.controls_repeat_ext) {
  const origInit = Blockly.Blocks.controls_repeat_ext.init;
  Blockly.Blocks.controls_repeat_ext.init = function() {
    this.jsonInit({
      type: 'controls_repeat_ext',
      message0: 'repeat %1 times %2 do %3',
      args0: [
        { type: 'input_value', name: 'TIMES', check: 'Number' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
    });
  };
}

if (Blockly.Blocks.variables_set) {
  const origInit = Blockly.Blocks.variables_set.init;
  Blockly.Blocks.variables_set.init = function() {
    this.jsonInit({
      type: 'variables_set',
      message0: 'set %1 to %2',
      args0: [
        { type: 'field_variable', name: 'VAR' },
        { type: 'input_value', name: 'VALUE', check: 'Number' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 240,
    });
  };
}

g.forBlock['math_number'] = function (block) {
  return [String(block.getFieldValue('NUM')), Order.ATOMIC];
};

g.forBlock['text'] = function (block) {
  const raw = String(block.getFieldValue('TEXT'));
  const escaped = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return [`"${escaped}"`, Order.ATOMIC];
};

g.forBlock['logic_boolean'] = function (block) {
  return [block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', Order.ATOMIC];
};

g.forBlock['logic_compare'] = function (block, gen) {
  const ops = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
  const op = ops[block.getFieldValue('OP')];
  const order = op === '==' || op === '!=' ? Order.EQUALITY : Order.RELATIONAL;
  const a = gen.valueToCode(block, 'A', order) || '0';
  const b = gen.valueToCode(block, 'B', order) || '0';
  return [`${a} ${op} ${b}`, order];
};

g.forBlock['logic_operation'] = function (block, gen) {
  const and = block.getFieldValue('OP') === 'AND';
  const op = and ? '&&' : '||';
  const order = and ? Order.LOGICAL_AND : Order.LOGICAL_OR;
  const a = gen.valueToCode(block, 'A', order) || 'false';
  const b = gen.valueToCode(block, 'B', order) || 'false';
  return [`${a} ${op} ${b}`, order];
};

g.forBlock['logic_negate'] = function (block, gen) {
  const v = gen.valueToCode(block, 'BOOL', Order.UNARY) || 'false';
  return [`!${v}`, Order.UNARY];
};

g.forBlock['controls_if'] = function (block, gen) {
  let code = '';
  let n = 0;
  do {
    const cond = gen.valueToCode(block, 'IF' + n, Order.NONE) || 'false';
    const body = gen.statementToCode(block, 'DO' + n);
    code += (n === 0 ? '' : ' else ') + `if (${cond}) {\n${body}}`;
    n += 1;
  } while (block.getInput('IF' + n));
  if (block.getInput('ELSE')) {
    code += ` else {\n${gen.statementToCode(block, 'ELSE')}}`;
  }
  return code + '\n';
};

g.forBlock['controls_repeat_ext'] = function (block, gen) {
  const times = gen.valueToCode(block, 'TIMES', Order.NONE) || '0';
  const body = gen.statementToCode(block, 'DO');
  return `for (int i = 0; i < ${times}; i++) {\n${body}}\n`;
};

g.forBlock['controls_whileUntil'] = function (block, gen) {
  let cond = gen.valueToCode(block, 'BOOL', Order.NONE) || 'false';
  if (block.getFieldValue('MODE') === 'UNTIL') cond = `!(${cond})`;
  const body = gen.statementToCode(block, 'DO');
  return `while (${cond}) {\n${body}}\n`;
};

g.forBlock['math_arithmetic'] = function (block, gen) {
  const ops = { ADD: ['+', Order.ADDITIVE], MINUS: ['-', Order.ADDITIVE],
    MULTIPLY: ['*', Order.MULTIPLICATIVE], DIVIDE: ['/', Order.MULTIPLICATIVE] };
  const entry = ops[block.getFieldValue('OP')];
  if (!entry) { // POWER
    const a0 = gen.valueToCode(block, 'A', Order.NONE) || '0';
    const b0 = gen.valueToCode(block, 'B', Order.NONE) || '0';
    return [`pow(${a0}, ${b0})`, Order.ATOMIC];
  }
  const [op, order] = entry;
  const a = gen.valueToCode(block, 'A', order) || '0';
  const b = gen.valueToCode(block, 'B', order) || '0';
  return [`${a} ${op} ${b}`, order];
};

g.forBlock['variables_get'] = function (block, gen) {
  const varId = block.getFieldValue('VAR');
  return [gen.varName(varId), Order.ATOMIC];
};

g.forBlock['variables_set'] = function (block, gen) {
  const varId = block.getFieldValue('VAR');
  const value = gen.valueToCode(block, 'VALUE', Order.NONE) || '0';
  return `${gen.varName(varId)} = ${value};\n`;
};

g.forBlock['math_change'] = function (block, gen) {
  const varId = block.getFieldValue('VAR');
  const delta = gen.valueToCode(block, 'DELTA', Order.NONE) || '0';
  return `${gen.varName(varId)} += ${delta};\n`;
};
