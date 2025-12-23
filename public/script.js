// Use different API based on page type
const pageType = document.body.dataset.page || 'general';
const API_BASE = pageType === 'invoice' ? '/api/milk-entries' : '/api/items';

const form = document.getElementById('item-form');
const itemList = document.getElementById('item-list');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const toast = document.getElementById('toast');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('toast-visible');
  setTimeout(() => {
    toast.classList.remove('toast-visible');
  }, 2200);
}

function formatAmount(amount) {
  if (typeof amount !== 'number') return '';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildItemRow(item) {
  const li = document.createElement('li');
  li.className = 'item-row';
  li.dataset.id = item._id;

  const main = document.createElement('div');
  main.className = 'item-main';

  const title = document.createElement('div');
  title.className = 'item-title';
  title.textContent = item.title;

  const meta = document.createElement('div');
  meta.className = 'item-meta';

  const amountChip = document.createElement('span');
  amountChip.className = 'chip chip-amount';
  amountChip.textContent = formatAmount(item.amount);

  const typeChip = document.createElement('span');
  typeChip.className = 'chip chip-type';
  typeChip.textContent = item.type;

  const dateChip = document.createElement('span');
  dateChip.className = 'chip';
  dateChip.textContent = formatDate(item.createdAt);

  meta.appendChild(amountChip);
  meta.appendChild(typeChip);
  if (item.createdAt) {
    meta.appendChild(dateChip);
  }

  if (item.notes) {
    const notes = document.createElement('div');
    notes.style.fontSize = '0.78rem';
    notes.style.color = 'var(--text-muted)';
    notes.textContent = item.notes;
    main.appendChild(title);
    main.appendChild(notes);
  } else {
    main.appendChild(title);
  }

  main.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon-btn';
  deleteBtn.setAttribute('title', 'Delete');
  deleteBtn.textContent = '🗑';

  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`${API_BASE}/${item._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      li.remove();
      if (!itemList.children.length) {
        emptyState.style.display = 'block';
      }
      showToast('Item deleted');
    } catch (err) {
      console.error(err);
      showToast('Could not delete item');
    }
  });

  actions.appendChild(deleteBtn);

  li.appendChild(main);
  li.appendChild(actions);

  return li;
}

async function loadItems() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    const filtered = data.filter((i) => i.type === pageType || (pageType === 'general' && i.type === 'general'));

    itemList.innerHTML = '';
    if (!filtered.length) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    filtered.forEach((item) => {
      const row = buildItemRow(item);
      itemList.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    showToast('Could not load items');
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  const formData = new FormData(form);
  const payload = {
    title: formData.get('title')?.toString().trim(),
    amount: Number(formData.get('amount')),
    type: pageType,
    notes: formData.get('notes')?.toString().trim() || '',
  };

  if (!payload.title || Number.isNaN(payload.amount)) {
    showToast('Please fill in title and amount');
    return;
  }

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Create failed');
    form.reset();
    showToast('Saved!');
    await loadItems();
  } catch (err) {
    console.error(err);
    showToast('Could not save item');
  }
}

if (form) {
  form.addEventListener('submit', handleSubmit);
}

if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    loadItems();
  });
}

// Only try to load items on pages that have an item list
if (itemList) {
  loadItems();
}

// Dashboard page: Load stats and recent entries
if (document.body.dataset.page === 'dashboard') {
  const totalExtensionsEl = document.getElementById('total-extensions');
  const totalCustomersEl = document.getElementById('total-customers');
  const totalMilkEntriesEl = document.getElementById('total-milk-entries');
  const todayMilkEl = document.getElementById('today-milk');
  const recentEntriesList = document.getElementById('recent-entries-list');
  const refreshDashboardBtn = document.getElementById('refresh-dashboard-btn');

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function loadDashboardStats() {
    try {
      // Load all stats in parallel
      const [extensionsRes, customersRes, milkEntriesRes] = await Promise.all([
        fetch('/api/extensions'),
        fetch('/api/customers'),
        fetch('/api/milk-entries'),
      ]);

      if (!extensionsRes.ok || !customersRes.ok || !milkEntriesRes.ok) {
        throw new Error('Failed to load stats');
      }

      const extensions = await extensionsRes.json();
      const customers = await customersRes.json();
      const milkEntries = await milkEntriesRes.json();

      // Update stats
      totalExtensionsEl.textContent = extensions.length;
      totalCustomersEl.textContent = customers.length;
      totalMilkEntriesEl.textContent = milkEntries.length;

      // Calculate today's milk
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEntries = milkEntries.filter((entry) => {
        const entryDate = new Date(entry.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === today.getTime();
      });

      const todayTotal = todayEntries.reduce((sum, entry) => {
        return sum + (entry.cow || 0) + (entry.buffalo || 0);
      }, 0);

      todayMilkEl.textContent = todayTotal.toFixed(1);
    } catch (err) {
      console.error(err);
      totalExtensionsEl.textContent = '—';
      totalCustomersEl.textContent = '—';
      totalMilkEntriesEl.textContent = '—';
      todayMilkEl.textContent = '—';
    }
  }

  async function loadRecentEntries() {
    try {
      const res = await fetch('/api/milk-entries');
      if (!res.ok) throw new Error('Failed to load entries');

      const entries = await res.json();
      
      // Sort by date (most recent first) and take last 10
      const sorted = entries
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

      recentEntriesList.innerHTML = '';

      if (sorted.length === 0) {
        recentEntriesList.innerHTML = '<p class="empty-state">No milk entries yet.</p>';
        return;
      }

      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.marginTop = '0.5rem';

      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
          <th style="text-align: left; padding: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Date</th>
          <th style="text-align: left; padding: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Customer</th>
          <th style="text-align: right; padding: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Cow (L)</th>
          <th style="text-align: right; padding: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Buffalo (L)</th>
        </tr>
      `;

      const tbody = document.createElement('tbody');
      sorted.forEach((entry) => {
        // Customer data is populated from the API
        const customerName = entry.customerId?.name || entry.customerId?._id || 'Unknown';
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(148, 163, 184, 0.2)';
        row.innerHTML = `
          <td style="padding: 0.5rem; font-size: 0.9rem;">${formatDate(entry.date)}</td>
          <td style="padding: 0.5rem; font-size: 0.9rem;">${customerName}</td>
          <td style="padding: 0.5rem; text-align: right; font-size: 0.9rem;">${(entry.cow || 0).toFixed(1)}</td>
          <td style="padding: 0.5rem; text-align: right; font-size: 0.9rem;">${(entry.buffalo || 0).toFixed(1)}</td>
        `;
        tbody.appendChild(row);
      });

      table.appendChild(thead);
      table.appendChild(tbody);
      recentEntriesList.appendChild(table);
    } catch (err) {
      console.error(err);
      recentEntriesList.innerHTML = '<p class="empty-state">Error loading recent entries.</p>';
    }
  }

  async function loadDashboard() {
    await Promise.all([loadDashboardStats(), loadRecentEntries()]);
  }

  if (refreshDashboardBtn) {
    refreshDashboardBtn.addEventListener('click', () => {
      loadDashboard();
    });
  }

  // Initial load
  loadDashboard();
}

