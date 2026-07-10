const API_BASE = '/api';

const state = {
  transactions: [],
  page: 1,
  limit: 8,
  search: '',
  filterType: '',
  filterCategory: '',
  sort: 'latest',
  editId: null,
};

const elements = {
  balance: document.getElementById('balance-value'),
  income: document.getElementById('income-value'),
  expense: document.getElementById('expense-value'),
  count: document.getElementById('transaction-count'),
  tableBody: document.getElementById('table-body'),
  search: document.getElementById('search'),
  filterType: document.getElementById('filter-type'),
  filterCategory: document.getElementById('filter-category'),
  sort: document.getElementById('sort'),
  form: document.getElementById('transaction-form'),
  title: document.getElementById('title'),
  amount: document.getElementById('amount'),
  date: document.getElementById('date'),
  notes: document.getElementById('notes'),
  category: document.getElementById('category'),
  prevPage: document.getElementById('prev-page'),
  nextPage: document.getElementById('next-page'),
  pageIndicator: document.getElementById('page-indicator'),
  refreshBtn: document.getElementById('refresh-btn'),
  clearBtn: document.getElementById('clear-btn'),
  submitBtn: document.getElementById('submit-btn'),
};

let monthlyChart = null;
let categoryChart = null;

async function fetchTransactions() {
  const response = await fetch(API_BASE);
  const data = await response.json();
  if (!response.ok) {
    console.error('Unable to load transactions');
    return;
  }
  state.transactions = data.data || [];
  state.page = 1;
  render();
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function getFilteredTransactions() {
  let filtered = [...state.transactions];

  if (state.search.trim()) {
    const keyword = normalizeText(state.search);
    filtered = filtered.filter((tx) => {
      return (
        normalizeText(tx.title).includes(keyword) ||
        normalizeText(tx.category).includes(keyword) ||
        normalizeText(tx.notes).includes(keyword)
      );
    });
  }

  if (state.filterType) {
    filtered = filtered.filter((tx) => tx.type === state.filterType);
  }

  if (state.filterCategory) {
    filtered = filtered.filter((tx) => tx.category === state.filterCategory);
  }

  switch (state.sort) {
    case 'oldest':
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case 'highest':
      filtered.sort((a, b) => b.amount - a.amount);
      break;
    case 'lowest':
      filtered.sort((a, b) => a.amount - b.amount);
      break;
    default:
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  return filtered;
}

function getVisibleTransactions() {
  const filtered = getFilteredTransactions();
  const start = (state.page - 1) * state.limit;
  const pageItems = filtered.slice(start, start + state.limit);
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.limit));
  if (state.page > totalPages) {
    state.page = totalPages;
  }
  return { records: pageItems, totalPages };
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString));
}

function updateSummary() {
  const income = state.transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const expense = state.transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const balance = income - expense;

  elements.income.textContent = formatCurrency(income);
  elements.expense.textContent = formatCurrency(expense);
  elements.balance.textContent = formatCurrency(balance);
  elements.count.textContent = state.transactions.length;
}

function renderCategories() {
  const categories = Array.from(
    new Set(state.transactions.map((tx) => tx.category).filter(Boolean))
  ).sort();

  elements.filterCategory.innerHTML = '<option value="">All</option>';
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.filterCategory.appendChild(option);
  });
}

