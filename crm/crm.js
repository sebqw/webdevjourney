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

    // ---------- Phone cards ----------

    const cardsEl = $('#cards');

    function riskPillFor(c) {
        const pill = el('span', 'pill pill--' + c.risk);
        pill.append(el('i', 'dot dot--' + c.risk), document.createTextNode(RISKS[c.risk]));
        return pill;
    }

    function buildCard(c) {
        const li = el('li');
        const btn = el('button', 'client-card');
        btn.type = 'button';
        btn.dataset.id = c.id;
        btn.setAttribute('aria-label', 'Edit ' + fullName(c) + ', ' + c.company);

        const avatar = el('span', 'avatar avatar--' + c.risk, c.firstName[0] + c.lastName[0]);
        avatar.setAttribute('aria-hidden', 'true');

        const top = el('span', 'card-top');
        const names = el('span', 'names');
        names.append(el('strong', null, fullName(c)), el('span', 'muted', c.email));
        top.append(avatar, names);

        const meta = el('span', 'card-meta');
        meta.append(el('span', 'card-company', c.company), el('span', 'mono muted', c.mobile));

        const foot = el('span', 'card-foot');
        foot.append(riskPillFor(c), el('span', 'pill pill--' + c.status, STATUSES[c.status]),
            el('span', 'card-updated muted', relativeDate(c.updated)));

        btn.append(top, meta, foot);
        li.append(btn);
        return li;
    }

    // ---------- Render ----------

    function render() {
        const list = clients.filter(matches).sort(function (a, b) {
            const x = sortValue(a), y = sortValue(b);
            return (x < y ? -1 : x > y ? 1 : 0) * view.dir;
        });

        rowsEl.replaceChildren();
        cardsEl.replaceChildren();
        list.forEach(function (c) {
            cardsEl.append(buildCard(c));
        });
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
        cardsEl.hidden = list.length === 0;
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
        $('#clear-form').hidden = !!client;
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

    // Any UK phone number: mobiles and landlines, written as 0..., +44... or
    // 44..., and 10-digit numbers where Excel has dropped the leading 0
    // (which is how every number in the agency's spreadsheet is stored).
    function normalisePhone(value) {
        let d = String(value).replace(/[\s().-]/g, '');
        if (/^\+44\d{10}$/.test(d)) d = '0' + d.slice(3);
        else if (/^44\d{10}$/.test(d)) d = '0' + d.slice(2);
        else if (/^[1-9]\d{9}$/.test(d)) d = '0' + d;
        if (!/^0[1-9]\d{9}$/.test(d)) return null;
        // Group digits the way UK numbers are usually written
        if (d[1] === '2') return d.slice(0, 3) + ' ' + d.slice(3, 7) + ' ' + d.slice(7);   // 020 7946 0123
        if (/^01\d1|^011|^0[389]/.test(d)) return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7); // 0116 496 0123, 0800 123 4567
        return d.slice(0, 5) + ' ' + d.slice(5);                                             // 07700 900123, 01536 123456
    }

    // The same rules apply to the form and to imported spreadsheets.
    // takenEmails holds emails already in use by other clients.
    function checkClient(raw, takenEmails) {
        const data = {
            firstName: String(raw.firstName || '').trim(),
            lastName: String(raw.lastName || '').trim(),
            email: String(raw.email || '').trim().toLowerCase(),
            mobile: String(raw.mobile || '').trim(),
            company: String(raw.company || '').trim(),
            risk: String(raw.risk || '').trim().toLowerCase(),
            status: String(raw.status || '').trim().toLowerCase()
        };
        const errors = {};

        if (!data.firstName) errors.firstName = 'Enter a first name.';
        if (!data.lastName) errors.lastName = 'Enter a last name.';
        if (!data.company) errors.company = 'Enter the company name.';

        if (!data.email) {
            errors.email = 'Enter an email address.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.email = 'That doesn\'t look like an email address.';
        } else if (takenEmails.has(data.email)) {
            errors.email = 'Another client already uses this email.';
        }

        const phone = normalisePhone(data.mobile);
        if (!data.mobile) {
            errors.mobile = 'Enter a phone number.';
        } else if (!phone) {
            errors.mobile = 'Use a UK number, e.g. 07700 900123 or 0116 496 0123.';
        } else {
            data.mobile = phone;
        }

        if (!RISKS[data.risk]) errors.risk = 'Risk must be Green, Orange or Red.';
        if (!STATUSES[data.status]) errors.status = 'Status must be Active or Inactive.';

        return { data: data, errors: errors };
    }

    function validate() {
        const taken = new Set(clients.filter(function (c) { return c !== editing; })
            .map(function (c) { return c.email; }));
        return checkClient({
            firstName: field('firstName').value,
            lastName: field('lastName').value,
            email: field('email').value,
            mobile: field('mobile').value,
            company: field('company').value,
            risk: field('risk').value,
            status: field('status').value
        }, taken);
    }

    function clearErrors() {
        form.querySelectorAll('.error').forEach(function (p) { p.textContent = ''; });
        form.querySelectorAll('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
    }

    function showErrors(errors) {
        clearErrors();
        Object.keys(errors).forEach(function (k) {
            if (!$('#e-' + k)) return;
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

    cardsEl.addEventListener('click', function (e) {
        const card = e.target.closest('.client-card');
        if (card) openRow(card);
    });

    $('#add-client').addEventListener('click', function () { openDialog(null); });

    // Clear wipes the add-client form without closing it
    $('#clear-form').addEventListener('click', function () {
        form.reset();
        clearErrors();
        if (window.matchMedia('(pointer: fine)').matches) field('firstName').focus();
    });

    // ---------- Import a spreadsheet ----------
    //
    // Accepts the agency's original Excel sheet (one row per client) or the
    // three-table version from my database design (ClientName, ClientInfo,
    // ClientActivity joined on client_id). CSV files work too.

    // ----- A small .xlsx reader -----
    // An .xlsx file is a zip of XML files. The browser can unzip it natively
    // (DecompressionStream), so no third-party library is needed.

    async function unzip(buffer) {
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);
        const decoder = new TextDecoder();

        // Find the zip's table of contents (it sits at the end of the file)
        let end = -1;
        for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 66000); i--) {
            if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
        }
        if (end < 0) throw new Error('Not a zip file');

        const files = {};
        let p = view.getUint32(end + 16, true);
        const count = view.getUint16(end + 10, true);
        for (let n = 0; n < count; n++) {
            if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Bad zip entry');
            const method = view.getUint16(p + 10, true);
            const size = view.getUint32(p + 20, true);
            const nameLen = view.getUint16(p + 28, true);
            const extraLen = view.getUint16(p + 30, true);
            const commentLen = view.getUint16(p + 32, true);
            const local = view.getUint32(p + 42, true);
            const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
            const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
            files[name] = { method: method, data: bytes.subarray(start, start + size) };
            p += 46 + nameLen + extraLen + commentLen;
        }

        return async function read(name) {
            const f = files[name];
            if (!f) return null;
            if (f.method === 0) return decoder.decode(f.data);
            if (f.method !== 8) throw new Error('Unsupported compression');
            const stream = new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            return new Response(stream).text();
        };
    }

    function xml(text) {
        return new DOMParser().parseFromString(text, 'application/xml');
    }

    function columnIndex(ref) {
        let n = 0;
        for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64;
        return n - 1;
    }

    // Turns each sheet into a list of rows keyed by the first row's headings
    async function readXlsx(buffer) {
        const read = await unzip(buffer);
        const shared = [];
        const ss = await read('xl/sharedStrings.xml');
        if (ss) {
            Array.from(xml(ss).getElementsByTagName('si')).forEach(function (si) {
                shared.push(Array.from(si.getElementsByTagName('t')).map(function (t) { return t.textContent; }).join(''));
            });
        }

        const rels = {};
        Array.from(xml(await read('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship')).forEach(function (r) {
            const target = r.getAttribute('Target').replace(/^\/?(xl\/)?/, '');
            rels[r.getAttribute('Id')] = 'xl/' + target;
        });

        const sheets = Array.from(xml(await read('xl/workbook.xml')).getElementsByTagName('sheet'));
        const result = [];
        for (const sheet of sheets) {
            const text = await read(rels[sheet.getAttribute('r:id')]);
            if (!text) continue;
            const grid = Array.from(xml(text).getElementsByTagName('row')).map(function (row) {
                const cells = [];
                Array.from(row.getElementsByTagName('c')).forEach(function (c) {
                    const type = c.getAttribute('t');
                    const v = c.getElementsByTagName('v')[0];
                    let value = '';
                    if (type === 's' && v) value = shared[+v.textContent];
                    else if (type === 'inlineStr') value = Array.from(c.getElementsByTagName('t')).map(function (t) { return t.textContent; }).join('');
                    else if (v) value = v.textContent;
                    // Excel can store long numbers as 7.624716204E9
                    if (type !== 's' && type !== 'inlineStr' && type !== 'str' && /e/i.test(value) && !isNaN(value)) {
                        value = String(Number(value));
                    }
                    cells[columnIndex(c.getAttribute('r'))] = value;
                });
                return cells;
            });
            result.push(gridToRows(grid));
        }
        return result;
    }

    function gridToRows(grid) {
        if (!grid.length) return [];
        const headings = Array.from(grid[0], function (h) { return String(h || '').trim(); });
        return grid.slice(1).map(function (cells) {
            const row = {};
            headings.forEach(function (h, i) { if (h) row[h] = cells[i] == null ? '' : cells[i]; });
            return row;
        }).filter(function (row) {
            return Object.values(row).some(function (v) { return String(v).trim() !== ''; });
        });
    }

    // Handles quoted values, commas inside quotes and Windows line endings
    function readCsv(text) {
        const grid = [];
        let row = [], cell = '', quoted = false;
        text = text.replace(/^﻿/, '');
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (quoted) {
                if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
                else if (ch === '"') quoted = false;
                else cell += ch;
            } else if (ch === '"') quoted = true;
            else if (ch === ',') { row.push(cell); cell = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row.push(cell); grid.push(row); row = []; cell = '';
            } else cell += ch;
        }
        if (cell !== '' || row.length) { row.push(cell); grid.push(row); }
        return [gridToRows(grid)];
    }

    // Column headings people actually use, mapped to the CRM's fields
    const HEADINGS = {
        clientid: 'id', id: 'id',
        firstname: 'firstName', forename: 'firstName', first: 'firstName',
        lastname: 'lastName', surname: 'lastName', last: 'lastName',
        email: 'email', emailaddress: 'email',
        contact: 'mobile', mobile: 'mobile', phone: 'mobile', telephone: 'mobile',
        phonenumber: 'mobile', contactnumber: 'mobile', mobilenumber: 'mobile',
        company: 'company', companyname: 'company',
        risk: 'risk', status: 'status'
    };

    function tidyRow(row) {
        const out = {};
        Object.keys(row).forEach(function (key) {
            const name = HEADINGS[key.toLowerCase().replace(/[^a-z]/g, '')];
            if (name) out[name] = row[key];
        });
        return out;
    }

    // Rows that share a client_id across sheets are one client
    function mergeSheets(sheets) {
        const byId = new Map();
        const plain = [];
        sheets.forEach(function (rows) {
            rows.forEach(function (row) {
                const r = tidyRow(row);
                if (!Object.keys(r).length) return;
                if (r.id !== undefined && String(r.id).trim() !== '') {
                    const key = String(r.id).trim();
                    byId.set(key, Object.assign(byId.get(key) || {}, r));
                } else {
                    plain.push(r);
                }
            });
        });
        return Array.from(byId.values()).concat(plain);
    }

    function importRows(rows) {
        const before = clients.slice();
        const taken = new Set(clients.map(function (c) { return c.email; }));
        const now = new Date().toISOString();
        let nextId = clients.reduce(function (max, c) { return Math.max(max, c.id); }, 0) + 1;
        let added = 0, duplicates = 0, invalid = 0;
        const problems = [];

        rows.forEach(function (raw, i) {
            const result = checkClient(raw, taken);
            const keys = Object.keys(result.errors);
            if (keys.length === 1 && keys[0] === 'email' && taken.has(result.data.email)) {
                duplicates++;
                return;
            }
            if (keys.length) {
                invalid++;
                if (problems.length < 5) problems.push('Row ' + (i + 2) + ': ' + result.errors[keys[0]]);
                return;
            }
            taken.add(result.data.email);
            clients.push(Object.assign({
                id: nextId++, created: now, updated: now,
                notes: [{ at: now, text: 'Imported from spreadsheet.' }]
            }, result.data));
            added++;
        });

        save();
        render();

        let message = 'Imported ' + added.toLocaleString('en-GB') + ' client' + (added === 1 ? '' : 's');
        const skipped = [];
        if (duplicates) skipped.push(duplicates + ' already in the CRM');
        if (invalid) skipped.push(invalid + ' with problems');
        if (skipped.length) message += '. Skipped ' + skipped.join(' and ');
        if (problems.length) console.info('Import problems:\n' + problems.join('\n'));

        toast(message + '.', added ? function () {
            clients = before;
            save();
            render();
            toast('Import undone');
        } : null);
    }

    const importBtn = $('#import-btn');
    const importFile = $('#import-file');

    importBtn.addEventListener('click', function () { importFile.click(); });

    importFile.addEventListener('change', function () {
        const file = importFile.files[0];
        importFile.value = ''; // lets the same file be picked again
        if (!file) return;

        importBtn.disabled = true;
        importBtn.textContent = 'Importing...';
        const isCsv = /\.csv$/i.test(file.name);
        (isCsv ? file.text().then(readCsv) : file.arrayBuffer().then(readXlsx))
            .then(function (sheets) {
                const rows = mergeSheets(sheets);
                if (!rows.length) {
                    toast('No clients found. Check the file has headings like first_name, email and company.');
                    return;
                }
                importRows(rows);
            })
            .catch(function () {
                toast('That file couldn\'t be read. Use an Excel (.xlsx) or CSV file.');
            })
            .then(function () {
                importBtn.disabled = false;
                importBtn.textContent = 'Import spreadsheet';
            });
    });

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