// Extension page: Load extensions, customers, handle modals
if (document.body.dataset.page === 'extension') {
  const extensionNameInput = document.getElementById('extension-name-input');
  const addExtensionBtn = document.getElementById('add-extension-btn');
  const extensionSelect = document.getElementById('extension-select');
  const refreshCustomersBtn = document.getElementById('refresh-customers-btn');
  const addCustomerBtn = document.getElementById('add-customer-btn');
  const customerModal = document.getElementById('customer-modal-backdrop');
  const customerForm = document.getElementById('customer-form');
  const customerCancelBtn = document.getElementById('customer-cancel-btn');
  const customerList = document.getElementById('customer-list');
  const noExtensionSelected = document.getElementById('no-extension-selected');

  let currentExtensionId = null;

  // Load extensions into dropdown
  async function loadExtensions() {
    try {
      const res = await fetch('/api/extensions');
      if (!res.ok) throw new Error('Failed to fetch extensions');
      const extensions = await res.json();
      
      extensionSelect.innerHTML = '<option value="">-- Select Extension --</option>';
      extensions.forEach((ext) => {
        const option = document.createElement('option');
        option.value = ext._id;
        option.textContent = ext.name;
        extensionSelect.appendChild(option);
      });
    } catch (err) {
      console.error(err);
      showToast('Could not load extensions');
    }
  }

  // Load customers for selected extension
  async function loadCustomers() {
    if (!currentExtensionId) {
      customerList.innerHTML = '';
      noExtensionSelected.style.display = 'block';
      noExtensionSelected.textContent = 'Select an extension to see its customers.';
      return;
    }

    try {
      const res = await fetch(`/api/customers/extension/${currentExtensionId}`);
      if (!res.ok) throw new Error('Failed to fetch customers');
      const customers = await res.json();

      customerList.innerHTML = '';
      if (customers.length === 0) {
        noExtensionSelected.textContent = 'No customers in this extension.';
        noExtensionSelected.style.display = 'block';
        return;
      }
      noExtensionSelected.style.display = 'none';

      customers.forEach((customer) => {
        const li = document.createElement('li');
        li.className = 'item-row';
        li.dataset.customerId = customer._id;

        const main = document.createElement('div');
        main.className = 'item-main';
        main.style.display = 'flex';
        main.style.flexDirection = 'column';
        main.style.gap = '0.5rem';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'item-title';
        nameDiv.textContent = customer.name || 'Unnamed Customer';

        const inputsDiv = document.createElement('div');
        inputsDiv.style.display = 'flex';
        inputsDiv.style.gap = '0.5rem';
        inputsDiv.style.alignItems = 'center';
        inputsDiv.style.flexWrap = 'wrap';

        const cowLabel = document.createElement('label');
        cowLabel.textContent = 'Cow:';
        cowLabel.style.fontSize = '0.8rem';
        const cowInput = document.createElement('input');
        cowInput.type = 'number';
        cowInput.min = '0';
        cowInput.step = '0.1';
        cowInput.placeholder = '0';
        cowInput.style.width = '80px';
        cowInput.style.padding = '0.4rem';

        const buffaloLabel = document.createElement('label');
        buffaloLabel.textContent = 'Buffalo:';
        buffaloLabel.style.fontSize = '0.8rem';
        const buffaloInput = document.createElement('input');
        buffaloInput.type = 'number';
        buffaloInput.min = '0';
        buffaloInput.step = '0.1';
        buffaloInput.placeholder = '0';
        buffaloInput.style.width = '80px';
        buffaloInput.style.padding = '0.4rem';

        inputsDiv.appendChild(cowLabel);
        inputsDiv.appendChild(cowInput);
        inputsDiv.appendChild(buffaloLabel);
        inputsDiv.appendChild(buffaloInput);

        main.appendChild(nameDiv);
        main.appendChild(inputsDiv);

        const actions = document.createElement('div');
        actions.className = 'item-actions';
        actions.style.display = 'flex';
        actions.style.flexDirection = 'row';
        actions.style.gap = '0.25rem';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn primary-btn';
        saveBtn.textContent = 'Save';
        saveBtn.style.fontSize = '0.75rem';
        saveBtn.style.padding = '0.4rem 0.8rem';
        saveBtn.addEventListener('click', async () => {
          const cow = parseFloat(cowInput.value) || 0;
          const buffalo = parseFloat(buffaloInput.value) || 0;
          const today = new Date().toISOString().split('T')[0];

          try {
            const res = await fetch(`/api/milk-entries/customer/${customer._id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: today, cow, buffalo }),
            });
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(errorData.error || 'Save failed');
            }
            // Backend returns 201 for create, 200 for update
            const isUpdate = res.status === 200;
            showToast(isUpdate ? 'Milk entry updated!' : 'Milk entry saved!');
            cowInput.value = '';
            buffaloInput.value = '';
          } catch (err) {
            console.error(err);
            showToast(err.message || 'Could not save milk entry');
          }
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'btn ghost-btn';
        editBtn.textContent = 'Edit';
        editBtn.style.fontSize = '0.75rem';
        editBtn.style.padding = '0.4rem 0.8rem';
        editBtn.addEventListener('click', () => {
          document.getElementById('customer-id').value = customer._id;
          document.getElementById('customer-name').value = customer.name || '';
          document.getElementById('customer-phone').value = customer.phone || '';
          document.getElementById('customer-address').value = customer.address || '';
          document.getElementById('customer-modal-title').textContent = 'Edit Customer';
          customerModal.style.display = 'flex';
        });

        const invoiceBtn = document.createElement('button');
        invoiceBtn.className = 'btn ghost-btn';
        invoiceBtn.textContent = 'Invoice';
        invoiceBtn.style.fontSize = '0.75rem';
        invoiceBtn.style.padding = '0.4rem 0.8rem';
        invoiceBtn.addEventListener('click', () => {
          window.location.href = `invoice.html?customerId=${customer._id}`;
        });

        actions.appendChild(saveBtn);
        actions.appendChild(editBtn);
        actions.appendChild(invoiceBtn);

        li.appendChild(main);
        li.appendChild(actions);
        customerList.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      showToast('Could not load customers');
    }
  }

  // Add Extension button
  if (addExtensionBtn) {
    addExtensionBtn.addEventListener('click', async () => {
      const name = extensionNameInput?.value?.trim();
      if (!name) {
        showToast('Please enter extension name');
        return;
      }

      try {
        const res = await fetch('/api/extensions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error('Create failed');
        extensionNameInput.value = '';
        showToast('Extension added!');
        await loadExtensions();
        // Auto-select the newly added extension
        const extensions = await fetch('/api/extensions').then(r => r.json());
        const newExt = extensions.find(e => e.name === name);
        if (newExt) {
          extensionSelect.value = newExt._id;
          currentExtensionId = newExt._id;
          loadCustomers();
        }
      } catch (err) {
        console.error(err);
        showToast('Could not add extension');
      }
    });
  }

  // Extension select change handler
  if (extensionSelect) {
    extensionSelect.addEventListener('change', (e) => {
      currentExtensionId = e.target.value || null;
      loadCustomers();
    });
  }

  // Refresh customers button
  if (refreshCustomersBtn) {
    refreshCustomersBtn.addEventListener('click', () => {
      loadCustomers();
    });
  }

  // Add Customer button
  if (addCustomerBtn) {
    addCustomerBtn.addEventListener('click', () => {
      if (!currentExtensionId) {
        showToast('Please select an extension first');
        return;
      }
      customerForm.reset();
      document.getElementById('customer-id').value = '';
      document.getElementById('customer-modal-title').textContent = 'Add Customer';
      customerModal.style.display = 'flex';
    });
  }

  // Customer form submit
  if (customerForm) {
    customerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(customerForm);
      const customerId = formData.get('customerId');
      const name = formData.get('name')?.toString().trim();
      const phone = formData.get('phone')?.toString().trim();
      const address = formData.get('address')?.toString().trim();

      if (!name) {
        showToast('Please enter customer name');
        return;
      }

      try {
        if (customerId) {
          // Update existing customer
          const res = await fetch(`/api/customers/${customerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, address, extensionId: currentExtensionId }),
          });
          if (!res.ok) throw new Error('Update failed');
          showToast('Customer updated!');
        } else {
          // Create new customer
          const res = await fetch(`/api/customers/extension/${currentExtensionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, address }),
          });
          if (!res.ok) throw new Error('Create failed');
          showToast('Customer added!');
        }
        customerModal.style.display = 'none';
        customerForm.reset();
        await loadCustomers();
      } catch (err) {
        console.error(err);
        showToast('Could not save customer');
      }
    });
  }

  // Customer modal cancel
  if (customerCancelBtn) {
    customerCancelBtn.addEventListener('click', () => {
      customerModal.style.display = 'none';
      customerForm.reset();
    });
  }

  // Close modal on backdrop click
  if (customerModal) {
    customerModal.addEventListener('click', (e) => {
      if (e.target === customerModal) {
        customerModal.style.display = 'none';
        customerForm.reset();
      }
    });
  }

  // Allow Enter key to add extension
  if (extensionNameInput) {
    extensionNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addExtensionBtn?.click();
      }
    });
  }

  // Initial load
  loadExtensions();
}

// Invoice page: Load customer details and all milk entries
if (document.body.dataset.page === 'invoice') {
  const invoicePrintBtn = document.getElementById('invoice-print-btn');
  const invoiceExcelBtn = document.getElementById('invoice-excel-btn');
  const generatedDateEl = document.getElementById('invoice-generated-date');
  const invoiceRows = document.getElementById('invoice-rows');
  const invoiceTotalCow = document.getElementById('invoice-total-cow');
  const invoiceTotalBuffalo = document.getElementById('invoice-total-buffalo');
  const invoiceCustomerName = document.getElementById('invoice-customer-name');
  const invoiceCustomerPhone = document.getElementById('invoice-customer-phone');
  const invoiceCustomerAddress = document.getElementById('invoice-customer-address');

  function getCustomerIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('customerId');
  }

  const customerId = getCustomerIdFromQuery();

  // Format date for display
  function formatDateForInvoice(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Load customer details
  async function loadCustomerDetails() {
    if (!customerId) {
      invoiceCustomerName.textContent = 'No customer selected';
      return;
    }

    try {
      const res = await fetch(`/api/customers/${customerId}`);
      if (!res.ok) throw new Error('Failed to fetch customer');
      const customer = await res.json();

      invoiceCustomerName.textContent = customer.name || '—';
      invoiceCustomerPhone.textContent = customer.phone || '—';
      invoiceCustomerAddress.textContent = customer.address || '—';
    } catch (err) {
      console.error(err);
      invoiceCustomerName.textContent = 'Error loading customer';
    }
  }

  // Load all milk entries for customer
  async function loadMilkEntries() {
    if (!customerId) {
      invoiceRows.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">No customer selected</td></tr>';
      return;
    }

    try {
      const res = await fetch(`/api/milk-entries/customer/${customerId}`);
      if (!res.ok) throw new Error('Failed to fetch milk entries');
      const entries = await res.json();

      console.log('Loaded milk entries:', entries.length, entries);

      invoiceRows.innerHTML = '';

      if (entries.length === 0) {
        invoiceRows.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">No milk entries found</td></tr>';
        invoiceTotalCow.textContent = '0';
        invoiceTotalBuffalo.textContent = '0';
        return;
      }

      let totalCow = 0;
      let totalBuffalo = 0;

      // Sort entries by date to ensure chronological order
      const sortedEntries = [...entries].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      });

      sortedEntries.forEach((entry) => {
        const cow = entry.cow || 0;
        const buffalo = entry.buffalo || 0;
        totalCow += cow;
        totalBuffalo += buffalo;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${formatDateForInvoice(entry.date)}</td>
          <td>${cow.toFixed(1)}</td>
          <td>${buffalo.toFixed(1)}</td>
        `;
        invoiceRows.appendChild(row);
      });

      // Update totals
      invoiceTotalCow.textContent = totalCow.toFixed(1);
      invoiceTotalBuffalo.textContent = totalBuffalo.toFixed(1);
    } catch (err) {
      console.error('Error loading milk entries:', err);
      invoiceRows.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--danger);">Error loading milk entries</td></tr>';
    }
  }

  // Set generated date
  if (generatedDateEl) {
    const now = new Date();
    generatedDateEl.textContent = now.toLocaleString();
  }

  // Print button
  if (invoicePrintBtn) {
    invoicePrintBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Excel download button
  if (invoiceExcelBtn) {
    invoiceExcelBtn.addEventListener('click', () => {
      if (!customerId) {
        alert('No customer selected for invoice.');
        return;
      }
      const url = `/api/milk-entries/customer/${customerId}/excel`;
      window.location.href = url;
    });
  }

  // Load data on page load
  loadCustomerDetails();
  loadMilkEntries();
}