function renderTransactions() {
  const { records, totalPages } = getVisibleTransactions();
  elements.tableBody.innerHTML = '';

  if (records.length === 0) {
    elements.tableBody.innerHTML = `<tr><td colspan="6" class="empty-row">No transactions found.</td></tr>`;
  }

  records.forEach((tx) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${tx.title}</td>
      <td><span class="badge-chip ${tx.type}">${tx.type}</span></td>
      <td>${formatCurrency(tx.amount)}</td>
      <td>${tx.category}</td>
      <td>${formatDate(tx.date)}</td>
      <td>
        <button class="btn btn-ghost" data-action="edit" data-id="${tx._id}">Edit</button>
        <button class="btn btn-secondary" data-action="delete" data-id="${tx._id}">Delete</button>
      </td>
    `;
    elements.tableBody.appendChild(row);
  });

  elements.pageIndicator.textContent = `Page ${state.page} of ${totalPages}`;
  elements.prevPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= totalPages;
}

function resetForm() {
  state.editId = null;
  elements.form.reset();
  elements.submitBtn.textContent = 'Save';
  elements.date.valueAsDate = new Date();
}

async function saveTransaction(event) {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const body = {
    title: formData.get('title').trim(),
    amount: Number(formData.get('amount')),
    type: formData.get('type'),
    category: formData.get('category'),
    date: formData.get('date'),
    notes: formData.get('notes').trim(),
  };

  if (!body.title || !body.amount || !body.category || !body.date) {
    return;
  }

  const method = state.editId ? 'PUT' : 'POST';
  const url = state.editId ? `${API_BASE}/${state.editId}` : API_BASE;

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error('Failed to save transaction');
    return;
  }

  await fetchTransactions();
  resetForm();
}

async function deleteTransaction(id) {
  const confirmed = window.confirm('Delete this transaction permanently?');
  if (!confirmed) return;

  const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    console.error('Delete failed');
    return;
  }

  await fetchTransactions();
}

function fillFormForEdit(transaction) {
  state.editId = transaction._id;
  elements.title.value = transaction.title;
  elements.amount.value = transaction.amount;
  elements.category.value = transaction.category;
  elements.date.value = new Date(transaction.date).toISOString().slice(0, 10);
  elements.notes.value = transaction.notes || '';
  elements.form.querySelector(`input[name="type"][value="${transaction.type}"]`).checked = true;
  elements.submitBtn.textContent = 'Update';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleTableAction(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === 'edit') {
    const transaction = state.transactions.find((item) => item._id === id);
    if (transaction) fillFormForEdit(transaction);
  }
  if (action === 'delete') {
    await deleteTransaction(id);
  }
}

async function loadReports() {
  const [monthlyRes, categoryRes] = await Promise.all([
    fetch(`${API_BASE}/monthly-report`),
    fetch(`${API_BASE}/category-report`),
  ]);

  if (monthlyRes.ok) {
    const monthlyData = await monthlyRes.json();
    renderMonthlyChart(monthlyData.data || []);
  }

  if (categoryRes.ok) {
    const categoryData = await categoryRes.json();
    renderCategoryChart(categoryData.data || []);
  }
}

function renderMonthlyChart(data) {
  const labels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const incomeData = Array(12).fill(0);
  const expenseData = Array(12).fill(0);

  data.forEach((item) => {
    const index = Number(item._id) - 1;
    if (index >= 0 && index < 12) {
      incomeData[index] = item.totalIncome || 0;
      expenseData[index] = item.totalExpense || 0;
    }
  });

  const ctx = document.getElementById('monthly-chart');
  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: 'rgba(93, 225, 255, 0.95)',
          backgroundColor: 'rgba(93, 225, 255, 0.18)',
          tension: 0.28,
          fill: true,
        },
        {
          label: 'Expense',
          data: expenseData,
          borderColor: 'rgba(251, 113, 133, 0.95)',
          backgroundColor: 'rgba(251, 113, 133, 0.18)',
          tension: 0.28,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#cbd5e1' } },
      },
      scales: {
        x: { ticks: { color: '#9fb2d1' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { ticks: { color: '#9fb2d1' }, grid: { color: 'rgba(255,255,255,0.06)' } },
      },
    },
  });
}

function renderCategoryChart(data) {
  const labels = data.map((item) => item._id);
  const values = data.map((item) => item.totalAmount);
  const palette = labels.map((_, index) => `hsl(${(index * 45) % 360}, 85%, 55%)`);

  const ctx = document.getElementById('category-chart');
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: palette,
          borderColor: 'rgba(6, 10, 20, 0.75)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#cbd5e1' } },
      },
    },
  });
}

function bindEvents() {
  elements.search.addEventListener('input', (event) => {
    state.search = event.target.value;
    state.page = 1;
    renderTransactions();
  });

  elements.filterType.addEventListener('change', (event) => {
    state.filterType = event.target.value;
    state.page = 1;
    renderTransactions();
  });

  elements.filterCategory.addEventListener('change', (event) => {
    state.filterCategory = event.target.value;
    state.page = 1;
    renderTransactions();
  });

  elements.sort.addEventListener('change', (event) => {
    state.sort = event.target.value;
    renderTransactions();
  });

  elements.prevPage.addEventListener('click', () => {
    state.page = Math.max(1, state.page - 1);
    renderTransactions();
  });

  elements.nextPage.addEventListener('click', () => {
    state.page += 1;
    renderTransactions();
  });

  elements.form.addEventListener('submit', saveTransaction);
  elements.clearBtn.addEventListener('click', resetForm);
  elements.refreshBtn.addEventListener('click', async () => {
    await fetchTransactions();
    await loadReports();
  });
  elements.tableBody.addEventListener('click', handleTableAction);
}

function render() {
  updateSummary();
  renderCategories();
  renderTransactions();
}

function initializePage() {
  elements.date.valueAsDate = new Date();
  bindEvents();
  fetchTransactions();
  loadReports();
}

initializePage();
