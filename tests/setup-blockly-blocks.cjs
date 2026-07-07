'use strict';
// vitest.config.js가 'blockly'와 'blockly/core'를 동일한 CJS 코어 엔트리로
// alias 처리하기 때문에, 'blockly' 패키지를 전체 로드할 때 함께 등록되던
// 표준 블록(math_number 등)이 빠진다. 테스트가 그 표준 블록에 의존하므로
// (예: blocks-basic.test.js의 math_number 섀도 블록) 동일한 Blockly 코어
// 인스턴스에 표준 블록 정의를 등록해 준다.
require('blockly/blocks');
