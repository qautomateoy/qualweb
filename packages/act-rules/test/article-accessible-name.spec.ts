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

for (const attributes of ['aria-hidden="true"', 'hidden', 'style="display:none"']) {
  nameCases.push({
    title: `exclude children with ${attributes}`,
    html: `<a id="target" href="#"><article id="excluded" ${attributes}>Excluded</article></a>`,
    name: '',
    sources: []
  });
}

for (const role of ['presentation', 'none']) {
  nameCases.push(
    {
      title: `retain own text of ${role} descendants`,
      html: `<a id="target" href="#"><article id="source" role="${role}">Retained</article></a>`,
      name: 'Retained',
      sources: ['source']
    },
    {
      title: `retain nested text of ${role} descendants`,
      html: `<a id="target" href="#"><article role="${role}"><div><span id="source">Retained</span><span hidden>Excluded</span></div></article></a>`,
      name: 'Retained',
      sources: ['source']
    },
    {
      title: `standalone ${role} elements remain unnamed`,
      html: `<article id="target" role="${role}">Retained</article>`,
      name: '',
      sources: []
    },
    {
      title: `presentational ${role} figures retain content without a caption`,
      html: `<a id="target" href="#"><article><figure role="${role}"><span id="source">Retained</span></figure></article></a>`,
      name: 'Retained',
      sources: ['source']
    }
  );
}

for (const attributes of ['aria-hidden="true"', 'hidden', 'style="display:none"']) {
  nameCases.push({
    title: `directly referenced labels with ${attributes}`,
    html: `<a id="target" href="#" aria-labelledby="source" aria-label="Ignored"><article>Ignored</article></a><article id="source" ${attributes}>Referenced label</article>`,
    name: 'Referenced label',
    sources: ['source']
  });
  nameCases.push(
    {
      title: `nested directly referenced labels with ${attributes}`,
      html: `<button id="target" aria-labelledby="label"></button><article id="label" ${attributes}><div><span id="source">Referenced label</span></div></article>`,
      name: 'Referenced label',
      sources: ['source']
    },
    {
      title: `explicitly hidden descendants of referenced labels with ${attributes}`,
      html: `<button id="target" aria-labelledby="label"></button><article id="label" ${attributes}><span id="source" hidden>Referenced label</span></article>`,
      name: 'Referenced label',
      sources: ['source']
    }
  );
}

nameCases.push(
  {
    title: 'visible referenced labels still exclude hidden descendants',
    html: '<button id="target" aria-labelledby="label"></button><article id="label"><span id="source">Visible</span><span hidden>Excluded</span></article>',
    name: 'Visible',
    sources: ['source']
  },
  {
    title: 'visible referenced labels with only hidden descendants have no source',
    html: '<button id="target" aria-labelledby="label"></button><article id="label"><span hidden>Excluded</span></article>',
    name: '',
    sources: []
  },
  {
    title: 'inherited hiding of a referenced label retains its descendants',
    html: '<button id="target" aria-labelledby="label"></button><div hidden><article id="label"><span id="source">Referenced label</span></article></div>',
    name: 'Referenced label',
    sources: ['source']
  },
  {
    title: 'hidden-reference context does not leak into another reference',
    html: '<button id="target" aria-labelledby="hidden-label visible-label"></button><article id="hidden-label" hidden><span id="first">First</span></article><article id="visible-label"><span id="second">Second</span><span hidden>Excluded</span></article>',
    name: 'First Second',
    sources: ['first', 'second']
  }
);

for (const [container, caption] of [
  ['figure', 'figcaption'],
  ['table', 'caption'],
  ['fieldset', 'legend']
]) {
  nameCases.push({
    title: `hidden referenced ${caption} retains every contributing source`,
    html: `<button id="target" aria-labelledby="label"></button><article id="label" aria-hidden="true"><${container}><${caption}><span id="first">First</span><span id="second">Second</span></${caption}></${container}></article>`,
    name: /^First\s*Second$/,
    sources: ['first', 'second']
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

  for (const firstIncludeHidden of [false, true]) {
    it(`keeps hidden-reference cache context separate when starting with ${firstIncludeHidden}`, async () => {
      await loadHtml('<article id="label" hidden><div><span>Referenced label</span></div></article>');
      const names = await page.evaluate((firstIncludeHidden) => {
        const element = window.qwPage.getElementByID('label');
        if (!element) throw new Error('Missing label element');
        return [firstIncludeHidden, !firstIncludeHidden, firstIncludeHidden].map(
          (includeHidden) =>
            window.AccessibilityUtils.getAccessibleNameRecursion(element, true, false, includeHidden) ?? ''
        );
      }, firstIncludeHidden);
      expect(names).to.deep.equal(
        [firstIncludeHidden, !firstIncludeHidden, firstIncludeHidden].map((includeHidden) =>
          includeHidden ? 'Referenced label' : ''
        )
      );
    });
  }

  it('R12 passes article links and fails hidden-only links', async () => {
    await loadHtml(
      '<a id="named" href="#"><article><div><h3>Article title</h3></div></article></a><a id="empty" href="#"><article hidden>Excluded</article></a><a id="presentational" href="#"><article role="none">Retained</article></a><a id="referenced" href="#" aria-labelledby="label"></a><article id="label" hidden><span>Referenced label</span></article>'
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
      { id: 'empty', verdict: 'failed' },
      { id: 'presentational', verdict: 'passed' },
      { id: 'referenced', verdict: 'passed' }
    ]);
  });

  for (const rule of ['QW-ACT-R37', 'QW-ACT-R76']) {
    it(`${rule} excludes actual disabled-widget name sources only`, async () => {
      await loadHtml(`
        <style>body { background: white; } h3, span, article, p { color: #aaa; background: white; }</style>
        <a href="#" aria-disabled="true"><article><div>
          <h3 id="inactive">Disabled article heading</h3>
          <article role="presentation"><span id="presentational">Presentational name source</span></article>
          <span id="excluded" aria-hidden="true">Visible text excluded from the name</span>
        </div></article></a>
        <article id="reference" aria-hidden="true"><span id="reference-text">Hidden referenced label</span><figure><figcaption><span id="caption-first">First</span><span id="caption-second">Second</span></figcaption></figure></article>
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
      expect(results.map((result) => result.id)).not.to.include('reference-text');
      expect(results.map((result) => result.id)).not.to.include('presentational');
      expect(results.map((result) => result.id)).not.to.include('caption-first');
      expect(results.map((result) => result.id)).not.to.include('caption-second');
      expect(results).to.have.deep.members([
        { id: 'excluded', verdict: 'failed' },
        { id: 'control', verdict: 'failed' }
      ]);
    });
  }
});
