'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const globals = new Set([
  'Array','Boolean','Date','Error','TypeError','RangeError','EvalError',
  'Intl','JSON','Map','Math','Number','Object','Promise','RegExp','Set',
  'String','WeakMap','WeakSet','Symbol','BigInt','Reflect','Proxy',
  'parseInt','parseFloat','isNaN','isFinite','NaN','Infinity','undefined',
  'console','process','setTimeout','clearTimeout','setInterval','clearInterval',
  'requestAnimationFrame','cancelAnimationFrame','window','document',
  'navigator','globalThis','global','URL','URLSearchParams','fetch',
  'encodeURIComponent','decodeURIComponent','btoa','atob','Buffer','AbortController',
  'FormData','Headers','Blob','File','TextEncoder','TextDecoder','__DEV__',
]);

function undefinedReferences(source) {
  const ast = parser.parse(source, {
    sourceType: 'module', plugins: ['jsx'],
  });
  const missing = new Map();
  traverse(ast, {
    ReferencedIdentifier(identifier) {
      const name = identifier.node.name;
      if (globals.has(name) || identifier.scope.hasBinding(name)) return;
      const line = identifier.node.loc?.start.line || '?';
      missing.set(name, Math.min(missing.get(name) || Infinity, Number(line)));
    },
  });
  return [...missing].map(([name,line]) => name + ' (line ' + line + ')').sort();
}

test('App and extracted hooks have no undefined JavaScript identifiers', () => {
  const files = [
    'App.js','hooks/useClientNotifications.js','hooks/useAdminNotifications.js',
    'hooks/useStudioServices.js','hooks/useAdminTodayStats.js',
    'hooks/useHomeInspirations.js',
  ];
  for (const file of files) {
    const code = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    assert.deepEqual(undefinedReferences(code), [], file + ' references missing globals/imports');
  }
});

test('Undefined calendar imports that caused the white screen are rejected', () => {
  const faulty = 'export function Calendar() { return initialBookableDate() + futureDates() + buildCalendar(); }';
  assert.deepEqual(undefinedReferences(faulty), [
    'buildCalendar (line 1)', 'futureDates (line 1)', 'initialBookableDate (line 1)',
  ]);
});

test('Imported calendar functions are accepted by the source checker', () => {
  const correct = "import {initialBookableDate,futureDates,buildCalendar} from './utils/calendar';\n"+
    "export function Calendar() { return [initialBookableDate(),futureDates(),buildCalendar()]; }";
  assert.deepEqual(undefinedReferences(correct), []);
});
