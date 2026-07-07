'use strict';

// 부품별 배선 정보: pins(block) → [{ boardPin, partPin, color }]
const WIRING = {
  io_led: {
    title: 'LED',
    pins: (b) => [
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '저항 220Ω → 긴 다리(+)', color: '#e53935' },
      { boardPin: 'GND', partPin: '짧은 다리(−)', color: '#424242' },
    ],
  },
  io_button: {
    title: '버튼',
    pins: (b) => [
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '버튼 한쪽 다리', color: '#fb8c00' },
      { boardPin: 'GND', partPin: '반대쪽 다리', color: '#424242' },
    ],
  },
  io_buzzer_tone: {
    title: '부저',
    pins: (b) => [
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '+ (긴 다리)', color: '#fb8c00' },
      { boardPin: 'GND', partPin: '− (짧은 다리)', color: '#424242' },
    ],
  },
  sensor_ultrasonic: {
    title: '초음파 센서 (HC-SR04)',
    pins: (b) => [
      { boardPin: '5V', partPin: 'VCC', color: '#e53935' },
      { boardPin: `D${b.getFieldValue('TRIG')}`, partPin: 'Trig', color: '#fb8c00' },
      { boardPin: `D${b.getFieldValue('ECHO')}`, partPin: 'Echo', color: '#1e88e5' },
      { boardPin: 'GND', partPin: 'GND', color: '#424242' },
    ],
  },
  sensor_dht: {
    title: '온습도 센서 (DHT11)',
    pins: (b) => [
      { boardPin: '5V', partPin: 'VCC(+)', color: '#e53935' },
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: 'DATA(out)', color: '#fb8c00' },
      { boardPin: 'GND', partPin: 'GND(−)', color: '#424242' },
    ],
  },
  sensor_cds: {
    title: '조도 센서 (CDS)',
    pins: (b) => [
      { boardPin: '5V', partPin: 'CDS 한쪽 다리', color: '#e53935' },
      { boardPin: b.getFieldValue('PIN'), partPin: 'CDS 반대쪽 다리 + 저항 10kΩ', color: '#fb8c00' },
      { boardPin: 'GND', partPin: '저항 10kΩ 반대쪽', color: '#424242' },
    ],
  },
  motor_servo: {
    title: '서보모터 (SG90)',
    pins: (b) => [
      { boardPin: '5V', partPin: '빨간 선', color: '#e53935' },
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '주황(신호) 선', color: '#fb8c00' },
      { boardPin: 'GND', partPin: '갈색 선', color: '#424242' },
    ],
  },
  lcd_print: {
    title: 'LCD (I2C 16x2)',
    pins: () => [
      { boardPin: '5V', partPin: 'VCC', color: '#e53935' },
      { boardPin: 'A4', partPin: 'SDA', color: '#1e88e5' },
      { boardPin: 'A5', partPin: 'SCL', color: '#43a047' },
      { boardPin: 'GND', partPin: 'GND', color: '#424242' },
    ],
  },
};
WIRING.lcd_clear = WIRING.lcd_print;
WIRING.io_buzzer_off = WIRING.io_buzzer_tone;
WIRING.io_digital_write = { title: '디지털 출력 부품',
  pins: WIRING.io_led.pins };

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text) el.textContent = text;
  return el;
}

// 카드 1장: 왼쪽 아두이노 핀 열, 오른쪽 부품 핀 열, 색선으로 연결
function renderCard(entry, block) {
  const pins = entry.pins(block);
  const h = 40 + pins.length * 34;
  const svg = svgEl('svg', { viewBox: `0 0 320 ${h}`, width: '100%' });
  svg.appendChild(svgEl('rect', { x: 4, y: 30, width: 90, height: h - 38, rx: 8, fill: '#2e7d32' }));
  svg.appendChild(svgEl('rect', { x: 226, y: 30, width: 90, height: h - 38, rx: 8, fill: '#eceff1', stroke: '#90a4ae' }));
  svg.appendChild(svgEl('text', { x: 49, y: 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 'bold' }, '아두이노 우노'));
  svg.appendChild(svgEl('text', { x: 271, y: 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 'bold' }, entry.title));
  pins.forEach((p, i) => {
    const y = 56 + i * 34;
    svg.appendChild(svgEl('text', { x: 49, y: y + 4, 'text-anchor': 'middle', 'font-size': 13, fill: '#fff', 'font-weight': 'bold' }, p.boardPin));
    svg.appendChild(svgEl('line', { x1: 94, y1: y, x2: 226, y2: y, stroke: p.color, 'stroke-width': 3 }));
    svg.appendChild(svgEl('text', { x: 271, y: y + 4, 'text-anchor': 'middle', 'font-size': 11 }, p.partPin));
  });
  return svg;
}

function renderWiringPanel(workspace, panelEl) {
  panelEl.innerHTML = '';
  const seen = new Set();
  const blocks = workspace.getAllBlocks(false).filter((b) => WIRING[b.type]);
  if (blocks.length === 0) {
    panelEl.textContent = '부품 블록을 사용하면 여기에 연결 방법이 나와요.';
    return;
  }
  for (const block of blocks) {
    const entry = WIRING[block.type];
    // 같은 부품+같은 핀 조합은 카드 1장만
    const key = entry.title + JSON.stringify(entry.pins(block));
    if (seen.has(key)) continue;
    seen.add(key);
    const card = document.createElement('div');
    card.style.marginBottom = '16px';
    card.appendChild(renderCard(entry, block));
    panelEl.appendChild(card);
  }
}

module.exports = { renderWiringPanel, WIRING };
