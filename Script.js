// Configurações e Variáveis Globais
const CONFIG = {
    SCRIPT_URL: 'SEU_SCRIPT_URL_AQUI', // Substitua pela URL do seu Google Apps Script
    ITEMS_PER_PAGE: 50,
    CACHE_DURATION: 300000, // 5 minutos em ms
    DEBOUNCE_DELAY: 300
};

let allData = [];
let filteredData = [];
let currentPage = 1;
let totalPages = 1;
let charts = {};

// Utilitários
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
};

const showLoading = () => {
    document.getElementById('loading-overlay').style.display = 'flex';
};

const hideLoading = () => {
    document.getElementById('loading-overlay').style.display = 'none';
};

const formatNumber = (num) => {
    return new Intl.NumberFormat('pt-BR').format(num);
};

const getStatusClass = (estado) => {
    switch (estado?.toLowerCase()) {
        case 'bom': return 'bom';
        case 'regular': return 'regular';
        case 'ruim': return 'ruim';
        default: return 'regular';
    }
};

// Cache Management
class CacheManager {
    static set(key, data, duration = CONFIG.CACHE_DURATION) {
        const item = {
            data: data,
            timestamp: Date.now(),
            duration: duration
        };
        localStorage.setItem(key, JSON.stringify(item));
    }

    static get(key) {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const parsedItem = JSON.parse(item);
        const now = Date.now();

        if (now - parsedItem.timestamp > parsedItem.duration) {
            localStorage.removeItem(key);
            return null;
        }

        return parsedItem.data;
    }

    static clear() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('patrimonio_')) {
                localStorage.removeItem(key);
            }
        });
    }
}

