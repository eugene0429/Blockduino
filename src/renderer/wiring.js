'use strict';

// 부품별 배선 안내: 우노 보드 + 브레드보드 + 소자 모양을 SVG로 직접 그려
// 실제 배선 모습에 가깝게 보여준다. 블록에서 고른 핀 번호가 그대로 반영된다.
//
// 좌표 규약 (브레드보드 장면, viewBox 360x~285):
//   우노 보드  y 8..88, 핀 헤더는 보드 아래쪽 (drawUno가 핀 좌표 반환)
//   브레드보드 y 112..208, 구멍 줄 0..4 = y 158..198 (같은 세로줄은 연결됨)
//   점퍼선     우노 핀 → 위쪽 줄(0~1) 구멍
//   소자 몸통  y 210 아래 (보드 아래에 매달림, 다리가 아래쪽 줄 4에 꽂힘)
//
// 점퍼선은 위쪽 줄에, 소자는 아래쪽에 배치해 선과 부품이 겹치지 않는다.
// 같은 세로줄 하이라이트가 "선 ↔ 소자 다리"의 연결을 보여준다.

const COLOR = {
  power: '#e53935',   // 5V 빨강
  gnd: '#37474f',     // GND 검정
  sig1: '#fb8c00',    // 신호 주황
  sig2: '#1e88e5',    // 신호 파랑
  sig3: '#43a047',    // 신호 초록
  brown: '#6d4c41',   // 서보 갈색선
};

// ── 배선 정보 (범례 텍스트) + 장면(scene) ─────────────────────────
const WIRING = {
  // LED 계열은 renderWiringPanel에서 핀을 모아 카드 1장(ledsScene)으로 합쳐 그린다
  io_led: { title: 'LED', ledFamily: true },
  io_button: {
    title: '버튼',
    pins: (b) => [
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '버튼 한쪽 다리', color: COLOR.sig1 },
      { boardPin: 'GND', partPin: '반대쪽 다리', color: COLOR.gnd },
    ],
    scene: (svg, b) => buttonScene(svg, b.getFieldValue('PIN')),
  },
  io_buzzer_tone: {
    title: '부저',
    pins: (b) => [
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '+ (긴 다리)', color: COLOR.sig1 },
      { boardPin: 'GND', partPin: '− (짧은 다리)', color: COLOR.gnd },
    ],
    scene: (svg, b) => buzzerScene(svg, b.getFieldValue('PIN')),
  },
  sensor_ultrasonic: {
    title: '초음파 센서 (HC-SR04)',
    pins: (b) => [
      { boardPin: '5V', partPin: 'VCC', color: COLOR.power },
      { boardPin: `D${b.getFieldValue('TRIG')}`, partPin: 'Trig', color: COLOR.sig1 },
      { boardPin: `D${b.getFieldValue('ECHO')}`, partPin: 'Echo', color: COLOR.sig2 },
      { boardPin: 'GND', partPin: 'GND', color: COLOR.gnd },
    ],
    scene: (svg, b) => ultrasonicScene(svg, b.getFieldValue('TRIG'), b.getFieldValue('ECHO')),
  },
  sensor_dht: {
    title: '온습도 센서 (DHT11)',
    pins: (b) => [
      { boardPin: 'GND', partPin: 'GND (1번, 가장 왼쪽)', color: COLOR.gnd },
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: 'SIG (3번 핀)', color: COLOR.sig1 },
      { boardPin: '5V', partPin: 'VCC (4번, 가장 오른쪽)', color: COLOR.power },
    ],
    note: '2번 핀은 아무것도 연결하지 않아요.',
    scene: (svg, b) => dhtScene(svg, b.getFieldValue('PIN')),
  },
  sensor_cds: {
    title: '조도 센서 (CDS)',
    pins: (b) => [
      { boardPin: '5V', partPin: 'CDS 한쪽 다리', color: COLOR.power },
      { boardPin: b.getFieldValue('PIN'), partPin: 'CDS 반대쪽 다리 (저항 10kΩ와 같은 줄)', color: COLOR.sig1 },
      { boardPin: 'GND', partPin: '저항 10kΩ 반대쪽', color: COLOR.gnd },
    ],
    scene: (svg, b) => cdsScene(svg, b.getFieldValue('PIN')),
  },
  motor_servo: {
    title: '서보모터 (SG90)',
    pins: (b) => [
      { boardPin: 'GND', partPin: '갈색 선', color: COLOR.brown },
      { boardPin: '5V', partPin: '빨간 선', color: COLOR.power },
      { boardPin: `D${b.getFieldValue('PIN')}`, partPin: '주황(신호) 선', color: COLOR.sig1 },
    ],
    scene: (svg, b) => servoScene(svg, b.getFieldValue('PIN')),
  },
  lcd_print: {
    title: 'LCD (I2C 16x2)',
    pins: () => [
      { boardPin: 'GND', partPin: 'GND', color: COLOR.gnd },
      { boardPin: '5V', partPin: 'VCC', color: COLOR.power },
      { boardPin: 'A4', partPin: 'SDA', color: COLOR.sig2 },
      { boardPin: 'A5', partPin: 'SCL', color: COLOR.sig3 },
    ],
    scene: (svg) => lcdScene(svg),
  },
};
WIRING.lcd_clear = WIRING.lcd_print;
WIRING.lcd_blink = WIRING.lcd_print;
WIRING.io_buzzer_off = WIRING.io_buzzer_tone;
WIRING.io_buzzer_melody = WIRING.io_buzzer_tone;
WIRING.io_led_effect = WIRING.io_led;
WIRING.io_digital_write = WIRING.io_led;
WIRING.motor_servo_effect = WIRING.motor_servo;

