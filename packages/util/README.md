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

Both calculations exclude hidden children during ordinary content traversal.
The `presentation` and `none` roles do not hide an article's text: its own text
and non-hidden descendants still contribute to its enclosing link's name.
Direct `aria-labelledby` references to hidden labels include nested descendants,
even if those descendants are also hidden. A visible referenced label still
excludes its hidden descendants. This hidden-reference context is separate for
each reference and is included in the recursive name cache key.

Selectors for `aria-labelledby`, captions, and legends identify all contributing
text sources, not merely the referenced wrapper or first child. Content-derived
selectors include all contributing descendants
and the element's own or CSS-generated text, rather than only the first child or
its wrapper.
Whitespace-only `aria-label` values do not override those content sources.

These distinctions follow the [presentation role](https://www.w3.org/TR/wai-aria-1.2/#presentation)
and the [hidden-reference computation rules](https://www.w3.org/TR/accname-1.2/#computation-steps).

This local behavior can differ from Chromium's accessibility tree. A passing
QualWeb result does not establish that the link is named in every browser and
screen reader combination.

## How to use

**This is an internal module of QualWeb. To use it please check either [@qualweb/cli](https://github.com/qualweb/cli) or [@qualweb/core](https://github.com/qualweb/core).**

# License

ISC
