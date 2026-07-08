'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');
const { PWM_PINS } = require('../pins.js');

Blockly.defineBlocksWithJsonArray([
  { type: 'motor_servo',
    message0: '서보모터 %1 번 핀을 %2 도로 회전 (0~180)',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: PWM_PINS },
      { type: 'input_value', name: 'ANGLE', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: 290 },
  { type: 'lcd_print',
    message0: 'LCD %1 번째 줄에 %2 표시',
    args0: [
      { type: 'field_dropdown', name: 'ROW', options: [['1', '0'], ['2', '1']] },
      { type: 'input_value', name: 'TEXT' },
    ],
    previousStatement: null, nextStatement: null, colour: 290,
    tooltip: 'I2C LCD(주소 0x27, 16x2)에 글자를 보여줘요.' },
  { type: 'lcd_clear',
    message0: 'LCD 화면 지우기',
    previousStatement: null, nextStatement: null, colour: 290 },
  { type: 'motor_servo_effect',
    message0: '서보모터 %1 번 핀 %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: PWM_PINS },
      { type: 'field_dropdown', name: 'EFFECT', options: [
        ['왔다갔다 흔들기', 'SWEEP'],
        ['인사하기 (까딱까딱)', 'NOD'],
      ] },
    ],
    previousStatement: null, nextStatement: null, colour: 290,
    tooltip: '서보모터로 재미있는 움직임을 만들어요.' },
  { type: 'lcd_blink',
    message0: 'LCD 화면 3번 깜빡이기',
    previousStatement: null, nextStatement: null, colour: 290 },
]);

function ensureLcd(gen) {
  gen.addInclude('wire', '#include <Wire.h>');
  gen.addInclude('lcd', '#include <LiquidCrystal_I2C.h>');
  gen.addDeclaration('lcd', 'LiquidCrystal_I2C lcd(0x27, 16, 2);');
  gen.addSetup('lcd', 'lcd.init();\n  lcd.backlight();');
}

g.forBlock['motor_servo'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const angle = gen.valueToCode(block, 'ANGLE', Order.NONE) || '0';
  gen.addInclude('servo', '#include <Servo.h>');
  gen.addDeclaration(`servo_${pin}`, `Servo servo_${pin};`);
  gen.addSetup(`servo_${pin}`, `servo_${pin}.attach(${pin});`);
  return `servo_${pin}.write(${angle});\n`;
};

g.forBlock['lcd_print'] = function (block, gen) {
  const row = block.getFieldValue('ROW');
  const text = gen.valueToCode(block, 'TEXT', Order.NONE) || '""';
  ensureLcd(gen);
  return `lcd.setCursor(0, ${row});\nlcd.print(${text});\n`;
};

g.forBlock['lcd_clear'] = function (block, gen) {
  ensureLcd(gen);
  return 'lcd.clear();\n';
};

g.forBlock['motor_servo_effect'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  gen.addInclude('servo', '#include <Servo.h>');
  gen.addDeclaration(`servo_${pin}`, `Servo servo_${pin};`);
  gen.addSetup(`servo_${pin}`, `servo_${pin}.attach(${pin});`);
  if (block.getFieldValue('EFFECT') === 'SWEEP') {
    gen.addFunction('servoSweep',
      'void servoSweep(Servo &s) {\n' +
      '  for (int a = 0; a <= 180; a += 2) {\n' +
      '    s.write(a);\n' +
      '    delay(10);\n' +
      '  }\n' +
      '  for (int a = 180; a >= 0; a -= 2) {\n' +
      '    s.write(a);\n' +
      '    delay(10);\n' +
      '  }\n' +
      '}');
    return `servoSweep(servo_${pin});\n`;
  }
  gen.addFunction('servoNod',
    'void servoNod(Servo &s) {\n' +
    '  for (int i = 0; i < 2; i++) {\n' +
    '    s.write(60);\n' +
    '    delay(300);\n' +
    '    s.write(0);\n' +
    '    delay(300);\n' +
    '  }\n' +
    '}');
  return `servoNod(servo_${pin});\n`;
};

g.forBlock['lcd_blink'] = function (block, gen) {
  ensureLcd(gen);
  gen.addFunction('lcdBlink',
    'void lcdBlink() {\n' +
    '  for (int i = 0; i < 3; i++) {\n' +
    '    lcd.noBacklight();\n' +
    '    delay(250);\n' +
    '    lcd.backlight();\n' +
    '    delay(250);\n' +
    '  }\n' +
    '}');
  return 'lcdBlink();\n';
};