// ── SVG 헬퍼 ──────────────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text) el.textContent = text;
  return el;
}

// 흰 테두리(halo)를 두른 텍스트 — 점퍼선 위에서도 읽힌다
function haloText(svg, attrs, text) {
  svg.appendChild(svgEl('text', {
    'font-family': 'sans-serif', 'paint-order': 'stroke',
    stroke: '#ffffff', 'stroke-width': 2.5, 'stroke-linejoin': 'round',
    ...attrs,
  }, text));
}

const holeX = (col) => 45 + col * 15;
const holeY = (row) => 158 + row * 10;

// 우노 보드: pinLabels 순서대로 아래쪽 헤더에 핀을 그리고 좌표 맵을 반환
function drawUno(svg, pinLabels) {
  svg.appendChild(svgEl('rect', { x: 30, y: 8, width: 300, height: 80, rx: 10, fill: '#0e7c86' }));
  svg.appendChild(svgEl('rect', { x: 30, y: 18, width: 30, height: 20, rx: 2, fill: '#9e9e9e' })); // USB
  svg.appendChild(svgEl('rect', { x: 296, y: 16, width: 22, height: 24, rx: 3, fill: '#263238' })); // 전원잭
  svg.appendChild(svgEl('text', { x: 180, y: 34, 'text-anchor': 'middle', 'font-size': 12,
    fill: '#ffffff', 'font-weight': 'bold', 'font-family': 'sans-serif' }, 'ARDUINO UNO'));
  const n = pinLabels.length;
  const gap = 30;
  const x0 = 30 + (300 - (n - 1) * gap) / 2;
  svg.appendChild(svgEl('rect', { x: x0 - 15, y: 62, width: (n - 1) * gap + 30, height: 20, rx: 3, fill: '#263238' }));
  const map = {};
  pinLabels.forEach((label, i) => {
    const x = x0 + i * gap;
    svg.appendChild(svgEl('circle', { cx: x, cy: 74, r: 3.2, fill: '#ffd54f' }));
    svg.appendChild(svgEl('text', { x, y: 58, 'text-anchor': 'middle', 'font-size': 9,
      fill: '#fff', 'font-weight': 'bold', 'font-family': 'sans-serif' }, label));
    map[label] = { x, y: 76 };
  });
  return map;
}

