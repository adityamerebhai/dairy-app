// Use different API based on page type
const pageType = document.body.dataset.page || 'general';
const API_BASE = pageType === 'invoice' ? '/api/milk-entries' : '/api/items';

const form = document.getElementById('item-form');
const itemList = document.getElementById('item-list');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const toast = document.getElementById('toast');

function showToast(message, type = 'success') {
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast';
  if (type === 'error') {
    toast.style.borderColor = 'rgba(185, 28, 28, 0.8)';
    toast.style.background = 'radial-gradient(circle at top left, rgba(185, 28, 28, 0.1), #fef2f2)';
    toast.style.color = '#991b1b';
  } else {
    toast.style.borderColor = 'rgba(34, 197, 94, 0.8)';
    toast.style.background = 'radial-gradient(circle at top left, var(--accent-soft), #ecfdf3)';
    toast.style.color = '#14532d';
  }
  toast.classList.add('toast-visible');
  setTimeout(() => {
    toast.classList.remove('toast-visible');
  }, 3000);
}

// Helper function to show loading state on button
function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = '<span class="loading-spinner"></span> Loading...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

// Helper function to show/hide modal with animation
function showModal(modal) {
  if (!modal) return;
  modal.style.display = 'flex';
  // Force reflow to trigger animation
  void modal.offsetWidth;
  modal.style.opacity = '1';
}

