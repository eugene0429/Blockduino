'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');
const { DIGITAL_PINS, PWM_PINS, ANALOG_PINS } = require('../pins.js');

const NOTES = [
  ['도', '262'], ['레', '294'], ['미', '330'], ['파', '349'],
  ['솔', '392'], ['라', '440'], ['시', '494'], ['높은 도', '523'],
];
const BEATS = [['1박', '1'], ['반박', '0.5'], ['2박', '2'], ['4박', '4']];

Blockly.defineBlocksWithJsonArray([
  { type: 'io_led',
    message0: 'LED %1 번 핀 %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'STATE', options: [['켜기', 'HIGH'], ['끄기', 'LOW']] },
    ],
    previousStatement: null, nextStatement: null, colour: 20,
    tooltip: 'LED를 켜거나 꺼요.' },
  { type: 'io_digital_write',
    message0: '디지털 %1 번 핀에 %2 신호 보내기',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'STATE', options: [['켜짐(HIGH)', 'HIGH'], ['꺼짐(LOW)', 'LOW']] },
    ],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_digital_read',
    message0: '디지털 %1 번 핀 신호',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
    output: 'Boolean', colour: 20 },
  { type: 'io_analog_write',
    message0: '핀 %1 에 밝기/세기 %2 만큼 출력 (0~255)',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: PWM_PINS },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_analog_read',
    message0: '아날로그 %1 핀 값 (0~1023)',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: ANALOG_PINS }],
    output: 'Number', colour: 20 },
  { type: 'io_button',
    message0: '%1 번 핀 버튼이 눌렸는가?',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
    output: 'Boolean', colour: 20,
    tooltip: '버튼은 핀과 GND 사이에 연결해요.' },
  { type: 'io_buzzer_tone',
    message0: '부저 %1 번 핀 %2 음 %3 연주',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'NOTE', options: NOTES },
      { type: 'field_dropdown', name: 'BEAT', options: BEATS },
    ],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_buzzer_off',
    message0: '부저 %1 번 핀 멈추기',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
    previousStatement: null, nextStatement: null, colour: 20 },
]);

g.forBlock['io_led'] = g.forBlock['io_digital_write'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  gen.addSetup(`pinMode_out_${pin}`, `pinMode(${pin}, OUTPUT);`);
  return `digitalWrite(${pin}, ${block.getFieldValue('STATE')});\n`;
};

g.forBlock['io_digital_read'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  gen.addSetup(`pinMode_in_${pin}`, `pinMode(${pin}, INPUT);`);
  return [`digitalRead(${pin}) == HIGH`, Order.EQUALITY];
};

g.forBlock['io_analog_write'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const value = gen.valueToCode(block, 'VALUE', Order.NONE) || '0';
  gen.addSetup(`pinMode_out_${pin}`, `pinMode(${pin}, OUTPUT);`);
  return `analogWrite(${pin}, ${value});\n`;
};

g.forBlock['io_analog_read'] = function (block) {
  return [`analogRead(${block.getFieldValue('PIN')})`, Order.ATOMIC];
};

g.forBlock['io_button'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  gen.addSetup(`pinMode_pullup_${pin}`, `pinMode(${pin}, INPUT_PULLUP);`);
  return [`digitalRead(${pin}) == LOW`, Order.EQUALITY];
};

g.forBlock['io_buzzer_tone'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const note = block.getFieldValue('NOTE');
  const beat = block.getFieldValue('BEAT');
  return `tone(${pin}, ${note});\ndelay(500 * ${beat});\nnoTone(${pin});\n`;
};

g.forBlock['io_buzzer_off'] = function (block) {
  return `noTone(${block.getFieldValue('PIN')});\n`;
};
