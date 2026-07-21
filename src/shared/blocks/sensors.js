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
  sensor_cds: (b) => `조도(${b.getFieldValue('PIN')})`,
  sensor_ultrasonic: () => '거리(cm)',
  sensor_dht: (b) => (b.getFieldValue('MODE') === 'TEMP' ? '온도(℃)' : '습도(%)'),
};