function hideModal(modal) {
  if (!modal) return;
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
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
  const dailySalesList = document.getElementById('daily-sales-list');
  const refreshSalesBtn = document.getElementById('refresh-sales-btn');

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

  // Products Management
  const productNameInput = document.getElementById('product-name');
  const productCostInput = document.getElementById('product-cost');
  const addProductBtn = document.getElementById('add-product-btn');
  const productsList = document.getElementById('products-list');

  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      const products = await res.json();

      productsList.innerHTML = '';

      if (products.length === 0) {
        productsList.innerHTML = '<p class="empty-state">No products yet. Add your first product above.</p>';
        return;
      }

      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.marginTop = '0.5rem';

      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
          <th style="text-align: left; padding: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Product Name</th>
          <th style="text-align: right; padding: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Cost</th>
          <th style="text-align: center; padding: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Actions</th>
        </tr>
      `;

      const tbody = document.createElement('tbody');
      products.forEach((product) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(148, 163, 184, 0.2)';
        row.innerHTML = `
          <td style="padding: 0.5rem; font-size: 0.9rem;">${product.name}</td>
          <td style="padding: 0.5rem; text-align: right; font-size: 0.9rem;">₹${(product.cost || 0).toFixed(2)}</td>
          <td style="padding: 0.5rem; text-align: center;">
            <button class="btn ghost-btn delete-product-btn" data-product-id="${product._id}" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">Delete</button>
          </td>
        `;
        tbody.appendChild(row);
      });

      table.appendChild(thead);
      table.appendChild(tbody);
      productsList.appendChild(table);

      // Add delete event listeners
      document.querySelectorAll('.delete-product-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const productId = btn.dataset.productId;
          if (!confirm('Delete this product?')) return;

          try {
            const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            showToast('Product deleted');
            loadProducts();
          } catch (err) {
            console.error(err);
            showToast('Could not delete product');
          }
        });
      });
    } catch (err) {
      console.error(err);
      productsList.innerHTML = '<p class="empty-state">Error loading products.</p>';
    }
  }

  if (addProductBtn) {
    addProductBtn.addEventListener('click', async () => {
      const name = productNameInput?.value?.trim();
      const cost = parseFloat(productCostInput?.value);

      if (!name) {
        showToast('Please enter product name');
        return;
      }

      if (isNaN(cost) || cost < 0) {
        showToast('Please enter a valid cost');
        return;
      }

      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, cost }),
        });
        if (!res.ok) throw new Error('Create failed');
        productNameInput.value = '';
        productCostInput.value = '';
        showToast('Product added!');
        loadProducts();
      } catch (err) {
        console.error(err);
        showToast('Could not add product');
      }
    });
  }

  // Allow Enter key to add product
  if (productNameInput && productCostInput) {
    [productNameInput, productCostInput].forEach((input) => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addProductBtn?.click();
        }
      });
    });
  }

  // Milk Prices Management
  const cowPriceInput = document.getElementById('cow-price');
  const buffaloPriceInput = document.getElementById('buffalo-price');
  const editMilkPricesBtn = document.getElementById('edit-milk-prices-btn');
  const saveMilkPricesBtn = document.getElementById('save-milk-prices-btn');
  const cancelMilkPricesBtn = document.getElementById('cancel-milk-prices-btn');

  let originalPrices = { cowPrice: 0, buffaloPrice: 0 };

  async function loadMilkPrices() {
    try {
      const res = await fetch('/api/milk-prices');
      if (res.ok) {
        const prices = await res.json();
        originalPrices = { cowPrice: prices.cowPrice || 0, buffaloPrice: prices.buffaloPrice || 0 };
        if (cowPriceInput) cowPriceInput.value = prices.cowPrice || '';
        if (buffaloPriceInput) buffaloPriceInput.value = prices.buffaloPrice || '';
      }
    } catch (err) {
      console.error('Failed to load milk prices:', err);
    }
  }

  function enableEditMode() {
    if (cowPriceInput) cowPriceInput.disabled = false;
    if (buffaloPriceInput) buffaloPriceInput.disabled = false;
    if (editMilkPricesBtn) editMilkPricesBtn.style.display = 'none';
    if (saveMilkPricesBtn) saveMilkPricesBtn.style.display = 'block';
    if (cancelMilkPricesBtn) cancelMilkPricesBtn.style.display = 'block';
  }

  function disableEditMode() {
    if (cowPriceInput) cowPriceInput.disabled = true;
    if (buffaloPriceInput) buffaloPriceInput.disabled = true;
    if (editMilkPricesBtn) editMilkPricesBtn.style.display = 'block';
    if (saveMilkPricesBtn) saveMilkPricesBtn.style.display = 'none';
    if (cancelMilkPricesBtn) cancelMilkPricesBtn.style.display = 'none';
  }

  function restoreOriginalPrices() {
    if (cowPriceInput) cowPriceInput.value = originalPrices.cowPrice || '';
    if (buffaloPriceInput) buffaloPriceInput.value = originalPrices.buffaloPrice || '';
  }

  // Edit button
  if (editMilkPricesBtn) {
    editMilkPricesBtn.addEventListener('click', () => {
      enableEditMode();
    });
  }

  // Cancel button
  if (cancelMilkPricesBtn) {
    cancelMilkPricesBtn.addEventListener('click', () => {
      restoreOriginalPrices();
      disableEditMode();
    });
  }

  // Save button
  if (saveMilkPricesBtn) {
    saveMilkPricesBtn.addEventListener('click', async () => {
      const cowPrice = parseFloat(cowPriceInput?.value);
      const buffaloPrice = parseFloat(buffaloPriceInput?.value);

      if (isNaN(cowPrice) || cowPrice < 0) {
        showToast('Please enter a valid cow milk price');
        return;
      }

      if (isNaN(buffaloPrice) || buffaloPrice < 0) {
        showToast('Please enter a valid buffalo milk price');
        return;
      }

      try {
        const res = await fetch('/api/milk-prices', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cowPrice, buffaloPrice }),
        });
        if (!res.ok) throw new Error('Save failed');
        originalPrices = { cowPrice, buffaloPrice };
        showToast('Milk prices saved!');
        disableEditMode();
      } catch (err) {
        console.error(err);
        showToast('Could not save milk prices');
      }
    });
  }

  // Load daily sales
  async function loadDailySales() {
    try {
      const res = await fetch('/api/milk-entries/stats/daily-sales');
      if (!res.ok) throw new Error('Failed to load daily sales');

      const dailySales = await res.json();
      if (!dailySalesList) return;
      
      dailySalesList.innerHTML = '';

      if (dailySales.length === 0) {
        dailySalesList.innerHTML = '<p class="empty-state">No sales data available yet.</p>';
        return;
      }

      // Create table
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.marginTop = '0.5rem';

      // Table header
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr style="border-bottom: 2px solid var(--border-subtle);">
          <th style="text-align: left; padding: 0.75rem 0.5rem; font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Date</th>
          <th style="text-align: right; padding: 0.75rem 0.5rem; font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Cow (L)</th>
          <th style="text-align: right; padding: 0.75rem 0.5rem; font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Buffalo (L)</th>
          <th style="text-align: right; padding: 0.75rem 0.5rem; font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Cow Amount</th>
          <th style="text-align: right; padding: 0.75rem 0.5rem; font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Buffalo Amount</th>
          <th style="text-align: right; padding: 0.75rem 0.5rem; font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Product Amount</th>
          <th style="text-align: right; padding: 0.75rem 0.5rem; font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Total Sales</th>
        </tr>
      `;
      table.appendChild(thead);

      // Table body
      const tbody = document.createElement('tbody');
      dailySales.forEach((sale) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-subtle)';
        row.style.transition = 'background-color 0.2s ease';
        
        const date = new Date(sale.date);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        row.innerHTML = `
          <td style="padding: 0.75rem 0.5rem; font-size: 0.9rem; font-weight: 500;">${formattedDate}</td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; font-size: 0.9rem;">${sale.cowLiters.toFixed(1)}</td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; font-size: 0.9rem;">${sale.buffaloLiters.toFixed(1)}</td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; font-size: 0.9rem; color: var(--text-muted);">₹${sale.cowAmount.toFixed(2)}</td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; font-size: 0.9rem; color: var(--text-muted);">₹${sale.buffaloAmount.toFixed(2)}</td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; font-size: 0.9rem; color: var(--text-muted);">₹${sale.productAmount.toFixed(2)}</td>
          <td style="padding: 0.75rem 0.5rem; text-align: right; font-size: 0.9rem; font-weight: 600; color: var(--accent);">₹${sale.totalAmount.toFixed(2)}</td>
        `;

        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = 'var(--accent-soft)';
        });
        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = 'transparent';
        });

        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      dailySalesList.appendChild(table);
    } catch (err) {
      console.error('Error loading daily sales:', err);
      if (dailySalesList) {
        dailySalesList.innerHTML = '<p class="empty-state">Error loading daily sales.</p>';
      }
    }
  }

  // Refresh sales button
  if (refreshSalesBtn) {
    refreshSalesBtn.addEventListener('click', () => {
      loadDailySales();
    });
  }

  // Initial load
  loadDashboard();
  loadProducts();
  loadMilkPrices().then(() => {
    // Ensure edit mode is disabled on initial load
    disableEditMode();
  });
  loadDailySales();
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
  let allProducts = []; // Cache products

  // Load all products once
  async function loadAllProducts() {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        allProducts = await res.json();
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      allProducts = [];
    }
  }

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

      // Get today's date for fetching milk entries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString().split('T')[0];

      // Fetch today's milk entries for all customers in parallel
      const milkEntriesPromises = customers.map(async (customer) => {
        try {
          const entriesRes = await fetch(`/api/milk-entries/customer/${customer._id}`);
          if (entriesRes.ok) {
            const entries = await entriesRes.json();
            // Find today's entry or most recent entry
            const todayEntry = entries.find((e) => {
              const entryDate = new Date(e.date);
              entryDate.setHours(0, 0, 0, 0);
              return entryDate.getTime() === today.getTime();
            });
            // If no today's entry, get the most recent one
            const mostRecent = entries.length > 0 
              ? entries.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
              : null;
            return { customerId: customer._id, entry: todayEntry || mostRecent };
          }
        } catch (err) {
          console.error(`Failed to fetch milk entries for customer ${customer._id}:`, err);
        }
        return { customerId: customer._id, entry: null };
      });

      const milkEntriesMap = {};
      const milkEntriesResults = await Promise.all(milkEntriesPromises);
      milkEntriesResults.forEach(({ customerId, entry }) => {
        milkEntriesMap[customerId] = entry;
      });

      customers.forEach((customer) => {
        const todayEntry = milkEntriesMap[customer._id];
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
        // Pre-populate with today's entry or most recent entry
        if (todayEntry) {
          // Show the actual value even if it's 0
          cowInput.value = todayEntry.cow !== undefined && todayEntry.cow !== null ? todayEntry.cow : '';
        }

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
        // Pre-populate with today's entry or most recent entry
        if (todayEntry) {
          // Show the actual value even if it's 0
          buffaloInput.value = todayEntry.buffalo !== undefined && todayEntry.buffalo !== null ? todayEntry.buffalo : '';
        }

        const productLabel = document.createElement('label');
        productLabel.textContent = 'Product:';
        productLabel.style.fontSize = '0.8rem';
        const productSelect = document.createElement('select');
        productSelect.style.width = '140px';
        productSelect.style.minWidth = '140px';
        productSelect.className = 'product-select';
        productSelect.innerHTML = '<option value="">-- Select --</option>';
        productSelect.dataset.customerId = customer._id;

        // Populate products dropdown from cached products
        allProducts.forEach((product) => {
          const option = document.createElement('option');
          option.value = product._id;
          option.textContent = `${product.name} (₹${product.cost.toFixed(2)})`;
          productSelect.appendChild(option);
        });

        // Pre-populate product dropdown with today's entry product if exists
        if (todayEntry && todayEntry.products && todayEntry.products.length > 0) {
          const existingProduct = todayEntry.products[0];
          if (existingProduct.productId) {
            productSelect.value = existingProduct.productId;
          }
        }

        inputsDiv.appendChild(cowLabel);
        inputsDiv.appendChild(cowInput);
        inputsDiv.appendChild(buffaloLabel);
        inputsDiv.appendChild(buffaloInput);
        inputsDiv.appendChild(productLabel);
        inputsDiv.appendChild(productSelect);

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
          const productId = productSelect.value || null;
          const today = new Date().toISOString().split('T')[0];

          console.log('Saving milk entry:', { customerId: customer._id, date: today, cow, buffalo, productId });

          try {
            const res = await fetch(`/api/milk-entries/customer/${customer._id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: today, cow, buffalo, productId }),
            });
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              throw new Error(errorData.error || 'Save failed');
            }
            // Backend returns 201 for create, 200 for update
            const isUpdate = res.status === 200;
            showToast(isUpdate ? 'Milk entry updated!' : 'Milk entry saved!');
            // Don't clear the values - keep them visible so user can see what was saved
            // The values will be preserved and can be updated if needed
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
          showModal(customerModal);
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
      showModal(customerModal);
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
        hideModal(customerModal);
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
      hideModal(customerModal);
      customerForm.reset();
    });
  }

  // Close modal on backdrop click
  if (customerModal) {
    customerModal.addEventListener('click', (e) => {
      if (e.target === customerModal) {
        hideModal(customerModal);
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
  loadAllProducts();
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
  const invoiceTotalCowAmount = document.getElementById('invoice-total-cow-amount');
  const invoiceTotalBuffaloAmount = document.getElementById('invoice-total-buffalo-amount');
  const invoiceTotalProductAmount = document.getElementById('invoice-total-product-amount');
  const invoiceGrandTotal = document.getElementById('invoice-grand-total');
  const invoiceCustomerName = document.getElementById('invoice-customer-name');
  const invoiceCustomerPhone = document.getElementById('invoice-customer-phone');
  const invoiceCustomerAddress = document.getElementById('invoice-customer-address');

  let milkPrices = { cowPrice: 0, buffaloPrice: 0 };

  // Load milk prices
  async function loadMilkPrices() {
    try {
      const res = await fetch('/api/milk-prices');
      if (res.ok) {
        milkPrices = await res.json();
      }
    } catch (err) {
      console.error('Failed to load milk prices:', err);
    }
  }

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
      invoiceRows.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No customer selected</td></tr>';
      return;
    }

    try {
      // Load milk prices first
      await loadMilkPrices();

      const res = await fetch(`/api/milk-entries/customer/${customerId}`);
      if (!res.ok) throw new Error('Failed to fetch milk entries');
      const entries = await res.json();

      console.log('Loaded milk entries:', entries.length, entries);
      // Log products for debugging
      entries.forEach((entry, index) => {
        if (entry.products && entry.products.length > 0) {
          console.log(`Entry ${index} has products:`, entry.products);
        }
      });

      invoiceRows.innerHTML = '';

      if (entries.length === 0) {
        invoiceRows.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No milk entries found</td></tr>';
        invoiceTotalCow.textContent = '0';
        invoiceTotalBuffalo.textContent = '0';
        if (invoiceTotalCowAmount) invoiceTotalCowAmount.textContent = '₹0.00';
        if (invoiceTotalBuffaloAmount) invoiceTotalBuffaloAmount.textContent = '₹0.00';
        if (invoiceTotalProductAmount) invoiceTotalProductAmount.textContent = '₹0.00';
        if (invoiceGrandTotal) invoiceGrandTotal.textContent = '₹0.00';
        return;
      }

      let totalCow = 0;
      let totalBuffalo = 0;
      let totalCowAmount = 0;
      let totalBuffaloAmount = 0;
      let totalProductAmount = 0;

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

        // Calculate amounts using milk prices
        const cowAmount = cow * (milkPrices.cowPrice || 0);
        const buffaloAmount = buffalo * (milkPrices.buffaloPrice || 0);
        
        // Calculate product amount and names
        let productAmount = 0;
        let productNames = [];
        if (entry.products && Array.isArray(entry.products) && entry.products.length > 0) {
          entry.products.forEach((product) => {
            const cost = product.cost || 0;
            productAmount += cost;
            if (product.productName) {
              productNames.push(`${product.productName} (₹${cost.toFixed(2)})`);
            } else if (product.productId) {
              // Fallback: if productName is missing, try to show productId
              productNames.push(`Product (₹${cost.toFixed(2)})`);
            }
          });
        }
        totalProductAmount += productAmount;

        const rowTotal = cowAmount + buffaloAmount + productAmount;

        totalCowAmount += cowAmount;
        totalBuffaloAmount += buffaloAmount;

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${formatDateForInvoice(entry.date)}</td>
          <td>${cow.toFixed(1)}</td>
          <td>${buffalo.toFixed(1)}</td>
          <td>${productNames.length > 0 ? productNames.join(', ') : '—'}</td>
          <td>₹${cowAmount.toFixed(2)}</td>
          <td>₹${buffaloAmount.toFixed(2)}</td>
          <td>₹${productAmount.toFixed(2)}</td>
          <td>₹${rowTotal.toFixed(2)}</td>
        `;
        invoiceRows.appendChild(row);
      });

      // Update totals
      invoiceTotalCow.textContent = totalCow.toFixed(1);
      invoiceTotalBuffalo.textContent = totalBuffalo.toFixed(1);
      if (invoiceTotalCowAmount) invoiceTotalCowAmount.textContent = `₹${totalCowAmount.toFixed(2)}`;
      if (invoiceTotalBuffaloAmount) invoiceTotalBuffaloAmount.textContent = `₹${totalBuffaloAmount.toFixed(2)}`;
      if (invoiceTotalProductAmount) invoiceTotalProductAmount.textContent = `₹${totalProductAmount.toFixed(2)}`;
      if (invoiceGrandTotal) invoiceGrandTotal.textContent = `₹${(totalCowAmount + totalBuffaloAmount + totalProductAmount).toFixed(2)}`;
    } catch (err) {
      console.error('Error loading milk entries:', err);
      invoiceRows.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--danger);">Error loading milk entries</td></tr>';
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
  loadMilkPrices();
  loadCustomerDetails();
  loadMilkEntries();
}
