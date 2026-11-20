'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');
const { DIGITAL_PINS, PWM_PINS, ANALOG_PINS } = require('../pins.js');

const NOTES = [
  ['%{BKY_BD_NOTE_C}', '262'], ['%{BKY_BD_NOTE_D}', '294'], ['%{BKY_BD_NOTE_E}', '330'],
  ['%{BKY_BD_NOTE_F}', '349'], ['%{BKY_BD_NOTE_G}', '392'], ['%{BKY_BD_NOTE_A}', '440'],
  ['%{BKY_BD_NOTE_B}', '494'], ['%{BKY_BD_NOTE_HIGH_C}', '523'],
];
const BEATS = [
  ['%{BKY_BD_BEAT_1}', '1'], ['%{BKY_BD_BEAT_HALF}', '0.5'],
  ['%{BKY_BD_BEAT_2}', '2'], ['%{BKY_BD_BEAT_4}', '4'],
];

Blockly.defineBlocksWithJsonArray([
  { type: 'io_led',
    message0: '%{BKY_BD_LED}',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'STATE', options: [['%{BKY_BD_LED_ON}', 'HIGH'], ['%{BKY_BD_LED_OFF}', 'LOW']] },
    ],
    previousStatement: null, nextStatement: null, colour: 20,
    tooltip: '%{BKY_BD_LED_TOOLTIP}' },
  { type: 'io_digital_write',
    message0: '%{BKY_BD_DIGITAL_WRITE}',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'STATE', options: [['%{BKY_BD_DIGITAL_HIGH}', 'HIGH'], ['%{BKY_BD_DIGITAL_LOW}', 'LOW']] },
    ],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_digital_read',
    message0: '%{BKY_BD_DIGITAL_READ}',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
    output: 'Boolean', colour: 20 },
  { type: 'io_analog_write',
    message0: '%{BKY_BD_ANALOG_WRITE}',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: PWM_PINS },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_analog_read',
    message0: '%{BKY_BD_ANALOG_READ}',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: ANALOG_PINS }],
    output: 'Number', colour: 20 },
  { type: 'io_button',
    message0: '%{BKY_BD_BUTTON}',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
    output: 'Boolean', colour: 20,
    tooltip: '%{BKY_BD_BUTTON_TOOLTIP}' },
  { type: 'io_buzzer_tone',
    message0: '%{BKY_BD_BUZZER_TONE}',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'NOTE', options: NOTES },
      { type: 'field_dropdown', name: 'BEAT', options: BEATS },
    ],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_buzzer_off',
    message0: '%{BKY_BD_BUZZER_OFF}',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS }],
    previousStatement: null, nextStatement: null, colour: 20 },
  { type: 'io_led_effect',
    message0: '%{BKY_BD_LED_EFFECT}',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'EFFECT', options: [
        ['%{BKY_BD_LED_EFFECT_BURST}', 'BURST'],
        ['%{BKY_BD_LED_EFFECT_BLINK}', 'BLINK'],
        ['%{BKY_BD_LED_EFFECT_SOS}', 'SOS'],
      ] },
    ],
    previousStatement: null, nextStatement: null, colour: 20,
    tooltip: '%{BKY_BD_LED_EFFECT_TOOLTIP}' },
  { type: 'io_buzzer_melody',
    message0: '%{BKY_BD_BUZZER_MELODY}',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'SONG', options: [
        ['%{BKY_BD_SONG_PLANE}', 'PLANE'],
        ['%{BKY_BD_SONG_BELL}', 'BELL'],
        ['%{BKY_BD_SONG_STAR}', 'STAR'],
      ] },
    ],
    previousStatement: null, nextStatement: null, colour: 20,
    tooltip: '%{BKY_BD_BUZZER_MELODY_TOOLTIP}' },
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

g.forBlock['io_led_effect'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  gen.addSetup(`pinMode_out_${pin}`, `pinMode(${pin}, OUTPUT);`);
  const effect = block.getFieldValue('EFFECT');
  if (effect === 'BURST') {
    gen.addFunction('ledBurst',
      'void ledBurst(int pin) {\n' +
      '  for (int i = 0; i < 3; i++) {\n' +
      '    digitalWrite(pin, HIGH);\n' +
      '    delay(80);\n' +
      '    digitalWrite(pin, LOW);\n' +
      '    delay(80);\n' +
      '  }\n' +
      '}');
    return `ledBurst(${pin});\n`;
  }
  if (effect === 'BLINK') {
    gen.addFunction('ledBlink',
      'void ledBlink(int pin) {\n' +
      '  for (int i = 0; i < 5; i++) {\n' +
      '    digitalWrite(pin, HIGH);\n' +
      '    delay(400);\n' +
      '    digitalWrite(pin, LOW);\n' +
      '    delay(400);\n' +
      '  }\n' +
      '}');
    return `ledBlink(${pin});\n`;
  }
  // SOS: 모스 부호 (짧게 3번 · 길게 3번 · 짧게 3번)
  gen.addFunction('ledSos',
    'void ledSos(int pin) {\n' +
    '  int times[] = {150, 150, 150, 450, 450, 450, 150, 150, 150};\n' +
    '  for (int i = 0; i < 9; i++) {\n' +
    '    digitalWrite(pin, HIGH);\n' +
    '    delay(times[i]);\n' +
    '    digitalWrite(pin, LOW);\n' +
    '    delay(150);\n' +
    '  }\n' +
    '}');
  return `ledSos(${pin});\n`;
};

// 동요 악보: 도=262, 레=294, 미=330, 파=349, 솔=392, 라=440, 시=494, 높은도=523
const MELODIES = {
  PLANE: { // 비행기 (떴다 떴다 비행기)
    notes: [330, 294, 262, 294, 330, 330, 330, 294, 294, 294, 330, 392, 392,
      330, 294, 262, 294, 330, 330, 330, 330, 294, 294, 330, 294, 262],
    beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4],
  },
  BELL: { // 학교종
    notes: [392, 392, 440, 440, 392, 392, 330, 392, 392, 330, 330, 294,
      392, 392, 440, 440, 392, 392, 330, 392, 330, 294, 330, 262],
    beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 4,
      1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 4],
  },
  STAR: { // 반짝반짝 작은별
    notes: [262, 262, 392, 392, 440, 440, 392, 349, 349, 330, 330, 294, 294, 262],
    beats: [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2],
  },
};

g.forBlock['io_buzzer_melody'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const song = block.getFieldValue('SONG');
  const m = MELODIES[song];
  gen.addFunction('playMelody',
    'void playMelody(int pin, const int notes[], const int beats[], int length) {\n' +
    '  for (int i = 0; i < length; i++) {\n' +
    '    tone(pin, notes[i]);\n' +
    '    delay(250 * beats[i]);\n' +
    '    noTone(pin);\n' +
    '    delay(40);\n' +
    '  }\n' +
    '}');
  gen.addDeclaration(`melody_${song}`,
    `const int MELODY_${song}_NOTES[] = {${m.notes.join(', ')}};\n` +
    `const int MELODY_${song}_BEATS[] = {${m.beats.join(', ')}};`);
  return `playMelody(${pin}, MELODY_${song}_NOTES, MELODY_${song}_BEATS, ${m.notes.length});\n`;
};
