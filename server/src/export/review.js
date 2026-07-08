// A self-contained review page: answer the open questions and correct any step
// in plain language. Edits post back to the pipeline and only touch the step
// they name.

export function reviewPage(id, sop, clarifications = []) {
  const questions = clarifications
    .map(
      (c) => `
        <div class="q">
          <label>${escape(c.text)}</label>
          <input class="answer" data-step="${c.stepIndex == null ? '' : c.stepIndex}" />
        </div>`
    )
    .join('');

  const steps = sop.steps
    .map(
      (step) => `
        <li${step.corrected ? ' class="edited"' : ''}>
          <h3>${escape(step.title)}</h3>
          <p>${escape(step.detail)}</p>
          <details>
            <summary>Correct this step</summary>
            <input class="c-title" value="${escape(step.title)}" />
            <textarea class="c-detail">${escape(step.detail)}</textarea>
            <button type="button" onclick="correct(${step.index}, this)">Save correction</button>
          </details>
        </li>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Review — ${escape(sop.title)}</title>
    <style>
      body { font: 15px/1.5 system-ui, sans-serif; color: #1f2328; max-width: 720px; margin: 40px auto; padding: 0 20px; }
      h1 { font-size: 22px; }
      h2 { font-size: 16px; margin-top: 28px; }
      .clarify { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px; padding: 14px 16px; }
      .q { margin-bottom: 10px; }
      label { display: block; margin-bottom: 4px; }
      input, textarea { width: 100%; padding: 6px 8px; border: 1px solid #d0d7de; border-radius: 6px; font: inherit; box-sizing: border-box; }
      textarea { min-height: 60px; margin-top: 6px; }
      ol { padding-left: 20px; }
      li { margin-bottom: 14px; }
      li.edited h3::after { content: ' (edited)'; color: #57606a; font-weight: 400; font-size: 13px; }
      h3 { margin: 0 0 2px; font-size: 15px; }
      p { margin: 0 0 6px; }
      details summary { cursor: pointer; color: #57606a; font-size: 13px; }
      button { margin-top: 8px; padding: 7px 12px; border: 0; border-radius: 6px; background: #1f6feb; color: #fff; font-weight: 600; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>${escape(sop.title)}</h1>
    ${clarifications.length ? `<section class="clarify"><h2>A few questions</h2>${questions}<button type="button" onclick="submitAnswers()">Save answers</button></section>` : ''}
    <h2>Steps</h2>
    <ol>${steps}
    </ol>
    <p><a href="/sops/${id}">Visual guide</a> &middot; <a href="/sops/${id}/sop.md">Markdown</a></p>
    <script>
      async function submitAnswers() {
        const answers = [...document.querySelectorAll('.answer')]
          .map((el) => ({ stepIndex: el.dataset.step ? Number(el.dataset.step) : null, text: el.value }))
          .filter((a) => a.text.trim());
        await fetch('/sops/${id}/answers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers }) });
        location.reload();
      }
      async function correct(stepIndex, btn) {
        const li = btn.closest('li');
        const title = li.querySelector('.c-title').value;
        const detail = li.querySelector('.c-detail').value;
        await fetch('/sops/${id}/corrections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stepIndex, title, detail }) });
        location.reload();
      }
    </script>
  </body>
</html>
`;
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
