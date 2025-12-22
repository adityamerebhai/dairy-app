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
              if (res.status === 409) {
                // Entry exists, update it instead
                const updateRes = await fetch(`/api/milk-entries/customer/${customer._id}/date/${today}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ cow, buffalo }),
                });
                if (!updateRes.ok) throw new Error('Update failed');
              } else {
                throw new Error('Save failed');
              }
            }
            showToast('Milk entry saved!');
            cowInput.value = '';
            buffaloInput.value = '';
          } catch (err) {
            console.error(err);
            showToast('Could not save milk entry');
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

// Invoice page: Excel download + basic date label
if (document.body.dataset.page === 'invoice') {
  const invoicePrintBtn = document.getElementById('invoice-print-btn');
  const invoiceExcelBtn = document.getElementById('invoice-excel-btn');
  const generatedDateEl = document.getElementById('invoice-generated-date');

  if (generatedDateEl) {
    const now = new Date();
    generatedDateEl.textContent = now.toLocaleString();
  }

  function getCustomerIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('customerId');
  }

  const customerId = getCustomerIdFromQuery();

  if (invoicePrintBtn) {
    invoicePrintBtn.addEventListener('click', () => {
      window.print();
    });
  }

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
}