function drawBreadboard(svg) {
  const y0 = 112;
  svg.appendChild(svgEl('rect', { x: 30, y: y0, width: 300, height: 96, rx: 6,
    fill: '#f2eee3', stroke: '#d5cdb8' }));
  const hole = (x, y) => svg.appendChild(svgEl('rect',
    { x: x - 2.2, y: y - 2.2, width: 4.4, height: 4.4, rx: 1, fill: '#4e453f' }));
  // 전원 레일 (위쪽, 장식)
  svg.appendChild(svgEl('line', { x1: 40, y1: y0 + 8, x2: 320, y2: y0 + 8, stroke: '#e53935', 'stroke-width': 2 }));
  for (let col = 0; col < 19; col++) hole(holeX(col), y0 + 16);
  for (let col = 0; col < 19; col++) hole(holeX(col), y0 + 26);
  svg.appendChild(svgEl('line', { x1: 40, y1: y0 + 34, x2: 320, y2: y0 + 34, stroke: '#1e88e5', 'stroke-width': 2 }));
  // 메인 구멍 줄 0..4
  for (let col = 0; col < 19; col++) {
    for (let row = 0; row < 5; row++) hole(holeX(col), holeY(row));
  }
}

// 사용 중인 세로줄을 연하게 강조 (같은 세로줄 = 서로 연결)
function highlightCols(svg, cols) {
  for (const col of cols) {
    svg.appendChild(svgEl('rect', { x: holeX(col) - 4.5, y: 153, width: 9, height: 50, rx: 4,
      fill: 'rgba(76, 175, 80, 0.18)' }));
  }
}

