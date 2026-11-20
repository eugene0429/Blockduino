'use strict';
const Blockly = require('blockly/core');
const { arduinoGenerator: g, Order } = require('../arduino-generator.js');
const { DIGITAL_PINS, ANALOG_PINS } = require('../pins.js');
const { t } = require('../i18n.js');

Blockly.defineBlocksWithJsonArray([
  { type: 'sensor_ultrasonic',
    message0: '%{BKY_BD_ULTRASONIC}',
    args0: [
      { type: 'field_dropdown', name: 'TRIG', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'ECHO', options: DIGITAL_PINS },
    ],
    output: 'Number', colour: 190,
    tooltip: '%{BKY_BD_ULTRASONIC_TOOLTIP}' },
  { type: 'sensor_dht',
    message0: '%{BKY_BD_DHT}',
    args0: [
      { type: 'field_dropdown', name: 'PIN', options: DIGITAL_PINS },
      { type: 'field_dropdown', name: 'MODE',
        options: [['%{BKY_BD_DHT_TEMP}', 'TEMP'], ['%{BKY_BD_DHT_HUM}', 'HUM']] },
    ],
    output: 'Number', colour: 190,
    tooltip: '%{BKY_BD_DHT_TOOLTIP}' },
  { type: 'sensor_cds',
    message0: '%{BKY_BD_CDS}',
    args0: [{ type: 'field_dropdown', name: 'PIN', options: ANALOG_PINS }],
    output: 'Number', colour: 190,
    tooltip: '%{BKY_BD_CDS_TOOLTIP}' },
]);

const US_MEASURE =
  '  pinMode(trigPin, OUTPUT);\n' +
  '  pinMode(echoPin, INPUT);\n' +
  '  digitalWrite(trigPin, LOW);\n' +
  '  delayMicroseconds(2);\n' +
  '  digitalWrite(trigPin, HIGH);\n' +
  '  delayMicroseconds(10);\n' +
  '  digitalWrite(trigPin, LOW);\n' +
  '  long duration = pulseIn(echoPin, HIGH, 30000);\n';

g.forBlock['sensor_ultrasonic'] = function (block, gen) {
  const trig = block.getFieldValue('TRIG');
  const echo = block.getFieldValue('ECHO');
  if (gen.debugSerial) {
    // 디버그 중에는 센서 읽기가 한 루프에 여러 번(프로그램 로직 + 시리얼 출력)
    // 일어날 수 있다. HC-SR04는 짧은 간격으로 재트리거하면 잔향 탓에 두 번째가
    // 0/잡값을 낸다. 그래서 최근 값을 캐시하고, 50ms 이내 재호출은 재측정 없이
    // 캐시를 돌려줘 재트리거를 막는다.
    gen.addDeclaration('us_last', 'float _usLast = 0;\nunsigned long _usLastT = 0;');
    gen.addFunction('readUltrasonic',
      'float readUltrasonic(int trigPin, int echoPin) {\n' +
      '  if (_usLastT != 0 && millis() - _usLastT < 50) return _usLast;\n' +
      '  _usLastT = millis();\n' +
      US_MEASURE +
      '  _usLast = duration * 0.0343 / 2.0;\n' +
      '  return _usLast;\n}');
  } else {
    gen.addFunction('readUltrasonic',
      'float readUltrasonic(int trigPin, int echoPin) {\n' +
      US_MEASURE +
      '  return duration * 0.0343 / 2.0;\n}');
  }
  return [`readUltrasonic(${trig}, ${echo})`, Order.ATOMIC];
};

g.forBlock['sensor_dht'] = function (block, gen) {
  const pin = block.getFieldValue('PIN');
  const method = block.getFieldValue('MODE') === 'TEMP' ? 'readTemperature' : 'readHumidity';
  gen.addInclude('dht', '#include <DHT.h>');
  gen.addDeclaration(`dht_${pin}`, `DHT dht_${pin}(${pin}, DHT11);`);
  // DHT11은 전원 후 안정화에 ~1초 걸린다. begin 직후 잠깐 기다려 첫 읽기가
  // nan으로 실패하지 않게 한다.
  gen.addSetup(`dht_${pin}`, `dht_${pin}.begin();\n  delay(1500);`);
  return [`dht_${pin}.${method}()`, Order.ATOMIC];
};

g.forBlock['sensor_cds'] = function (block) {
  return [`analogRead(${block.getFieldValue('PIN')})`, Order.ATOMIC];
};

// 시리얼 디버그에서 각 센서를 어떤 이름으로 출력할지. 생성기가 이 목록의
// 키로 센서 블록을 스캔한다 (arduino-generator.js init 참고).
g.debugLabels = {
  sensor_cds: (b) => t('debug.cds', { pin: b.getFieldValue('PIN') }),
  sensor_ultrasonic: () => t('debug.distance'),
  sensor_dht: (b) => t(b.getFieldValue('MODE') === 'TEMP' ? 'debug.temp' : 'debug.humidity'),
};
