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