// 점퍼선: 우노 핀 → 브레드보드 구멍 (부드러운 곡선)
function drawWire(svg, from, to, color) {
  const d = `M ${from.x} ${from.y} C ${from.x} ${from.y + 45}, ${to.x} ${to.y - 45}, ${to.x} ${to.y}`;
  svg.appendChild(svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
  svg.appendChild(svgEl('circle', { cx: from.x, cy: from.y, r: 2.6, fill: color }));
  svg.appendChild(svgEl('circle', { cx: to.x, cy: to.y, r: 2.6, fill: color }));
}

// 소자 다리: 아래쪽 줄(4) 구멍에서 보드 아래 몸통(yBottom)까지. dx로 살짝 비켜 그릴 수 있다
function drawLeg(svg, col, yBottom, dx = 0) {
  svg.appendChild(svgEl('line', { x1: holeX(col) + dx, y1: holeY(4), x2: holeX(col) + dx, y2: yBottom,
    stroke: '#8d8d8d', 'stroke-width': 2 }));
}

// 저항: colA~colB 사이 가로 배치 (보드 아래), 다리는 3번째 줄 구멍으로.
// 소자 다리(줄 4)와 같은 세로줄을 쓸 수 있으므로 3px 비켜 그린다.
function drawResistor(svg, colA, colB, label) {
  const xA = holeX(colA) + 3;
  const xB = holeX(colB) + 3;
  for (const x of [xA, xB]) {
    svg.appendChild(svgEl('line', { x1: x, y1: holeY(3), x2: x, y2: 221, stroke: '#8d8d8d', 'stroke-width': 2 }));
  }
  svg.appendChild(svgEl('line', { x1: xA, y1: 221, x2: xB, y2: 221, stroke: '#8d8d8d', 'stroke-width': 2 }));
  svg.appendChild(svgEl('rect', { x: xA + 8, y: 214, width: xB - xA - 16, height: 14, rx: 6,
    fill: '#e8d3a2', stroke: '#c9b27f' }));
  const w = xB - xA - 16;
  ['#8d6e63', '#d32f2f', '#455a64'].forEach((c, i) => {
    svg.appendChild(svgEl('rect', { x: xA + 8 + w * (0.25 + i * 0.2), y: 214, width: 3.5, height: 14, fill: c }));
  });
  haloText(svg, { x: (xA + xB) / 2, y: 240, 'text-anchor': 'middle', 'font-size': 8, fill: '#555' }, label);
}

function partLabel(svg, x, y, text) {
  haloText(svg, { x, y, 'text-anchor': 'middle', 'font-size': 8, fill: '#555' }, text);
}

// ── 부품 장면들 (브레드보드: 선은 위쪽 줄, 소자는 보드 아래) ──────
// LED 색상 팔레트: 여러 개일 때 순서대로 빨강 → 노랑 → 초록
const LED_COLORS = [
  ['빨강', '#ff5252', '#c62828'],
  ['노랑', '#ffd600', '#f9a825'],
  ['초록', '#4caf50', '#2e7d32'],
];
const LED_WIRE_COLORS = [COLOR.sig1, COLOR.sig2, COLOR.sig3];

// LED 1~3개를 브레드보드 한 장에 그린다
function ledsScene(svg, pins) {
  const n = pins.length;
  const uno = drawUno(svg, [...pins.map((p) => `D${p}`), 'GND']);
  drawBreadboard(svg);
  const bases = { 1: [7], 2: [4, 10], 3: [1, 7, 13] }[n];
  highlightCols(svg, bases.flatMap((b) => [b, b + 2, b + 4]));
  bases.forEach((b, i) => {
    drawWire(svg, uno[`D${pins[i]}`], { x: holeX(b), y: holeY(0) }, LED_WIRE_COLORS[i]);
    drawWire(svg, uno['GND'], { x: holeX(b + 4), y: holeY(0) }, COLOR.gnd);
  });
  bases.forEach((b, i) => {
    drawResistor(svg, b, b + 2, n > 1 ? '220Ω' : '저항 220Ω');
    drawLeg(svg, b + 2, 236);   // 긴 다리(+)
    drawLeg(svg, b + 4, 240);   // 짧은 다리(−)
    const cx = (holeX(b + 2) + holeX(b + 4)) / 2;
    const [name, fill, stroke] = n > 1 ? LED_COLORS[i] : ['LED', '#ff5252', '#c62828'];
    svg.appendChild(svgEl('circle', { cx, cy: 248, r: 11, fill, stroke }));
    haloText(svg, { x: holeX(b + 2) - 9, y: 216, 'font-size': 9, fill: '#c62828', 'font-weight': 'bold' }, '+');
    haloText(svg, { x: holeX(b + 4) + 4, y: 216, 'font-size': 9, fill: '#555', 'font-weight': 'bold' }, '−');
    partLabel(svg, cx, 274, n > 1 ? `${name} LED` : 'LED');
  });
}

// LED 합본 카드 (그림 + 범례)
function renderLedsCard(pins) {
  const card = document.createElement('div');
  card.className = 'wiring-card';
  const title = document.createElement('h4');
  title.textContent = pins.length > 1 ? `LED ${pins.length}개` : 'LED';
  card.appendChild(title);

  const svg = svgEl('svg', { viewBox: '0 0 360 282', width: '100%' });
  ledsScene(svg, pins);
  card.appendChild(svg);

  const legend = document.createElement('ul');
  legend.className = 'wiring-legend';
  const entries = pins.map((p, i) => ({
    boardPin: `D${p}`,
    partPin: `저항 220Ω → ${pins.length > 1 ? LED_COLORS[i][0] + ' ' : ''}LED 긴 다리(+)`,
    color: LED_WIRE_COLORS[i],
  }));
  entries.push({ boardPin: 'GND',
    partPin: pins.length > 1 ? '모든 LED 짧은 다리(−)' : 'LED 짧은 다리(−)',
    color: COLOR.gnd });
  for (const p of entries) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.color;
    li.appendChild(dot);
    li.appendChild(document.createTextNode(`${p.boardPin} → ${p.partPin}`));
    legend.appendChild(li);
  }
  card.appendChild(legend);
  return card;
}

