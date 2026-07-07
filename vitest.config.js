'use strict';
const path = require('path');

// 소스 모듈(src/**)은 CommonJS(`require('blockly/core')`)를 쓰고, 플랜이 명시한
// 테스트 파일(tests/**)은 ESM(`import * as Blockly from 'blockly'`)을 쓴다.
// vitest(vite-node)는 두 개의 서로 다른 모듈 레지스트리를 갖는다:
//   (1) ESM `import` 문으로 들어온 모듈  → vite-node 자체 SSR 모듈 캐시
//   (2) 소스 코드에 literal로 적힌 `require(...)` 호출  → Node의 진짜
//       `createRequire()`/`require.cache` (vite-node가 각 모듈 실행 스코프에
//       real Node require를 주입하기 때문)
// 이 둘은 서로 캐시를 공유하지 않는다. 그래서 (a) blockly 패키지 자체가
// 조건부 exports(require→core-node.js vs import→index.mjs)로 인해 서로 다른
// 인스턴스로 갈라지는 문제와, (b) 우리 자신의 src/shared 파일들이
// "테스트의 import 진입점" vs "다른 src 파일의 require 진입점"으로 각각 다른
// 레지스트리에 두 번 로드되어 arduinoGenerator 싱글턴이 두 개가 되는 문제가
// 동시에 발생해 "generator does not know how to generate code for block type
// 'basic_setup'" 에러가 났다.
//
// 해결책:
//   - `deps.external: [/src\/shared\//]` 로 우리 자신의 src 파일들을 vite-node
//     SSR 변환에서 제외하고 Node의 진짜 동적 import/require로만 로드되게
//     강제한다 → (테스트의 import든 다른 src의 require든) 항상 같은 Node
//     모듈 레지스트리를 쓰게 되어 arduinoGenerator 싱글턴이 하나만 존재한다.
//   - `resolve.alias` 로 'blockly'와 'blockly/core' 를 동일한 CJS 코어
//     엔트리(core-node.js)에 고정해서 단일 Blockly 인스턴스(단일 블록
//     레지스트리)를 보장한다.
//   - 위 alias로 'blockly' 전체 패키지 로드시 따라오던 표준 블록 등록
//     (math_number 등, 원래 'blockly/blocks' 로드의 부작용)이 빠지므로,
//     setupFiles에서 같은 코어 인스턴스에 'blockly/blocks'를 한 번 로드해
//     등록해 준다.
module.exports = {
  resolve: {
    alias: [
      { find: /^blockly\/core$/, replacement: path.resolve(__dirname, 'node_modules/blockly/core-node.js') },
      { find: /^blockly$/, replacement: path.resolve(__dirname, 'node_modules/blockly/core-node.js') },
    ],
  },
  test: {
    server: {
      deps: {
        inline: ['blockly'],
        external: [/src\/shared\//],
        fallbackCJS: true,
      },
    },
    setupFiles: [path.resolve(__dirname, 'tests/setup-blockly-blocks.cjs')],
  },
};
