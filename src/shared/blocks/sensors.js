'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');
const { DIGITAL_PINS, ANALOG_PINS } = require('../pins.js');

Blockly.defineBlocksWithJsonArray([
  { type: 'sensor_ultrasonic',
    message0: '초음파 거리(cm) 트리거 %1 에코 %2',
    args0: [
      { type: 'field_dropdown', name: 'TRIG', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'ECHO', options: DIGITAL_PINS },
    ],
    output: 'Number', colour: 190,
    tooltip: 'HC-SR04 초음파 센서로 잰 거리(센티미터)예요.' },
  { type: 'sensor_dht',
    message0: '온습도 센서 %1 번 핀의 %2',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'MODE',
        options: [['온도(℃)', 'TEMP'], ['습도(%)', 'HUM']] },
    ],
    output: 'Number', colour: 190,
    tooltip: 'DHT11 센서의 온도 또는 습도 값이에요.' },
  { type: 'sensor_cds',
    message0: '조도 센서 %1 핀 밝기 (0~1023)',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: ANALOG_PINS }],
    output: 'Number', colour: 190,
    tooltip: 'CDS 조도 센서 값이에요. 밝을수록 값이 커져요.' },
]);

g.forBlock['sensor_ultrasonic'] = function (block, gen) {
  const trig = block.getFieldValue('TRIG');
  const echo = block.getFieldValue('ECHO');
  gen.addFunction('readUltrasonic',
    'float readUltrasonic(int trigPin, int echoPin) {\n' +
    '  pinMode(trigPin, OUTPUT);\n' +
    '  pinMode(echoPin, INPUT);\n' +
    '  digitalWrite(trigPin, LOW);\n' +
    '  delayMicroseconds(2);\n' +
    '  digitalWrite(trigPin, HIGH);\n' +
    '  delayMicroseconds(10);\n' +
    '  digitalWrite(trigPin, LOW);\n' +
    '  long duration = pulseIn(echoPin, HIGH, 30000);\n' +
    '  return duration * 0.0343 / 2.0;\n' +
    '}');
  return [`readUltrasonic(${trig}, ${echo})`, Order.ATOMIC];
};

g.forBlock['sensor_dht'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const method = block.getFieldValue('MODE') === 'TEMP' ? 'readTemperature' : 'readHumidity';
  gen.addInclude('dht', '#include <DHT.h>');
  gen.addDeclaration(`dht_${pin}`, `DHT dht_${pin}(${pin}, DHT11);`);
  gen.addSetup(`dht_${pin}`, `dht_${pin}.begin();`);
  return [`dht_${pin}.${method}()`, Order.ATOMIC];
};

g.forBlock['sensor_cds'] = function (block) {
  return [`analogRead(${block.getFieldValue('PIN')})`, Order.ATOMIC];
};