function buttonScene(svg, pin) {
  const uno = drawUno(svg, [`D${pin}`, 'GND']);
  drawBreadboard(svg);
  highlightCols(svg, [8, 10]);
  drawWire(svg, uno[`D${pin}`], { x: holeX(8), y: holeY(0) }, COLOR.sig1);
  drawWire(svg, uno['GND'], { x: holeX(10), y: holeY(0) }, COLOR.gnd);
  drawLeg(svg, 8, 222);
  drawLeg(svg, 10, 222);
  const cx = (holeX(8) + holeX(10)) / 2;
  svg.appendChild(svgEl('rect', { x: holeX(8) - 8, y: 220, width: holeX(10) - holeX(8) + 16,
    height: 26, rx: 4, fill: '#455a64' }));
  svg.appendChild(svgEl('circle', { cx, cy: 233, r: 8, fill: '#cfd8dc', stroke: '#90a4ae' }));
  partLabel(svg, cx, 260, '버튼');
}

function buzzerScene(svg, pin) {
  // 부저는 브레드보드 없이 점퍼선으로 직접 연결
  const labels = [`D${pin}`, 'GND'];
  const colors = [COLOR.sig1, COLOR.gnd];
  const uno = drawUno(svg, labels);
  const xs = labels.map((l) => uno[l].x);
  const cx = (xs[0] + xs[1]) / 2;
  labels.forEach((l, i) => {
    const stub = drawModulePin(svg, uno[l].x, 186);
    drawWire(svg, uno[l], stub, colors[i]);
  });
  svg.appendChild(svgEl('circle', { cx, cy: 202, r: 20, fill: '#212121' }));
  svg.appendChild(svgEl('circle', { cx, cy: 202, r: 3.5, fill: '#fafafa' }));
  haloText(svg, { x: xs[0] - 9, y: 180, 'font-size': 9, fill: '#c62828', 'font-weight': 'bold' }, '+');
  haloText(svg, { x: xs[1] + 4, y: 180, 'font-size': 9, fill: '#555', 'font-weight': 'bold' }, '−');
  partLabel(svg, cx, 240, '부저 (점퍼선으로 직접 연결)');
}

function cdsScene(svg, analogPin) {
  const uno = drawUno(svg, ['5V', analogPin, 'GND']);
  drawBreadboard(svg);
  highlightCols(svg, [8, 10, 14]);
  drawWire(svg, uno['5V'], { x: holeX(8), y: holeY(0) }, COLOR.power);
  drawWire(svg, uno[analogPin], { x: holeX(10), y: holeY(1) }, COLOR.sig1);
  drawWire(svg, uno['GND'], { x: holeX(14), y: holeY(0) }, COLOR.gnd);
  // CDS 본체 (다리: 8, 10번 줄)
  drawLeg(svg, 8, 226);
  drawLeg(svg, 10, 226);
  const cx = (holeX(8) + holeX(10)) / 2;
  svg.appendChild(svgEl('ellipse', { cx, cy: 236, rx: 15, ry: 11, fill: '#ef9a5a', stroke: '#c47b3d' }));
  svg.appendChild(svgEl('path', {
    d: `M ${cx - 10} 232 l 4 4 l 4 -6 l 4 6 l 4 -6 l 4 4`,
    fill: 'none', stroke: '#a33', 'stroke-width': 1.6 }));
  partLabel(svg, cx, 262, '조도 센서');
  // 분압 저항 10kΩ: CDS 오른쪽 다리(10번 줄) ↔ 14번 줄
  drawResistor(svg, 10, 14, '저항 10kΩ');
}

