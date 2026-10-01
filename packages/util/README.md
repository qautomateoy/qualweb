# QualWeb utilities

Utilities module for QualWeb.

## Accessible names for article link cards

When calculating an enclosing element's accessible name, the utility traverses
descendants with the `article` role, including native `<article>` elements.
For example, `<a href="/example"><article><h3>Example</h3></article></a>` has the
QualWeb accessible name `Example` and passes QW-ACT-R12. Existing hidden-content
filtering and explicit ARIA naming precedence still apply. This does not enable
name-from-content for a standalone article.

`getAccessibleNameSelector` uses the same content-recursion role condition,
including article descendants and generic wrappers. This retains their source
selectors for consumers such as the disabled-widget checks in QW-ACT-R37 and
QW-ACT-R76.

Selector child traversal excludes hidden and presentational descendants, matching
the name calculation. Direct `aria-labelledby` references can still use hidden
label elements. Content-derived selectors include all contributing descendants
and the element's own or CSS-generated text, rather than only the first child or
its wrapper.
Whitespace-only `aria-label` values do not override those content sources.

This local behavior can differ from Chromium's accessibility tree. A passing
QualWeb result does not establish that the link is named in every browser and
screen reader combination.

## How to use

**This is an internal module of QualWeb. To use it please check either [@qualweb/cli](https://github.com/qualweb/cli) or [@qualweb/core](https://github.com/qualweb/core).**

# License

ISC
