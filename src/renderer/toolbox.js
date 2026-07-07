'use strict';
const shadowNum = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });

module.exports = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: '기본', colour: '120', contents: [
      { kind: 'block', type: 'basic_setup' },
      { kind: 'block', type: 'basic_loop' },
      { kind: 'block', type: 'basic_delay', inputs: { SECONDS: shadowNum(1) } },
    ] },
    { kind: 'category', name: '입출력', colour: '20', contents: [
      { kind: 'block', type: 'io_led' },
      { kind: 'block', type: 'io_digital_write' },
      { kind: 'block', type: 'io_digital_read' },
      { kind: 'block', type: 'io_analog_write', inputs: { VALUE: shadowNum(255) } },
      { kind: 'block', type: 'io_analog_read' },
      { kind: 'block', type: 'io_button' },
      { kind: 'block', type: 'io_buzzer_tone' },
      { kind: 'block', type: 'io_buzzer_off' },
    ] },
    { kind: 'category', name: '센서', colour: '190', contents: [
      { kind: 'block', type: 'sensor_ultrasonic' },
      { kind: 'block', type: 'sensor_dht' },
      { kind: 'block', type: 'sensor_cds' },
    ] },
    { kind: 'category', name: '모터/화면', colour: '290', contents: [
      { kind: 'block', type: 'motor_servo', inputs: { ANGLE: shadowNum(90) } },
      { kind: 'block', type: 'lcd_print', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '안녕' } } } } },
      { kind: 'block', type: 'lcd_clear' },
    ] },
    { kind: 'category', name: '논리', colour: '210', contents: [
      { kind: 'block', type: 'controls_if' },
      { kind: 'block', type: 'logic_compare', inputs: { A: shadowNum(0), B: shadowNum(0) } },
      { kind: 'block', type: 'logic_operation' },
      { kind: 'block', type: 'logic_negate' },
      { kind: 'block', type: 'logic_boolean' },
    ] },
    { kind: 'category', name: '반복', colour: '120', contents: [
      { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadowNum(10) } },
      { kind: 'block', type: 'controls_whileUntil' },
    ] },
    { kind: 'category', name: '수학', colour: '230', contents: [
      { kind: 'block', type: 'math_number' },
      { kind: 'block', type: 'math_arithmetic', inputs: { A: shadowNum(1), B: shadowNum(1) } },
      { kind: 'block', type: 'text' },
    ] },
    { kind: 'category', name: '변수', colour: '330', custom: 'VARIABLE' },
  ],
};
