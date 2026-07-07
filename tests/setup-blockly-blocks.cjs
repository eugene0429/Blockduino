'use strict';
const Blockly = require('blockly/core');
// vitest.config.js가 'blockly'와 'blockly/core'를 동일한 CJS 코어 엔트리로
// alias 처리하기 때문에, 'blockly' 패키지를 전체 로드할 때 함께 등록되던
// 표준 블록(math_number 등)이 빠진다. 테스트가 그 표준 블록에 의존하므로
// (예: blocks-basic.test.js의 math_number 섀도 블록) 동일한 Blockly 코어
// 인스턴스에 표준 블록 정의를 등록해 준다.
require('blockly/blocks');

// 표준 블록 JSON은 %{BKY_...} 로케일 메시지 참조를 사용하는데, 로케일 메시지를
// 로드하지 않으면 controls_repeat_ext/variables_set 등의 초기화가
// "Message does not reference all args" 오류로 실패한다. 테스트 환경에서는
// 영어 로케일을 로드해 표준 블록이 정상 초기화되도록 한다.
Blockly.setLocale(require('blockly/msg/en'));
