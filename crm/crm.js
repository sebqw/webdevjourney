// FOV CRM 2.0
// A browser rebuild of my apprenticeship Windows Forms app.
//
// The original kept people and companies in two unlinked Access tables
// and built search queries by gluing user input into SQL. Here each client
// is one record, every value is validated before it's saved, and nothing
// the user types is ever turned into code or HTML (text goes in with
// textContent only).
(function () {
    'use strict';

    const STORE_KEY = 'fovcrm.v2';
    const RISKS = { green: 'Green', orange: 'Orange', red: 'Red' };
    const STATUSES = { active: 'Active', inactive: 'Inactive' };
    const RISK_ORDER = { green: 0, orange: 1, red: 2 };

    // ---------- Demo data (all fictional; phone numbers are Ofcom's drama range) ----------

    function daysAgo(n) {
        return new Date(Date.now() - n * 86400000).toISOString();
    }

    function demoClients() {
        const rows = [
            ['Amelia', 'Hart', 'Brightwater Logistics', 'green', 'active', 1, 'Signed up for the spring hiring campaign.'],
            ['Oliver', 'Bennett', 'Kestrel Engineering', 'orange', 'active', 3, 'Invoice 30 days overdue. Chased by email.'],
            ['Priya', 'Shah', 'Lumen Dental Group', 'green', 'active', 4, 'Looking for two receptionists.'],
            ['Jack', 'Morrison', 'Ironbridge Construction', 'red', 'active', 6, 'Disputed last placement fee.'],
            ['Chloe', 'Evans', 'Willow & Pine Interiors', 'green', 'inactive', 12, 'Paused hiring until next quarter.'],
            ['Daniel', 'Okafor', 'Northgate Finance', 'orange', 'active', 8, 'New HR contact. Needs onboarding call.'],
            ['Grace', 'Thompson', 'Harbour View Hotels', 'green', 'active', 2, 'Seasonal staff request for summer.'],
            ['Ethan', 'Clarke', 'Copperleaf Software', 'green', 'active', 10, 'Happy with last two placements.'],
            ['Sofia', 'Rossi', 'Meridian Care Homes', 'red', 'inactive', 21, 'Contract ended. Outstanding balance.'],
            ['Liam', 'Walsh', 'Fieldstone Farms', 'orange', 'inactive', 30, 'No reply to last three calls.'],
            ['Hannah', 'Price', 'Silverline Retail', 'green', 'active', 5, 'Wants weekly candidate updates.'],
            ['Noah', 'Ahmed', 'Bluebell Nurseries', 'green', 'active', 15, 'Referred us to a partner nursery.']
        ];

        return rows.map(function (r, i) {
            const domain = r[2].toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, '') + '.example';
            return {
                id: i + 1,
                firstName: r[0],
                lastName: r[1],
                email: (r[0][0] + '.' + r[1]).toLowerCase() + '@' + domain,
                mobile: '07700 900' + String(100 + i * 37).padStart(3, '0'),
                company: r[2],
                risk: r[3],
                status: r[4],
                created: daysAgo(r[5] + 40),
                updated: daysAgo(r[5]),
                notes: [{ at: daysAgo(r[5]), text: r[6] }]
            };
        });
    }

    // ---------- Storage ----------

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORE_KEY));
            if (Array.isArray(saved)) return saved;
        } catch (e) {}
        return demoClients();
    }

    function save() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(clients)); } catch (e) {}
    }

    let clients = load();

    // ---------- View state ----------

    const view = { query: '', risk: 'all', status: 'all', sort: 'updated', dir: -1 };

    const $ = function (sel) { return document.querySelector(sel); };
    const rowsEl = $('#rows');

    function fullName(c) {
        return c.firstName + ' ' + c.lastName;
    }

    function matches(c) {
        if (view.risk !== 'all' && c.risk !== view.risk) return false;
        if (view.status !== 'all' && c.status !== view.status) return false;
        if (!view.query) return true;

        // Plain text matching: the search box can't break anything
        const q = view.query.toLowerCase();
        const digits = q.replace(/\D/g, '');
        return [fullName(c), c.email, c.company].some(function (v) {
            return v.toLowerCase().includes(q);
        }) || (digits.length > 2 && c.mobile.replace(/\D/g, '').includes(digits));
    }

    function sortValue(c) {
        switch (view.sort) {
            case 'name': return (c.lastName + ' ' + c.firstName).toLowerCase();
            case 'company': return c.company.toLowerCase();
            case 'mobile': return c.mobile.replace(/\D/g, '');
            case 'risk': return RISK_ORDER[c.risk];
            case 'status': return c.status;
            default: return c.updated;
        }
    }

    function relativeDate(iso) {
        const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
        if (days <= 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return days + ' days ago';
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    // Small helper that builds elements safely from text
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    // ---------- Render ----------

    function render() {
        const list = clients.filter(matches).sort(function (a, b) {
            const x = sortValue(a), y = sortValue(b);
            return (x < y ? -1 : x > y ? 1 : 0) * view.dir;
        });

        rowsEl.replaceChildren();
        list.forEach(function (c) {
            const tr = el('tr');
            tr.tabIndex = 0;
            tr.dataset.id = c.id;
            tr.setAttribute('aria-label', 'Edit ' + fullName(c) + ', ' + c.company);

            const who = el('td', 'cell-client');
            who.dataset.label = 'Client';
            const avatar = el('span', 'avatar avatar--' + c.risk, c.firstName[0] + c.lastName[0]);
            avatar.setAttribute('aria-hidden', 'true');
            const names = el('span', 'names');
            names.append(el('strong', null, fullName(c)), el('span', 'muted', c.email));
            who.append(avatar, names);

            const company = el('td', null, c.company);
            company.dataset.label = 'Company';

            const mobile = el('td', 'mono', c.mobile);
            mobile.dataset.label = 'Mobile';

            const risk = el('td');
            risk.dataset.label = 'Risk';
            const riskPill = el('span', 'pill pill--' + c.risk);
            riskPill.append(el('i', 'dot dot--' + c.risk), document.createTextNode(RISKS[c.risk]));
            risk.append(riskPill);

            const status = el('td');
            status.dataset.label = 'Status';
            status.append(el('span', 'pill pill--' + c.status, STATUSES[c.status]));

            const updated = el('td', 'muted', relativeDate(c.updated));
            updated.dataset.label = 'Updated';

            tr.append(who, company, mobile, risk, status, updated);
            rowsEl.append(tr);
        });

        $('#empty').hidden = list.length > 0;
        $('.clients').hidden = list.length === 0;
        $('#result-count').textContent = list.length === clients.length
            ? clients.length + ' clients'
            : 'Showing ' + list.length + ' of ' + clients.length + ' clients';

        $('#stat-total').textContent = clients.length;
        $('#stat-active').textContent = clients.filter(function (c) { return c.status === 'active'; }).length;
        $('#stat-inactive').textContent = clients.filter(function (c) { return c.status === 'inactive'; }).length;
        $('#stat-red').textContent = clients.filter(function (c) { return c.risk === 'red'; }).length;

        document.querySelectorAll('[data-sort]').forEach(function (btn) {
            const th = btn.parentElement;
            if (btn.dataset.sort === view.sort) {
                th.setAttribute('aria-sort', view.dir === 1 ? 'ascending' : 'descending');
            } else {
                th.removeAttribute('aria-sort');
            }
        });
    }

    // ---------- Search, filters, sorting ----------

    $('#search').addEventListener('input', function (e) {
        view.query = e.target.value.trim();
        render();
    });

    function setFilter(group, value) {
        view[group] = value;
        document.querySelectorAll('[data-filter="' + group + '"] button').forEach(function (b) {
            b.setAttribute('aria-pressed', b.dataset.value === value);
        });
    }

    document.querySelectorAll('[data-filter]').forEach(function (group) {
        group.addEventListener('click', function (e) {
            const btn = e.target.closest('button');
            if (!btn) return;
            setFilter(group.dataset.filter, btn.dataset.value);
            render();
        });
    });

    $('#clear-filters').addEventListener('click', function () {
        $('#search').value = '';
        view.query = '';
        setFilter('risk', 'all');
        setFilter('status', 'all');
        render();
    });

    document.querySelectorAll('[data-sort]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (view.sort === btn.dataset.sort) {
                view.dir *= -1;
            } else {
                view.sort = btn.dataset.sort;
                view.dir = btn.dataset.sort === 'updated' ? -1 : 1;
            }
            render();
        });
    });

    // ---------- Add / edit dialog ----------

    const dialog = $('#client-dialog');
    const form = $('#client-form');
    let editing = null; // the client being edited, or null when adding

    function field(name) {
        return form.elements[name];
    }

    function openDialog(client) {
        editing = client || null;
        form.reset();
        clearErrors();

        $('#dialog-title').textContent = client ? fullName(client) : 'Add client';
        $('#save-client').textContent = client ? 'Save changes' : 'Add client';
        $('#delete-client').hidden = !client;
        $('#history').hidden = !client;

        if (client) {
            ['firstName', 'lastName', 'email', 'mobile', 'company'].forEach(function (k) {
                field(k).value = client[k];
            });
            field('risk').value = client.risk;
            field('status').value = client.status;
            renderNotes();
        }

        dialog.showModal();
        // On phones, focusing a field pops the keyboard up over the form,
        // so only jump to the first field when there's a mouse or trackpad.
        if (window.matchMedia('(pointer: fine)').matches) {
            field('firstName').focus();
        }
    }

    function closeDialog() {
        dialog.close();
        editing = null;
    }

    function renderNotes() {
        const list = $('#notes');
        list.replaceChildren();
        editing.notes.slice().reverse().forEach(function (n) {
            const li = el('li');
            li.append(el('p', null, n.text), el('time', 'muted', new Date(n.at).toLocaleString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            })));
            list.append(li);
        });
    }

    // ---------- Validation ----------

    // UK mobile: 07xxx xxxxxx or +44 7xxx xxxxxx
    function normaliseMobile(value) {
        const digits = value.replace(/[\s()-]/g, '');
        const m = digits.match(/^(?:\+44|0)(7\d{9})$/);
        if (!m) return null;
        const n = '0' + m[1];
        return n.slice(0, 5) + ' ' + n.slice(5);
    }

    function validate() {
        const data = {
            firstName: field('firstName').value.trim(),
            lastName: field('lastName').value.trim(),
            email: field('email').value.trim().toLowerCase(),
            mobile: field('mobile').value.trim(),
            company: field('company').value.trim(),
            risk: field('risk').value,
            status: field('status').value
        };
        const errors = {};

        if (!data.firstName) errors.firstName = 'Enter a first name.';
        if (!data.lastName) errors.lastName = 'Enter a last name.';
        if (!data.company) errors.company = 'Enter the company name.';

        if (!data.email) {
            errors.email = 'Enter an email address.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.email = 'That doesn\'t look like an email address.';
        } else if (clients.some(function (c) { return c.email === data.email && c !== editing; })) {
            errors.email = 'Another client already uses this email.';
        }

        const mobile = normaliseMobile(data.mobile);
        if (!data.mobile) {
            errors.mobile = 'Enter a mobile number.';
        } else if (!mobile) {
            errors.mobile = 'Use a UK mobile, e.g. 07700 900123.';
        } else {
            data.mobile = mobile;
        }

        if (!RISKS[data.risk]) data.risk = 'green';
        if (!STATUSES[data.status]) data.status = 'active';

        return { data: data, errors: errors };
    }

    function clearErrors() {
        form.querySelectorAll('.error').forEach(function (p) { p.textContent = ''; });
        form.querySelectorAll('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
    }

    function showErrors(errors) {
        clearErrors();
        Object.keys(errors).forEach(function (k) {
            $('#e-' + k).textContent = errors[k];
            field(k).setAttribute('aria-invalid', 'true');
            field(k).setAttribute('aria-describedby', 'e-' + k);
        });
        const first = Object.keys(errors)[0];
        if (first) field(first).focus();
    }

    // ---------- Save, delete, notes ----------

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const result = validate();
        if (Object.keys(result.errors).length) {
            showErrors(result.errors);
            return;
        }

        const data = result.data;
        const now = new Date().toISOString();

        if (editing) {
            // Log the changes that matter to the account manager
            if (editing.risk !== data.risk) {
                editing.notes.push({ at: now, text: 'Risk changed from ' + RISKS[editing.risk] + ' to ' + RISKS[data.risk] + '.' });
            }
            if (editing.status !== data.status) {
                editing.notes.push({ at: now, text: 'Marked as ' + STATUSES[data.status].toLowerCase() + '.' });
            }
            Object.assign(editing, data, { updated: now });
            toast(fullName(editing) + ' updated');
        } else {
            const id = clients.reduce(function (max, c) { return Math.max(max, c.id); }, 0) + 1;
            const client = Object.assign({ id: id, created: now, updated: now, notes: [{ at: now, text: 'Client added.' }] }, data);
            clients.push(client);
            toast(fullName(client) + ' added');
        }

        save();
        closeDialog();
        render();
    });

    $('#delete-client').addEventListener('click', function () {
        const client = editing;
        const index = clients.indexOf(client);
        if (!window.confirm('Delete ' + fullName(client) + ' (' + client.company + ')?')) return;

        clients.splice(index, 1);
        save();
        closeDialog();
        render();
        toast(fullName(client) + ' deleted', function () {
            clients.splice(index, 0, client);
            save();
            render();
            toast(fullName(client) + ' restored');
        });
    });

    function addNote() {
        const input = $('#f-note');
        const text = input.value.trim();
        if (!text || !editing) return;
        const now = new Date().toISOString();
        editing.notes.push({ at: now, text: text });
        editing.updated = now;
        input.value = '';
        save();
        renderNotes();
        render();
    }

    $('#add-note').addEventListener('click', addNote);
    $('#f-note').addEventListener('keydown', function (e) {
        // Enter adds the note rather than submitting the whole form
        if (e.key === 'Enter') {
            e.preventDefault();
            addNote();
        }
    });

    // Digits, spaces and + only in the mobile field (as the original did)
    field('mobile').addEventListener('input', function (e) {
        const cleaned = e.target.value.replace(/[^\d\s+]/g, '');
        if (cleaned !== e.target.value) e.target.value = cleaned;
    });

    dialog.querySelectorAll('[data-close]').forEach(function (b) {
        b.addEventListener('click', closeDialog);
    });
    // Click on the dimmed backdrop closes the dialog
    dialog.addEventListener('click', function (e) {
        if (e.target === dialog) closeDialog();
    });

    // ---------- Opening rows ----------

    function openRow(tr) {
        const client = clients.find(function (c) { return String(c.id) === tr.dataset.id; });
        if (client) openDialog(client);
    }

    rowsEl.addEventListener('click', function (e) {
        const tr = e.target.closest('tr');
        if (tr) openRow(tr);
    });
    rowsEl.addEventListener('keydown', function (e) {
        const tr = e.target.closest('tr');
        if (tr && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            openRow(tr);
        }
    });

    $('#add-client').addEventListener('click', function () { openDialog(null); });

    // ---------- Export and reset ----------

    $('#export-csv').addEventListener('click', function () {
        const cols = ['id', 'firstName', 'lastName', 'email', 'mobile', 'company', 'risk', 'status', 'created', 'updated'];
        const quote = function (v) {
            let s = String(v);
            // Stop spreadsheet apps treating a value as a formula
            if (/^[=+\-@]/.test(s)) s = "'" + s;
            return '"' + s.replace(/"/g, '""') + '"';
        };
        const csv = [cols.join(',')].concat(clients.filter(matches).map(function (c) {
            return cols.map(function (k) { return quote(c[k]); }).join(',');
        })).join('\r\n');

        const link = el('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = 'fov-crm-clients.csv';
        document.body.append(link);
        link.click();
        link.remove();
        // Safari needs a moment to read the file before it's released
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    });

    $('#reset-demo').addEventListener('click', function () {
        if (!window.confirm('Reset to the demo clients? Your changes will be lost.')) return;
        clients = demoClients();
        save();
        render();
        toast('Demo data restored');
    });

    // ---------- Toast with optional undo ----------

    let toastTimer;

    function toast(text, undo) {
        const box = $('#toast');
        const btn = $('#toast-undo');
        $('#toast-text').textContent = text;
        btn.hidden = !undo;
        btn.onclick = undo ? function () { box.hidden = true; undo(); } : null;
        box.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { box.hidden = true; }, undo ? 6000 : 3000);
    }

    // Keyboard shortcut: "/" jumps to search
    document.addEventListener('keydown', function (e) {
        if (e.key === '/' && !dialog.open && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            $('#search').focus();
        }
    });

    render();
})();
