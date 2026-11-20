'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');
const { PWM_PINS } = require('../pins.js');

Blockly.defineBlocksWithJsonArray([
  { type: 'motor_servo',
    message0: '%{BKY_BD_SERVO}',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: PWM_PINS },
      { type: 'input_value', name: 'ANGLE', check: 'Number' },
    ],
    previousStatement: null, nextStatement: null, colour: 290 },
  { type: 'lcd_print',
    message0: '%{BKY_BD_LCD_PRINT}',
    args0: [
      { type: 'field_dropdown', name: 'ROW', options: [['1', '0'], ['2', '1']] },
      { type: 'input_value', name: 'TEXT' },
    ],
    previousStatement: null, nextStatement: null, colour: 290,
    tooltip: '%{BKY_BD_LCD_PRINT_TOOLTIP}' },
  { type: 'lcd_clear',
    message0: '%{BKY_BD_LCD_CLEAR}',
    previousStatement: null, nextStatement: null, colour: 290 },
  { type: 'motor_servo_effect',
    message0: '%{BKY_BD_SERVO_EFFECT}',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: PWM_PINS },
      { type: 'field_dropdown', name: 'EFFECT', options: [
        ['%{BKY_BD_SERVO_EFFECT_SWEEP}', 'SWEEP'],
        ['%{BKY_BD_SERVO_EFFECT_NOD}', 'NOD'],
      ] },
    ],
    previousStatement: null, nextStatement: null, colour: 290,
    tooltip: '%{BKY_BD_SERVO_EFFECT_TOOLTIP}' },
  { type: 'lcd_blink',
    message0: '%{BKY_BD_LCD_BLINK}',
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
  gen.servoUsed_ = true; // loop 끝 지터 방지 지연 트리거
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
  gen.servoUsed_ = true; // loop 끝 지터 방지 지연 트리거
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
