import { CASES, CONNECTIVES, announce, evaluateAll, noteFor, truthWord } from '../core/connectives.mjs';

const letter = (value) => (value ? 'T' : 'F');

export function truthWidgetMarkup() {
  const results = CONNECTIVES.map((item) => `<li><span class="widget-symbol">${item.symbol}</span><span class="widget-meaning">${item.meaning}</span><strong data-result="${item.id}" data-value="true">True</strong></li>`).join('');
  const heads = CONNECTIVES.slice(2).map((item) => `<th scope="col">${item.symbol}</th>`).join('');
  const rows = CASES.map(([p, q]) => `<tr data-case="${p},${q}"><th scope="row">${letter(p)}</th><td>${letter(q)}</td>${evaluateAll(p, q).slice(2).map((item) => `<td>${letter(item.value)}</td>`).join('')}</tr>`).join('');
  return `<div class="widget inset" data-widget="truth-table" data-ready="false"><div class="widget-head"><span class="tag">Interactive</span><h3>Flip the switches</h3><p>Press p and q to change their truth values and watch every connective update.</p></div><div class="widget-switches" role="group" aria-label="Truth values"><button class="switch" type="button" data-var="p" aria-pressed="true"><span class="switch-name">p</span><span class="switch-value" aria-hidden="true">True</span></button><button class="switch" type="button" data-var="q" aria-pressed="true"><span class="switch-name">q</span><span class="switch-value" aria-hidden="true">True</span></button></div><ul class="widget-results">${results}</ul><p class="widget-note" data-note></p><p class="screen-reader" role="status" data-announce></p><div class="widget-table-wrap"><table class="widget-table"><caption>All four cases</caption><thead><tr><th scope="col">p</th><th scope="col">q</th>${heads}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

export function mountTruthWidget(root) {
  if (!root || root.dataset.ready === 'true') return;
  const state = { p: true, q: true };

  function update(announceChange) {
    for (const name of ['p', 'q']) {
      const button = root.querySelector(`[data-var="${name}"]`);
      button.setAttribute('aria-pressed', String(state[name]));
      button.querySelector('.switch-value').textContent = truthWord(state[name]);
    }
    for (const item of evaluateAll(state.p, state.q)) {
      const cell = root.querySelector(`[data-result="${item.id}"]`);
      cell.textContent = truthWord(item.value);
      cell.dataset.value = String(item.value);
    }
    root.querySelectorAll('tbody tr').forEach((row) => {
      if (row.dataset.case === `${state.p},${state.q}`) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
    root.querySelector('[data-note]').textContent = noteFor(state.p, state.q);
    if (announceChange) root.querySelector('[data-announce]').textContent = announce(state.p, state.q);
  }

  root.querySelectorAll('[data-var]').forEach((button) => {
    button.addEventListener('click', () => {
      state[button.dataset.var] = !state[button.dataset.var];
      update(true);
    });
  });
  update(false);
  root.dataset.ready = 'true';
}
