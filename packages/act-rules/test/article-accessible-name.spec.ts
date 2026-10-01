import { expect } from 'chai';
import type { Browser, BrowserContext, Page } from 'puppeteer';
import type {} from '@qualweb/util';
import { launchBrowser } from './util';

declare const ACTRulesRunner: typeof import('../src/ACTRulesRunner').ACTRulesRunner;

type NameCase = {
  title: string;
  html: string;
  name: string | RegExp;
  sources: string[];
};

const nameCases: NameCase[] = [
  {
    title: 'native article text',
    html: '<a id="target" href="#"><article id="source">Article title</article></a>',
    name: 'Article title',
    sources: ['source']
  },
  {
    title: 'nested article headings through generic wrappers',
    html: '<a id="target" href="#"><div><article><div><h3 id="source">Article title</h3></div></article></div></a>',
    name: 'Article title',
    sources: ['source']
  },
  {
    title: 'explicit article roles',
    html: '<a id="target" href="#"><div role="article" id="source">Article title</div></a>',
    name: 'Article title',
    sources: ['source']
  },
  {
    title: 'standalone articles remain unnamed',
    html: '<article id="target"><h3>Article title</h3></article>',
    name: '',
    sources: []
  },
  {
    title: 'all contributing descendants',
    html: '<a id="target" href="#"><article id="first">First</article><article id="second">Second</article></a>',
    name: /^First\s*Second$/,
    sources: ['first', 'second']
  },
  {
    title: 'own text and descendant text',
    html: '<a id="target" href="#">Own <article id="source">Child</article></a>',
    name: 'Own Child',
    sources: ['target', 'source']
  },
  {
    title: 'explicit labels take precedence',
    html: '<a id="target" href="#" aria-label="Explicit label"><article>Article title</article></a>',
    name: 'Explicit label',
    sources: ['target']
  },
  {
    title: 'whitespace-only labels fall back to content',
    html: '<a id="target" href="#" aria-label="  "><article id="source">Article title</article></a>',
    name: 'Article title',
    sources: ['source']
  },
  {
    title: 'nested hidden-only content has no source',
    html: '<a id="target" href="#"><article><span aria-hidden="true">Excluded</span></article></a>',
    name: '',
    sources: []
  },
  {
    title: 'hidden content does not replace visible sources',
    html: '<a id="target" href="#"><article aria-hidden="true">Excluded</article><article id="source">Visible</article></a>',
    name: 'Visible',
    sources: ['source']
  },
  {
    title: 'title fallback after filtering children',
    html: '<a id="target" href="#" title="Fallback"><article hidden>Excluded</article></a>',
    name: 'Fallback',
    sources: ['target']
  },
  {
    title: 'CSS-generated text remains a source',
    html: '<style>#source::before { content: "Generated title"; }</style><a id="target" href="#"><article id="source"><span hidden>Excluded</span></article></a>',
    name: 'Generated title',
    sources: ['source']
  }
];

for (const attributes of [
  'aria-hidden="true"',
  'hidden',
  'style="display:none"',
  'role="presentation"',
  'role="none"'
]) {
  nameCases.push({
    title: `exclude children with ${attributes}`,
    html: `<a id="target" href="#"><article id="excluded" ${attributes}>Excluded</article></a>`,
    name: '',
    sources: []
  });
}

for (const attributes of ['aria-hidden="true"', 'hidden', 'style="display:none"']) {
  nameCases.push({
    title: `directly referenced labels with ${attributes}`,
    html: `<a id="target" href="#" aria-labelledby="source" aria-label="Ignored"><article>Ignored</article></a><article id="source" ${attributes}>Referenced label</article>`,
    name: 'Referenced label',
    sources: ['source']
  });
}

describe('Article accessible names', function () {
  this.timeout(30000);
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  before(async () => {
    browser = await launchBrowser();
  });
  after(async () => {
    await browser?.close();
  });
  beforeEach(async () => {
    context = await browser.createBrowserContext();
    page = await context.newPage();
  });
  afterEach(async () => {
    await context?.close();
  });

  async function loadHtml(html: string): Promise<void> {
    await page.setContent(
      `<!doctype html><html lang="en"><head><title>Article regression</title></head><body>${html}</body></html>`
    );
    for (const moduleName of ['@qualweb/qw-page', '@qualweb/util', '@qualweb/locale', '@qualweb/act-rules']) {
      await page.addScriptTag({ path: require.resolve(moduleName) });
    }
  }

  for (const testCase of nameCases) {
    it(testCase.title, async () => {
      await loadHtml(testCase.html);
      const actual = await page.evaluate(() => {
        const element = window.qwPage.getElementByID('target');
        if (!element) throw new Error('Missing target element');
        const name = window.AccessibilityUtils.getAccessibleName(element) ?? '';
        const selectors = window.AccessibilityUtils.getAccessibleNameSelector(element);
        const sources = Array.isArray(selectors) ? selectors : selectors ? [selectors] : [];
        return { name, sources: sources.map((selector) => document.querySelector(selector)?.id) };
      });
      if (testCase.name instanceof RegExp) expect(actual.name).to.match(testCase.name);
      else expect(actual.name).to.equal(testCase.name);
      expect(actual.sources).to.have.members(testCase.sources);
    });
  }

  it('R12 passes article links and fails hidden-only links', async () => {
    await loadHtml(
      '<a id="named" href="#"><article><div><h3>Article title</h3></div></article></a><a id="empty" href="#"><article hidden>Excluded</article></a>'
    );
    const results = await page.evaluate(() => {
      const runner = new ACTRulesRunner({ include: ['QW-ACT-R12'] }, 'en');
      runner.configure();
      runner.test({ sourceHtml: document.documentElement.outerHTML });
      return runner.getReport().assertions['QW-ACT-R12'].results.flatMap((test) =>
        test.elements.map((element) => ({
          id: element.pointer ? document.querySelector(element.pointer)?.id : undefined,
          verdict: test.verdict
        }))
      );
    });
    expect(results).to.have.deep.members([
      { id: 'named', verdict: 'passed' },
      { id: 'empty', verdict: 'failed' }
    ]);
  });

  for (const rule of ['QW-ACT-R37', 'QW-ACT-R76']) {
    it(`${rule} excludes actual disabled-widget name sources only`, async () => {
      await loadHtml(`
        <style>body { background: white; } h3, span, article, p { color: #aaa; background: white; }</style>
        <a href="#" aria-disabled="true"><article><div>
          <h3 id="inactive">Disabled article heading</h3>
          <span id="excluded" aria-hidden="true">Visible text excluded from the name</span>
        </div></article></a>
        <article id="reference" aria-hidden="true">Hidden referenced label</article>
        <button disabled aria-labelledby="reference"></button>
        <p id="control">Visible text with insufficient contrast</p>
      `);
      const results = await page.evaluate((rule) => {
        const runner = new ACTRulesRunner({ include: [rule] }, 'en');
        runner.configure();
        runner.test({ sourceHtml: document.documentElement.outerHTML });
        return runner.getReport().assertions[rule].results.flatMap((test) =>
          test.elements.map((element) => ({
            id: element.pointer ? document.querySelector(element.pointer)?.id : undefined,
            verdict: test.verdict
          }))
        );
      }, rule);
      expect(results.map((result) => result.id)).not.to.include('inactive');
      expect(results.map((result) => result.id)).not.to.include('reference');
      expect(results).to.have.deep.members([
        { id: 'excluded', verdict: 'failed' },
        { id: 'control', verdict: 'failed' }
      ]);
    });
  }
});
