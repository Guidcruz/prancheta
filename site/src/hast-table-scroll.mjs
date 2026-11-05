import { defineHastPlugin } from 'satteri';

/**
 * Sätteri (hast) plugin: wraps every Markdown table in the accessible scroll
 * region used by TableScroll.astro (styles in table-scroll.css).
 */
let count = 0;
export const tableScroll = defineHastPlugin({
  name: 'table-scroll',
  before() {
    count = 0;
  },
  element: {
    filter: ['table'],
    visit(node, ctx) {
      count += 1;
      ctx.replaceNode(node, {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['scroll'],
          tabIndex: 0,
          role: 'region',
          ariaLabel: `Tabela ${count} do post (tabela com rolagem)`,
          style: '--table-min: 520px',
        },
        children: [node],
      });
    },
  },
});
