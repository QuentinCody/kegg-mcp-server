#!/usr/bin/env node
// interlinked-tdd: exempt

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (haystack.includes(needle)) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    console.log(`  Missing: ${needle}`);
    console.log(`  File: ${filePath}`);
    failedTests++;
  }
}

function readFile(relPath) {
  const absPath = path.resolve(SERVER_ROOT, relPath);
  return fs.readFileSync(absPath, 'utf8');
}

console.log(`${BLUE}🧪 KEGG Structured Content Regression Tests${RESET}`);

const toolExpectations = [
  {
    path: 'src/tools/code-mode.ts',
    required: ['createSearchTool', 'createExecuteTool', 'kegg', 'keggCatalog'],
  },
  {
    path: 'src/tools/query-data.ts',
    required: ['createQueryDataHandler', 'kegg_query_data'],
  },
  {
    path: 'src/tools/get-schema.ts',
    required: ['createGetSchemaHandler', 'kegg_get_schema'],
  },
];

for (const { path: filePath, required } of toolExpectations) {
  const content = readFile(filePath);
  for (const token of required) {
    assertContains(filePath, content, token, `${filePath} includes ${token}`);
  }
}

const indexContent = readFile('src/index.ts');
assertContains('src/index.ts', indexContent, 'KeggDataDO', 'index.ts exports KeggDataDO');
assertContains('src/index.ts', indexContent, 'McpAgent', 'index.ts uses McpAgent');
assertContains('src/index.ts', indexContent, 'registerCodeMode', 'index.ts wires registerCodeMode');
assertContains('src/index.ts', indexContent, 'registerQueryData', 'index.ts wires registerQueryData');
assertContains('src/index.ts', indexContent, 'registerGetSchema', 'index.ts wires registerGetSchema');

const catalogContent = readFile('src/spec/catalog.ts');
for (const category of ['info', 'list', 'find', 'get', 'conv', 'link', 'ddi']) {
  assertContains(
    'src/spec/catalog.ts',
    catalogContent,
    `category: "${category}"`,
    `catalog covers category "${category}"`,
  );
}
assertContains('src/spec/catalog.ts', catalogContent, 'TAB-DELIMITED', 'catalog notes mention tab-delimited parsing');
assertContains('src/spec/catalog.ts', catalogContent, 'rest.kegg.jp', 'catalog targets rest.kegg.jp');

const adapterContent = readFile('src/lib/api-adapter.ts');
assertContains('src/lib/api-adapter.ts', adapterContent, 'parseTabSeparated', 'api-adapter parses tab-delimited responses');
assertContains('src/lib/api-adapter.ts', adapterContent, 'detectOperation', 'api-adapter detects KEGG operation');

const httpContent = readFile('src/lib/http.ts');
assertContains('src/lib/http.ts', httpContent, 'rest.kegg.jp', 'http.ts targets rest.kegg.jp');

const wranglerContent = readFile('wrangler.jsonc');
assertContains('wrangler.jsonc', wranglerContent, 'KEGG_DATA_DO', 'wrangler.jsonc binds KEGG_DATA_DO');
assertContains('wrangler.jsonc', wranglerContent, 'KeggDataDO', 'wrangler.jsonc migrates KeggDataDO class');
assertContains('wrangler.jsonc', wranglerContent, '"port": 8898', 'wrangler.jsonc dev port is 8898');
assertContains('wrangler.jsonc', wranglerContent, 'CODE_MODE_LOADER', 'wrangler.jsonc binds CODE_MODE_LOADER');

console.log(`\n${BLUE}📊 Test Results Summary${RESET}`);
console.log(`Total tests: ${totalTests}`);
console.log(`${GREEN}Passed: ${passedTests}${RESET}`);
console.log(`${RED}Failed: ${failedTests}${RESET}`);

if (failedTests > 0) {
  console.log(`\n${RED}❌ Regression tests failed.${RESET}`);
  process.exit(1);
}

console.log(`\n${GREEN}✅ KEGG structured content regression tests passed.${RESET}`);
