'use strict';
const DIGITAL_PINS = Array.from({ length: 14 }, (_, i) => [String(i), String(i)]);
const PWM_PINS = ['3', '5', '6', '9', '10', '11'].map((p) => [p, p]);
const ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((p) => [p, p]);
module.exports = { DIGITAL_PINS, PWM_PINS, ANALOG_PINS };
