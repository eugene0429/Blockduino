'use strict';
const { t } = require('../shared/i18n.js');

const shadowNum = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });

// Built on demand so category names follow the current language.
function buildToolbox() {
  return {
    kind: 'categoryToolbox',
    contents: [
      { kind: 'category', name: t('cat.basic'), colour: '120', contents: [
        { kind: 'block', type: 'basic_setup' },
        { kind: 'block', type: 'basic_loop' },
        { kind: 'block', type: 'basic_delay', inputs: { SECONDS: shadowNum(1) } },
      ] },
      { kind: 'category', name: t('cat.io'), colour: '20', contents: [
        { kind: 'block', type: 'io_led' },
        { kind: 'block', type: 'io_led_effect' },
        { kind: 'block', type: 'io_digital_write' },
        { kind: 'block', type: 'io_digital_read' },
        { kind: 'block', type: 'io_analog_write', inputs: { VALUE: shadowNum(255) } },
        { kind: 'block', type: 'io_analog_read' },
        { kind: 'block', type: 'io_button' },
        { kind: 'block', type: 'io_buzzer_tone' },
        { kind: 'block', type: 'io_buzzer_melody' },
        { kind: 'block', type: 'io_buzzer_off' },
      ] },
      { kind: 'category', name: t('cat.sensors'), colour: '190', contents: [
        { kind: 'block', type: 'sensor_ultrasonic' },
        { kind: 'block', type: 'sensor_dht' },
        { kind: 'block', type: 'sensor_cds' },
      ] },
      { kind: 'category', name: t('cat.motorLcd'), colour: '290', contents: [
        { kind: 'block', type: 'motor_servo', inputs: { ANGLE: shadowNum(90) } },
        { kind: 'block', type: 'motor_servo_effect' },
        { kind: 'block', type: 'lcd_print', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: t('toolbox.lcdDefaultText') } } } } },
        { kind: 'block', type: 'lcd_clear' },
        { kind: 'block', type: 'lcd_blink' },
      ] },
      { kind: 'category', name: t('cat.logic'), colour: '210', contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare', inputs: { A: shadowNum(0), B: shadowNum(0) } },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
      ] },
      { kind: 'category', name: t('cat.loops'), colour: '120', contents: [
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadowNum(10) } },
        { kind: 'block', type: 'controls_whileUntil' },
      ] },
      { kind: 'category', name: t('cat.math'), colour: '230', contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic', inputs: { A: shadowNum(1), B: shadowNum(1) } },
        { kind: 'block', type: 'text' },
      ] },
      { kind: 'category', name: t('cat.variables'), colour: '330', custom: 'VARIABLE' },
    ],
  };
}

module.exports = { buildToolbox };
