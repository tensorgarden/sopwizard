// A built-in practice environment: a small customer-records app with a
// realistic multi-page flow (list → form → confirmation) to record against.
// Views switch through the URL hash so navigation shows up in the SOP, and
// the form is a real form so field and submit events are captured.

import { shell } from './theme.js';

const css = `
  .app { background: var(--card); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; margin-top: 26px; }
  .app-bar { display: flex; align-items: center; justify-content: space-between; padding: 14px 22px; border-bottom: 1px solid var(--line); background: #fbfaf7; }
  .app-bar .name { font-weight: 650; }
  .app-bar .hintback { font-size: 13px; }
  .app-main { padding: 26px 22px 30px; min-height: 380px; }
  .view { display: none; }
  .view.active { display: block; }

  .list-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .list-head h2 { margin: 0; font: 600 20px var(--sans); }
  table { width: 100%; border-collapse: collapse; font-size: 14.5px; }
  th { text-align: left; color: var(--muted); font-weight: 600; font-size: 12.5px; text-transform: uppercase; letter-spacing: .05em; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  td { padding: 11px 10px; border-bottom: 1px solid var(--line); }
  .pill { font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); }

  form { max-width: 440px; display: grid; gap: 14px; }
  form h2 { margin: 0 0 2px; font: 600 20px var(--sans); }
  .field label { display: block; font-weight: 500; margin-bottom: 5px; }
  select { width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px; font: 14.5px var(--sans); background: #fff; }
  .form-actions { display: flex; gap: 10px; align-items: center; margin-top: 4px; }

  .done { max-width: 460px; text-align: center; margin: 40px auto; }
  .done .check { width: 54px; height: 54px; border-radius: 50%; background: var(--approve-soft); color: var(--approve); font-size: 26px; display: grid; place-items: center; margin: 0 auto 14px; }
  .done h2 { margin: 0 0 8px; font: 600 22px var(--sans); }
  .done p { color: var(--muted); margin: 0 0 20px; }

  .coach { margin-top: 22px; padding: 16px 20px; background: var(--accent-soft); border-radius: 12px; font-size: 14px; color: #24417e; }
  .coach strong { font-weight: 650; }
`;

export function practicePage() {
  const body = `
    <div class="coach"><strong>Practice run:</strong> click the SOPWizard icon, describe the task as “Create a new customer record”, press <strong>Start recording</strong>, then work through the app below. When you finish, press <strong>Stop &amp; generate SOP</strong>.</div>

    <div class="app">
      <div class="app-bar">
        <span class="name">Customer Records</span>
        <span class="hintback"><a href="/">← Back to SOPWizard</a></span>
      </div>
      <div class="app-main">

        <section class="view" id="view-customers">
          <div class="list-head">
            <h2>Customers</h2>
            <button type="button" id="new-customer" onclick="location.hash='#/new'">New customer</button>
          </div>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Account type</th></tr></thead>
            <tbody id="rows">
              <tr><td>Jordan Avery</td><td>jordan@example.com</td><td><span class="pill">Business</span></td></tr>
              <tr><td>Riley Chen</td><td>riley@example.com</td><td><span class="pill">Standard</span></td></tr>
              <tr><td>Sam Whitfield</td><td>sam@example.com</td><td><span class="pill">Enterprise</span></td></tr>
            </tbody>
          </table>
        </section>

        <section class="view" id="view-new">
          <form id="customer-form" aria-label="New customer">
            <h2>New customer</h2>
            <div class="field">
              <label for="full-name">Full name</label>
              <input id="full-name" name="fullName" required placeholder="First and last name" />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" name="email" type="email" required placeholder="name@company.com" />
            </div>
            <div class="field">
              <label for="phone">Phone</label>
              <input id="phone" name="phone" placeholder="(555) 000-0000" />
            </div>
            <div class="field">
              <label for="account-type">Account type</label>
              <select id="account-type" name="accountType">
                <option>Standard</option>
                <option>Business</option>
                <option>Enterprise</option>
              </select>
            </div>
            <div class="field">
              <label for="notes">Notes</label>
              <textarea id="notes" name="notes" placeholder="Anything the team should know"></textarea>
            </div>
            <div class="form-actions">
              <button type="submit">Save customer</button>
              <a class="btn ghost" href="#/customers">Cancel</a>
            </div>
          </form>
        </section>

        <section class="view" id="view-saved">
          <div class="done">
            <div class="check">✓</div>
            <h2>Customer saved</h2>
            <p>That whole flow — list, form, save — is exactly the kind of workflow SOPWizard turns into a procedure.</p>
            <button type="button" onclick="location.hash='#/customers'">Back to customers</button>
          </div>
        </section>

      </div>
    </div>
  `;

  const script = `
    const views = { '#/customers': 'view-customers', '#/new': 'view-new', '#/saved': 'view-saved' };
    function show() {
      const id = views[location.hash] || 'view-customers';
      for (const el of document.querySelectorAll('.view')) el.classList.toggle('active', el.id === id);
    }
    window.addEventListener('hashchange', show);
    if (!views[location.hash]) location.hash = '#/customers';
    show();

    document.getElementById('customer-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('full-name').value.trim() || 'New customer';
      const email = document.getElementById('email').value.trim() || '—';
      const type = document.getElementById('account-type').value;
      const row = document.createElement('tr');
      row.innerHTML = '<td></td><td></td><td><span class="pill"></span></td>';
      row.children[0].textContent = name;
      row.children[1].textContent = email;
      row.querySelector('.pill').textContent = type;
      document.getElementById('rows').appendChild(row);
      e.target.reset();
      location.hash = '#/saved';
    });
  `;

  return shell({ title: 'Practice — SOPWizard', body: `<div class="masthead"><span class="wordmark"><span class="dot"></span>SOPWizard</span><span>Practice environment</span></div>${body}`, extraCss: css, script });
}