// 모듈형 부품은 핀 헤더를 우노 쪽(위)으로 돌려서, 점퍼선이 핀에 바로 꽂히는
// 모습으로 그린다 (실제로도 브레드보드 없이 암-암 점퍼선으로 직접 연결).
// 모듈 핀 x좌표를 우노 핀과 똑같이 맞춰 선이 일직선이 되게 한다.

// 모듈 상단 핀 스터브(금색 핀)를 그리고 연결 좌표를 반환
function drawModulePin(svg, x, yTop) {
  svg.appendChild(svgEl('rect', { x: x - 2, y: yTop - 10, width: 4, height: 10, fill: '#c9a227' }));
  return { x, y: yTop - 10 };
}

function ultrasonicScene(svg, trig, echo) {
  const labels = ['5V', `D${trig}`, `D${echo}`, 'GND'];
  const colors = [COLOR.power, COLOR.sig1, COLOR.sig2, COLOR.gnd];
  const uno = drawUno(svg, labels);
  const top = 168;
  // 몸통 (핀 헤더가 위, 센서 원통이 아래 = 180도 회전 방향)
  const xs = labels.map((l) => uno[l].x);
  const xL = Math.min(...xs);
  const xR = Math.max(...xs);
  svg.appendChild(svgEl('rect', { x: xL - 24, y: top, width: xR - xL + 48, height: 56, rx: 4,
    fill: '#1565c0', stroke: '#0d47a1' }));
  labels.forEach((l, i) => {
    const stub = drawModulePin(svg, uno[l].x, top);
    drawWire(svg, uno[l], stub, colors[i]);
  });
  ['VCC', 'Trig', 'Echo', 'GND'].forEach((t, i) => {
    svg.appendChild(svgEl('text', { x: xs[i], y: top + 13, 'text-anchor': 'middle', 'font-size': 7.5,
      fill: '#fff', 'font-family': 'sans-serif' }, t));
  });
  for (const cx of [xL + 4, xR - 4]) {
    svg.appendChild(svgEl('circle', { cx, cy: top + 36, r: 14, fill: '#b0bec5', stroke: '#78909c', 'stroke-width': 2 }));
    svg.appendChild(svgEl('circle', { cx, cy: top + 36, r: 7.5, fill: '#546e7a' }));
  }
  svg.appendChild(svgEl('text', { x: (xL + xR) / 2, y: top + 40, 'text-anchor': 'middle', 'font-size': 8,
    fill: '#fff', 'font-family': 'sans-serif' }, 'HC-SR04'));
  partLabel(svg, (xL + xR) / 2, top + 70, '초음파 센서 (점퍼선으로 직접 연결)');
}

function dhtScene(svg, pin) {
  // 실습 키트 DHT11 핀 배열 (격자면 기준 왼쪽부터): GND · 미사용 · SIG · VCC
  const uno = drawUno(svg, ['GND', `D${pin}`, '5V']);
  const top = 168;
  const pinXs = [135, 165, 195, 225]; // GND, 안씀, SIG, VCC
  const xL = pinXs[0];
  const xR = pinXs[3];
  svg.appendChild(svgEl('rect', { x: xL - 18, y: top, width: xR - xL + 36, height: 52, rx: 3,
    fill: '#42a5f5', stroke: '#1976d2' }));
  // 핀 스터브 4개 + 연결선 3개 (2번 핀은 연결 안 함)
  const stubs = pinXs.map((x) => drawModulePin(svg, x, top));
  drawWire(svg, uno['GND'], stubs[0], COLOR.gnd);
  drawWire(svg, uno[`D${pin}`], stubs[2], COLOR.sig1);
  drawWire(svg, uno['5V'], stubs[3], COLOR.power);
  ['GND', '안씀', 'SIG', 'VCC'].forEach((t, i) => {
    svg.appendChild(svgEl('text', { x: pinXs[i], y: top + 13, 'text-anchor': 'middle', 'font-size': 7.5,
      fill: i === 1 ? '#bbdefb' : '#fff', 'font-family': 'sans-serif' }, t));
  });
  // 격자 무늬 (DHT11 몸통) — 몸통 전체 폭에 균등 배치
  const bodyL = xL - 18;
  const bodyR = xR + 18;
  const gridW = 16;
  const gridStep = (bodyR - bodyL - 24 - gridW) / 3; // 좌우 여백 12px
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 3; gy++) {
      svg.appendChild(svgEl('rect', {
        x: bodyL + 12 + gx * gridStep, y: top + 21 + gy * 9, width: gridW, height: 5,
        fill: '#1565c0' }));
    }
  }
  partLabel(svg, (xL + xR) / 2, top + 66, '온습도 DHT11 (점퍼선으로 직접 연결)');
}