// Data Loading
async function loadData() {
    showLoading();
    
    try {
        // Tentar carregar do cache primeiro
        const cachedData = CacheManager.get('patrimonio_data');
        if (cachedData) {
            allData = cachedData;
            initializeDashboard();
            hideLoading();
            return;
        }

        const response = await fetch(CONFIG.SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        allData = Array.isArray(data) ? data : [];
        
        // Cache dos dados
        CacheManager.set('patrimonio_data', allData);
        
        initializeDashboard();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showError('Erro ao carregar dados: ' + error.message);
    } finally {
        hideLoading();
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="card" style="background: #fef2f2; border-left: 4px solid #ef4444;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
                <p style="color: #991b1b; margin: 0;">${message}</p>
            </div>
        </div>
    `;
    
    const main = document.querySelector('.main .container');
    main.insertBefore(errorDiv, main.firstChild);
}

// Dashboard Initialization
function initializeDashboard() {
    filteredData = [...allData];
    
    populateFilters();
    updateMetrics();
    updateCharts();
    updateTable();
    updateTabs();
}

function populateFilters() {
    const unidades = [...new Set(allData.map(item => item.Unidade).filter(Boolean))].sort();
    const categorias = [...new Set(allData.map(item => item['Categoria(Tipo)']).filter(Boolean))].sort();
    
    // Populate unit filters
    const unidadeSelects = ['unidade', 'unidadeEstoque', 'unidadeNecessidade'];
    unidadeSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Todas as Unidades</option>';
            unidades.forEach(unidade => {
                select.innerHTML += `<option value="${unidade}">${unidade}</option>`;
            });
        }
    });
    
    // Populate category filter
    const categoriaSelect = document.getElementById('categoriaEstoque');
    if (categoriaSelect) {
        categoriaSelect.innerHTML = '<option value="">Todas</option>';
        categorias.forEach(categoria => {
            categoriaSelect.innerHTML += `<option value="${categoria}">${categoria}</option>`;
        });
    }
}

// Metrics Update
function updateMetrics() {
    const total = filteredData.length;
    const bom = filteredData.filter(item => item.Estado?.toLowerCase() === 'bom').length;
    const regular = filteredData.filter(item => item.Estado?.toLowerCase() === 'regular').length;
    const ruim = filteredData.filter(item => item.Estado?.toLowerCase() === 'ruim').length;
    
    document.getElementById('totalItens').textContent = formatNumber(total);
    document.getElementById('itensBom').textContent = formatNumber(bom);
    document.getElementById('itensRegular').textContent = formatNumber(regular);
    document.getElementById('itensRuim').textContent = formatNumber(ruim);
    
    if (total > 0) {
        document.getElementById('itensBomPerc').textContent = `${((bom / total) * 100).toFixed(1)}%`;
        document.getElementById('itensRegularPerc').textContent = `${((regular / total) * 100).toFixed(1)}%`;
        document.getElementById('itensRuimPerc').textContent = `${((ruim / total) * 100).toFixed(1)}%`;
    }
}

// Charts
function updateCharts() {
    updateEstadoChart();
    updateUnidadeChart();
    updateEstoqueChart();
}

function updateEstadoChart() {
    const ctx = document.getElementById('estadoChart');
    if (!ctx) return;
    
    const estadoCounts = {};
    filteredData.forEach(item => {
        const estado = item.Estado || 'Não informado';
        estadoCounts[estado] = (estadoCounts[estado] || 0) + 1;
    });
    
    if (charts.estadoChart) {
        charts.estadoChart.destroy();
    }
    
    charts.estadoChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(estadoCounts),
            datasets: [{
                data: Object.values(estadoCounts),
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

function updateUnidadeChart() {
    const ctx = document.getElementById('unidadeChart');
    if (!ctx) return;
    
    const unidadeCounts = {};
    filteredData.forEach(item => {
        const unidade = item.Unidade || 'Não informado';
        unidadeCounts[unidade] = (unidadeCounts[unidade] || 0) + 1;
    });
    
    // Top 10 unidades
    const sortedUnidades = Object.entries(unidadeCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    if (charts.unidadeChart) {
        charts.unidadeChart.destroy();
    }
    
    charts.unidadeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedUnidades.map(([unidade]) => unidade),
            datasets: [{
                label: 'Quantidade de Itens',
                data: sortedUnidades.map(([, count]) => count),
                backgroundColor: '#2563eb',
                borderColor: '#1d4ed8',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function updateEstoqueChart() {
    const ctx = document.getElementById('estoqueChart');
    if (!ctx) return;
    
    const categoriaCounts = {};
    filteredData.forEach(item => {
        const categoria = item['Categoria(Tipo)'] || 'Não informado';
        categoriaCounts[categoria] = (categoriaCounts[categoria] || 0) + 1;
    });
    
    // Top 10 categorias
    const sortedCategorias = Object.entries(categoriaCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    if (charts.estoqueChart) {
        charts.estoqueChart.destroy();
    }
    
    charts.estoqueChart = new Chart(ctx, {
        type: 'horizontalBar',
        data: {
            labels: sortedCategorias.map(([categoria]) => categoria),
            datasets: [{
                label: 'Quantidade em Estoque',
                data: sortedCategorias.map(([, count]) => count),
                backgroundColor: '#10b981',
                borderColor: '#059669',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Table Management
function updateTable() {
    const tableBody = document.getElementById('inventarioTableBody');
    if (!tableBody) return;
    
    totalPages = Math.ceil(filteredData.length / CONFIG.ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    tableBody.innerHTML = '';
    
    pageData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.Descrição || '-'}</td>
            <td>${item.Unidade || '-'}</td>
            <td><span class="status-badge ${getStatusClass(item.Estado)}">${item.Estado || '-'}</span></td>
            <td>${item.Origem || '-'}</td>
            <td>${item['Categoria(Tipo)'] || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="viewItem('${item.id || Math.random()}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    updatePagination();
}

function updatePagination() {
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (pageInfo) {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
    }
}

// Filter Functions
function updateFilters() {
    const tipoUnidade = document.getElementById('tipoUnidade').value;
    const unidade = document.getElementById('unidade').value;
    const estado = document.getElementById('estado').value;
    const origem = document.getElementById('origem').value;
    
    filteredData = allData.filter(item => {
        return (!tipoUnidade || item['Tipo de Unidade'] === tipoUnidade) &&
               (!unidade || item.Unidade === unidade) &&
               (!estado || item.Estado === estado) &&
               (!origem || item.Origem === origem);
    });
    
    // Update dependent filters
    updateDependentFilters();
    
    currentPage = 1;
    updateMetrics();
    updateCharts();
    updateTable();
}

function updateDependentFilters() {
    const tipoUnidade = document.getElementById('tipoUnidade').value;
    const unidadeSelect = document.getElementById('unidade');
    
    if (tipoUnidade && unidadeSelect) {
        const unidadesFiltradas = [...new Set(
            allData
                .filter(item => item['Tipo de Unidade'] === tipoUnidade)
                .map(item => item.Unidade)
                .filter(Boolean)
        )].sort();
        
        unidadeSelect.innerHTML = '<option value="">Selecione uma Unidade...</option>';
        unidadesFiltradas.forEach(unidade => {
            unidadeSelect.innerHTML += `<option value="${unidade}">${unidade}</option>`;
        });
    }
}

// Search Functions
const searchInventario = debounce((searchTerm) => {
    if (!searchTerm.trim()) {
        filteredData = [...allData];
    } else {
        const term = searchTerm.toLowerCase();
        filteredData = allData.filter(item => 
            Object.values(item).some(value => 
                value && value.toString().toLowerCase().includes(term)
            )
        );
    }
    
    currentPage = 1;
    updateMetrics();
    updateTable();
}, CONFIG.DEBOUNCE_DELAY);

const searchEstoque = debounce((searchTerm) => {
    updateEstoque();
}, CONFIG.DEBOUNCE_DELAY);

// Tab Management
function showTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab
    event.target.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Pagination
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        updateTable();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        updateTable();
    }
}

// Export Functions
function exportDashboard() {
    // Implementar exportação completa do dashboard
    console.log('Exportando dashboard...');
}

function exportChart(chartId) {
    const chart = charts[chartId];
    if (chart) {
        const url = chart.toBase64Image();
        const link = document.createElement('a');
        link.download = `${chartId}.png`;
        link.href = url;
        link.click();
    }
}

function exportInventario() {
    // Implementar exportação do inventário para PDF
    console.log('Exportando inventário...');
}

function gerarRelatorioPDF() {
    // Implementar geração de relatório PDF
    console.log('Gerando relatório PDF...');
}

// Utility Functions
function clearAllFilters() {
    document.getElementById('tipoUnidade').value = '';
    document.getElementById('unidade').value = '';
    document.getElementById('estado').value = '';
    document.getElementById('origem').value = '';
    document.getElementById('searchInventario').value = '';
    
    updateFilters();
}

function refreshData() {
    CacheManager.clear();
    loadData();
}

function updateEstoque() {
    // Implementar atualização da aba de estoque
    console.log('Atualizando estoque...');
}

function updateNecessidades() {
    // Implementar atualização da aba de necessidades
    console.log('Atualizando necessidades...');
}

function updateTabs() {
    // Implementar atualização das abas
    console.log('Atualizando abas...');
}

function viewItem(itemId) {
    // Implementar visualização de item individual
    console.log('Visualizando item:', itemId);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});
