'use strict';

(function () {
  const STORAGE_KEY = 'a2academy-mini-manager-v1';

  const GROUPS = ['17–30', '30+', 'Rodičia BA', 'Rodičia TN'];

  const STATUSES = {
    pending: 'Čaká',
    accepted: 'Prijatý',
    rejected: 'Zamietnutý'
  };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Fiktívne testovacie údaje (domény example.com/example.org sú rezervované na testovanie)
  const SAMPLE_DATA = [
    ['Jana Kováčová', 'jana.kovacova@example.com', 'Bratislava', '17–30', 'accepted'],
    ['Peter Horváth', 'peter.horvath@example.com', 'Trnava', '30+', 'pending'],
    ['Lucia Novotná', 'lucia.novotna@example.org', 'Trenčín', 'Rodičia TN', 'accepted'],
    ['Martin Baláž', 'martin.balaz@example.com', 'Nitra', '17–30', 'rejected'],
    ['Zuzana Šimková', 'zuzana.simkova@example.org', 'Bratislava', 'Rodičia BA', 'pending'],
    ['Tomáš Varga', 'tomas.varga@example.com', 'Žilina', '30+', 'accepted'],
    ['Katarína Molnárová', 'katarina.molnarova@example.com', 'Košice', '17–30', 'pending'],
    ['Michal Tóth', 'michal.toth@example.org', 'Bratislava', 'Rodičia BA', 'accepted'],
    ['Simona Krajčírová', 'simona.krajcirova@example.com', 'Trenčín', 'Rodičia TN', 'rejected'],
    ['Andrej Lukáč', 'andrej.lukac@example.com', 'Banská Bystrica', '30+', 'pending'],
    ['Eva Poláková', 'eva.polakova@example.org', 'Pezinok', 'Rodičia BA', 'accepted'],
    ['Jakub Gajdoš', 'jakub.gajdos@example.com', 'Prešov', '17–30', 'accepted'],
    ['Monika Hudáková', 'monika.hudakova@example.com', 'Nové Mesto nad Váhom', 'Rodičia TN', 'pending'],
    ['Roman Ďurica', 'roman.durica@example.org', 'Senec', '30+', 'rejected'],
    ['Barbora Kollárová', 'barbora.kollarova@example.com', 'Bratislava', '17–30', 'pending'],
    ['Juraj Fekete', 'juraj.fekete@example.com', 'Dubnica nad Váhom', 'Rodičia TN', 'accepted'],
    ['Veronika Čierna', 'veronika.cierna@example.org', 'Malacky', 'Rodičia BA', 'pending'],
    ['Filip Mikuš', 'filip.mikus@example.com', 'Martin', '30+', 'accepted'],
    ['Natália Ševčíková', 'natalia.sevcikova@example.com', 'Bratislava', '17–30', 'rejected'],
    ['Ľubomír Straka', 'lubomir.straka@example.org', 'Trenčín', 'Rodičia TN', 'pending']
  ];

  // ---------- Stav aplikácie ----------
  let participants = [];
  let editingId = null;
  let storageAvailable = true;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const el = {
    statTotal: $('statTotal'),
    statAccepted: $('statAccepted'),
    statPending: $('statPending'),
    statRejected: $('statRejected'),
    form: $('participantForm'),
    formCard: $('participantForm').closest('.card'),
    formTitle: $('formTitle'),
    fName: $('fName'),
    fEmail: $('fEmail'),
    fCity: $('fCity'),
    fGroup: $('fGroup'),
    fStatus: $('fStatus'),
    formError: $('formError'),
    submitBtn: $('submitBtn'),
    cancelEditBtn: $('cancelEditBtn'),
    searchInput: $('searchInput'),
    groupFilter: $('groupFilter'),
    statusFilter: $('statusFilter'),
    tableBody: $('tableBody'),
    emptyState: $('emptyState'),
    resultCount: $('resultCount'),
    exportBtn: $('exportBtn'),
    resetBtn: $('resetBtn'),
    toast: $('toast')
  };

  // ---------- Pomocné funkcie ----------
  function generateId() {
    let id;
    do {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        id = window.crypto.randomUUID();
      } else {
        id = 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      }
    } while (participants.some((p) => p.id === id));
    return id;
  }

  function normalizeEmail(email) {
    return String(email).trim().toLowerCase();
  }

  function normalizeText(text) {
    return String(text).trim().replace(/\s+/g, ' ');
  }

  // Porovnávanie bez ohľadu na veľkosť písmen a diakritiku (napr. „simkova“ nájde „Šimková“)
  function searchKey(text) {
    return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function createSampleParticipants() {
    participants = [];
    SAMPLE_DATA.forEach(([name, email, city, group, status]) => {
      participants.push({ id: generateId(), name, email, city, group, status });
    });
    return participants;
  }

  function isValidParticipant(p) {
    return p && typeof p === 'object' &&
      typeof p.id === 'string' && p.id !== '' &&
      typeof p.name === 'string' && p.name.trim() !== '' &&
      typeof p.email === 'string' && EMAIL_PATTERN.test(p.email) &&
      typeof p.city === 'string' && p.city.trim() !== '' &&
      GROUPS.includes(p.group) &&
      Object.prototype.hasOwnProperty.call(STATUSES, p.status);
  }

  // ---------- localStorage ----------
  function loadData() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      storageAvailable = false;
    }

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Odfiltruje poškodené záznamy, duplicitné ID a duplicitné e-maily
          const ids = new Set();
          const emails = new Set();
          participants = parsed.filter((p) => {
            if (!isValidParticipant(p)) return false;
            const key = normalizeEmail(p.email);
            if (ids.has(p.id) || emails.has(key)) return false;
            ids.add(p.id);
            emails.add(key);
            return true;
          }).map((p) => ({
            id: p.id, name: p.name, email: p.email, city: p.city, group: p.group, status: p.status
          }));
          return;
        }
      } catch (e) {
        // Poškodené údaje – použijú sa testovacie údaje
      }
    }

    createSampleParticipants();
    saveData();
  }

  function saveData() {
    if (!storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(participants));
    } catch (e) {
      storageAvailable = false;
      showToast('Zmeny sa nepodarilo uložiť do prehliadača.');
    }
  }

  // ---------- Filtrovanie ----------
  function getFilteredParticipants() {
    const query = searchKey(el.searchInput.value.trim());
    const group = el.groupFilter.value;
    const status = el.statusFilter.value;

    return participants.filter((p) => {
      if (group && p.group !== group) return false;
      if (status && p.status !== status) return false;
      if (query && !searchKey(p.name).includes(query) && !searchKey(p.email).includes(query)) return false;
      return true;
    });
  }

  // ---------- Vykreslenie ----------
  function fillSelect(select, options) {
    options.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
  }

  function renderStats() {
    const count = (status) => participants.filter((p) => p.status === status).length;
    el.statTotal.textContent = participants.length;
    el.statAccepted.textContent = count('accepted');
    el.statPending.textContent = count('pending');
    el.statRejected.textContent = count('rejected');
  }

  function createCell(text, label, className) {
    const td = document.createElement('td');
    td.textContent = text;
    td.dataset.label = label;
    if (className) td.className = className;
    return td;
  }

  function createRow(p) {
    const tr = document.createElement('tr');
    tr.dataset.id = p.id;

    tr.appendChild(createCell(p.name, 'Meno', 'name'));
    tr.appendChild(createCell(p.email, 'E-mail', 'email'));
    tr.appendChild(createCell(p.city, 'Mesto'));

    const groupTd = createCell('', 'Skupina');
    const badge = document.createElement('span');
    badge.className = 'group-badge';
    badge.textContent = p.group;
    groupTd.appendChild(badge);
    tr.appendChild(groupTd);

    const statusTd = createCell('', 'Stav');
    const statusSelect = document.createElement('select');
    statusSelect.className = 'status-select s-' + p.status;
    statusSelect.setAttribute('aria-label', 'Stav účastníka ' + p.name);
    statusSelect.dataset.action = 'status';
    fillSelect(statusSelect, Object.entries(STATUSES));
    statusSelect.value = p.status;
    statusTd.appendChild(statusSelect);
    tr.appendChild(statusTd);

    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-secondary btn-small';
    editBtn.textContent = 'Upraviť';
    editBtn.dataset.action = 'edit';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-small';
    deleteBtn.textContent = 'Zmazať';
    deleteBtn.dataset.action = 'delete';

    actionsTd.append(editBtn, deleteBtn);
    tr.appendChild(actionsTd);

    return tr;
  }

  function renderTable() {
    const filtered = getFilteredParticipants();
    const fragment = document.createDocumentFragment();
    filtered.forEach((p) => fragment.appendChild(createRow(p)));
    el.tableBody.replaceChildren(fragment);

    el.emptyState.hidden = filtered.length > 0;
    el.resultCount.textContent = 'Zobrazené: ' + filtered.length + ' z ' + participants.length;
  }

  function render() {
    renderStats();
    renderTable();
  }

  let toastTimer = null;
  function showToast(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2600);
  }

  // ---------- Formulár ----------
  function showFormError(message, fields) {
    el.formError.textContent = message;
    el.formError.hidden = false;
    fields.forEach((f) => f.classList.add('invalid'));
    if (fields[0]) fields[0].focus();
  }

  function clearFormError() {
    el.formError.hidden = true;
    el.formError.textContent = '';
    [el.fName, el.fEmail, el.fCity, el.fGroup, el.fStatus].forEach((f) => f.classList.remove('invalid'));
  }

  function resetForm() {
    editingId = null;
    el.form.reset();
    el.fStatus.value = 'pending';
    clearFormError();
    el.formTitle.textContent = 'Pridať účastníka';
    el.submitBtn.textContent = 'Pridať účastníka';
    el.cancelEditBtn.hidden = true;
    el.formCard.classList.remove('editing');
  }

  function startEdit(id) {
    const p = participants.find((x) => x.id === id);
    if (!p) return;
    clearFormError();
    editingId = id;
    el.fName.value = p.name;
    el.fEmail.value = p.email;
    el.fCity.value = p.city;
    el.fGroup.value = p.group;
    el.fStatus.value = p.status;
    el.formTitle.textContent = 'Upraviť účastníka';
    el.submitBtn.textContent = 'Uložiť zmeny';
    el.cancelEditBtn.hidden = false;
    el.formCard.classList.add('editing');
    el.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.fName.focus({ preventScroll: true });
  }

  function handleSubmit(event) {
    event.preventDefault();
    clearFormError();

    const data = {
      name: normalizeText(el.fName.value),
      email: el.fEmail.value.trim(),
      city: normalizeText(el.fCity.value),
      group: el.fGroup.value,
      status: el.fStatus.value
    };

    const missing = [];
    if (!data.name) missing.push(el.fName);
    if (!data.email) missing.push(el.fEmail);
    if (!data.city) missing.push(el.fCity);
    if (!GROUPS.includes(data.group)) missing.push(el.fGroup);
    if (!Object.prototype.hasOwnProperty.call(STATUSES, data.status)) missing.push(el.fStatus);

    if (missing.length) {
      showFormError('Vyplňte všetky povinné polia.', missing);
      return;
    }

    if (!EMAIL_PATTERN.test(data.email)) {
      showFormError('Zadajte platnú e-mailovú adresu.', [el.fEmail]);
      return;
    }

    const emailKey = normalizeEmail(data.email);
    const duplicate = participants.find((p) => normalizeEmail(p.email) === emailKey && p.id !== editingId);
    if (duplicate) {
      showFormError('Účastník s týmto e-mailom už existuje.', [el.fEmail]);
      return;
    }

    if (editingId) {
      const p = participants.find((x) => x.id === editingId);
      if (!p) {
        resetForm();
        showToast('Upravovaný účastník už neexistuje.');
        return;
      }
      Object.assign(p, data);
      showToast('Zmeny boli uložené.');
    } else {
      participants.push(Object.assign({ id: generateId() }, data));
      showToast('Účastník bol pridaný.');
    }

    saveData();
    resetForm();
    render();
  }

  // ---------- Akcie v tabuľke ----------
  function handleTableClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.closest('tr').dataset.id;

    if (button.dataset.action === 'edit') {
      startEdit(id);
    } else if (button.dataset.action === 'delete') {
      const p = participants.find((x) => x.id === id);
      if (!p) return;
      if (!window.confirm('Naozaj chcete zmazať účastníka „' + p.name + '“?')) return;
      participants = participants.filter((x) => x.id !== id);
      if (editingId === id) resetForm();
      saveData();
      render();
      showToast('Účastník bol zmazaný.');
    }
  }

  function handleTableChange(event) {
    const select = event.target;
    if (select.dataset.action !== 'status') return;
    const id = select.closest('tr').dataset.id;
    const p = participants.find((x) => x.id === id);
    if (!p || !Object.prototype.hasOwnProperty.call(STATUSES, select.value)) return;
    p.status = select.value;
    if (editingId === id) el.fStatus.value = p.status;
    saveData();
    render();
    showToast('Stav bol zmenený na „' + STATUSES[p.status] + '“.');
  }

  // ---------- CSV export ----------
  function csvValue(value) {
    let text = String(value);
    // Ochrana pred interpretáciou hodnoty ako vzorca v Exceli
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    const rows = getFilteredParticipants();
    if (rows.length === 0) {
      showToast('Nie je čo exportovať – zoznam je prázdny.');
      return;
    }

    const header = ['ID', 'Meno', 'E-mail', 'Mesto', 'Skupina', 'Stav'];
    const lines = [header.map(csvValue).join(';')];
    rows.forEach((p) => {
      lines.push([p.id, p.name, p.email, p.city, p.group, STATUSES[p.status]].map(csvValue).join(';'));
    });

    // BOM (﻿) zabezpečí správne zobrazenie diakritiky v Exceli,
    // bodkočiarka je predvolený oddeľovač v slovenských nastaveniach Excelu.
    const csv = '﻿' + lines.join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const date = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fileName = 'ucastnici-' + date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + '.csv';

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast('Exportovaných záznamov: ' + rows.length);
  }

  // ---------- Obnovenie testovacích údajov ----------
  function resetSampleData() {
    const ok = window.confirm(
      'Obnoviť testovacie údaje?\n\nVšetky vaše zmeny (pridaní, upravení aj zmazaní účastníci) budú nenávratne vymazané.'
    );
    if (!ok) return;
    createSampleParticipants();
    saveData();
    resetForm();
    el.searchInput.value = '';
    el.groupFilter.value = '';
    el.statusFilter.value = '';
    render();
    showToast('Testovacie údaje boli obnovené.');
  }

  // ---------- Inicializácia ----------
  function init() {
    const groupOptions = GROUPS.map((g) => [g, g]);
    fillSelect(el.fGroup, groupOptions);
    fillSelect(el.groupFilter, groupOptions);
    fillSelect(el.fStatus, Object.entries(STATUSES));
    fillSelect(el.statusFilter, Object.entries(STATUSES));
    el.fStatus.value = 'pending';

    loadData();

    el.form.addEventListener('submit', handleSubmit);
    el.cancelEditBtn.addEventListener('click', resetForm);
    el.tableBody.addEventListener('click', handleTableClick);
    el.tableBody.addEventListener('change', handleTableChange);
    el.searchInput.addEventListener('input', renderTable);
    el.groupFilter.addEventListener('change', renderTable);
    el.statusFilter.addEventListener('change', renderTable);
    el.exportBtn.addEventListener('click', exportCsv);
    el.resetBtn.addEventListener('click', resetSampleData);

    if (!storageAvailable) {
      showToast('Prehliadač neumožňuje ukladanie – zmeny sa po zatvorení stratia.');
    }

    render();
  }

  init();
})();