// ── 모듈 직접 연결 장면 (브레드보드 불필요) ───────────────────────
function servoScene(svg, pin) {
  const uno = drawUno(svg, ['GND', '5V', `D${pin}`]);
  // 3선 케이블 먼저 (몸통이 케이블 끝을 덮도록): 갈색(GND)·빨강(5V)·주황(신호)
  const entries = [
    ['GND', COLOR.brown, 160],
    ['5V', COLOR.power, 166],
    [`D${pin}`, COLOR.sig1, 172],
  ];
  for (const [label, color, y] of entries) {
    const from = uno[label];
    const d = `M ${from.x} ${from.y} C ${from.x} ${from.y + 40}, 110 ${y}, 158 ${y}`;
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
    svg.appendChild(svgEl('circle', { cx: from.x, cy: from.y, r: 2.6, fill: color }));
  }
  // 서보 몸통
  svg.appendChild(svgEl('rect', { x: 191, y: 128, width: 8, height: 24, rx: 4, fill: '#eceff1', stroke: '#b0bec5' })); // 혼
  svg.appendChild(svgEl('circle', { cx: 195, cy: 150, r: 9, fill: '#eceff1', stroke: '#b0bec5' })); // 축
  svg.appendChild(svgEl('rect', { x: 150, y: 150, width: 90, height: 52, rx: 6, fill: '#3949ab' }));
  svg.appendChild(svgEl('rect', { x: 138, y: 168, width: 12, height: 10, fill: '#3949ab' })); // 고정 날개
  svg.appendChild(svgEl('rect', { x: 240, y: 168, width: 12, height: 10, fill: '#3949ab' }));
  svg.appendChild(svgEl('text', { x: 195, y: 182, 'text-anchor': 'middle', 'font-size': 10,
    fill: '#fff', 'font-family': 'sans-serif' }, 'SG90'));
  partLabel(svg, 195, 218, '서보모터');
}

function lcdScene(svg) {
  const uno = drawUno(svg, ['GND', '5V', 'A4', 'A5']);
  const pinsX = { GND: 110, '5V': 150, A4: 190, A5: 230 };
  const labels = { GND: 'GND', '5V': 'VCC', A4: 'SDA', A5: 'SCL' };
  const colors = { GND: COLOR.gnd, '5V': COLOR.power, A4: COLOR.sig2, A5: COLOR.sig3 };
  // 선 먼저
  for (const key of ['GND', '5V', 'A4', 'A5']) {
    drawWire(svg, uno[key], { x: pinsX[key], y: 156 }, colors[key]);
  }
  // LCD 모듈
  svg.appendChild(svgEl('rect', { x: 80, y: 150, width: 200, height: 78, rx: 5,
    fill: '#2e7d32', stroke: '#1b5e20' }));
  svg.appendChild(svgEl('rect', { x: 95, y: 172, width: 170, height: 46, rx: 3,
    fill: '#1a237e', stroke: '#0d1257' }));
  svg.appendChild(svgEl('text', { x: 180, y: 199, 'text-anchor': 'middle', 'font-size': 12,
    fill: '#c5e1a5', 'font-family': 'monospace' }, '안녕! BLOCKDUINO'));
  for (const key of ['GND', '5V', 'A4', 'A5']) {
    const tx = pinsX[key];
    svg.appendChild(svgEl('circle', { cx: tx, cy: 156, r: 3, fill: '#ffd54f' }));
    svg.appendChild(svgEl('text', { x: tx, y: 168, 'text-anchor': 'middle', 'font-size': 8,
      fill: '#fff', 'font-family': 'sans-serif' }, labels[key]));
  }
  partLabel(svg, 180, 242, 'I2C LCD 모듈 (주소 0x27)');
}

// 장면별 세로 크기
const SCENE_HEIGHT = {
  motor_servo: 230, motor_servo_effect: 230,
  lcd_print: 252, lcd_clear: 252, lcd_blink: 252,
  sensor_ultrasonic: 246, sensor_dht: 242,
  io_button: 268,
  io_buzzer_tone: 250, io_buzzer_off: 250, io_buzzer_melody: 250, sensor_cds: 272,
};

// ── 카드 렌더링 ───────────────────────────────────────────────────
function renderCard(entry, block, titleSuffix) {
  const card = document.createElement('div');
  card.className = 'wiring-card';

  const title = document.createElement('h4');
  title.textContent = entry.title + (titleSuffix || '');
  card.appendChild(title);

  const h = SCENE_HEIGHT[block.type] || 262;
  const svg = svgEl('svg', { viewBox: `0 0 360 ${h}`, width: '100%' });
  entry.scene(svg, block);
  card.appendChild(svg);

  const legend = document.createElement('ul');
  legend.className = 'wiring-legend';
  for (const p of entry.pins(block)) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.color;
    li.appendChild(dot);
    li.appendChild(document.createTextNode(`${p.boardPin} → ${p.partPin}`));
    legend.appendChild(li);
  }
  if (entry.note) {
    const li = document.createElement('li');
    li.className = 'wiring-note';
    li.textContent = `※ ${entry.note}`;
    legend.appendChild(li);
  }
  card.appendChild(legend);
  return card;
}

function renderWiringPanel(workspace, panelEl) {
  panelEl.innerHTML = '';
  const seen = new Set();
  const blocks = workspace.getAllBlocks(false).filter((b) => WIRING[b.type]);
  if (blocks.length === 0) {
    panelEl.textContent = '부품 블록을 사용하면 여기에 연결 방법이 나와요.';
    return;
  }
  const cards = [];
  const ledPins = [];
  for (const block of blocks) {
    const entry = WIRING[block.type];
    if (entry.ledFamily) {
      // LED 계열은 핀만 모아서 나중에 카드 1장으로 합쳐 그린다
      const p = block.getFieldValue('PIN');
      if (!ledPins.includes(p)) ledPins.push(p);
      continue;
    }
    // 같은 부품+같은 핀 조합은 카드 1장만
    const key = entry.title + JSON.stringify(entry.pins(block));
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ entry, block });
  }
  // 같은 제목 카드가 여러 장이면 신호 핀 번호로 구분
  const titleCount = new Map();
  for (const c of cards) titleCount.set(c.entry.title, (titleCount.get(c.entry.title) || 0) + 1);
  for (const c of cards) {
    let suffix = '';
    if (titleCount.get(c.entry.title) > 1) {
      const pins = c.entry.pins(c.block);
      const sig = pins.find((p) => /^[DA]\d/.test(p.boardPin)) || pins[0];
      suffix = ` — ${sig.boardPin} 핀`;
    }
    panelEl.appendChild(renderCard(c.entry, c.block, suffix));
  }
  // LED 카드: 핀 3개까지 한 장, 넘으면 나눠서
  ledPins.sort((a, b) => Number(a) - Number(b));
  for (let i = 0; i < ledPins.length; i += 3) {
    panelEl.appendChild(renderLedsCard(ledPins.slice(i, i + 3)));
  }
}

module.exports = { renderWiringPanel, WIRING };
