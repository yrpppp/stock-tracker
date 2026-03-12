const API_URL = 'http://localhost:3000/stocks';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-stock-form') as HTMLFormElement;
  const portfolioGrid = document.getElementById('portfolio-grid') as HTMLDivElement;
  const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
  const loader = document.querySelector('.loader') as HTMLSpanElement;
  const summaryCard = document.getElementById('portfolio-summary') as HTMLDivElement;
  const userIdInput = document.getElementById('user-id-input') as HTMLInputElement;

  let pollingInterval: any;
  function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(fetchPortfolio, 60000);
  }
  
  // Add Stock Modal Elements
  const addStockModal = document.getElementById('add-stock-modal') as HTMLDivElement;
  const openModalBtn = document.getElementById('open-modal-btn') as HTMLButtonElement;
  const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;

  // Edit Stock Modal Elements
  const editStockModal = document.getElementById('edit-stock-modal') as HTMLDivElement;
  const closeEditModalBtn = document.getElementById('close-edit-modal-btn') as HTMLButtonElement;
  const editStockForm = document.getElementById('edit-stock-form') as HTMLFormElement;
  const editStockIdInput = document.getElementById('edit-stock-id') as HTMLInputElement;
  const editSymbolInput = document.getElementById('edit-symbol') as HTMLInputElement;
  const editPurchasePriceInput = document.getElementById('edit-purchasePrice') as HTMLInputElement;
  const editQuantityInput = document.getElementById('edit-quantity') as HTMLInputElement;

  function openModal() {
    addStockModal.classList.remove('hidden');
  }

  function closeModal() {
    addStockModal.classList.add('hidden');
    form.reset();
  }

  function closeEditModal() {
    editStockModal.classList.add('hidden');
    editStockForm.reset();
  }

  openModalBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);
  closeEditModalBtn.addEventListener('click', closeEditModal);

  addStockModal.addEventListener('click', (e) => {
    if (e.target === addStockModal) {
      closeModal();
    }
  });

  editStockModal.addEventListener('click', (e) => {
    if (e.target === editStockModal) {
      closeEditModal();
    }
  });

  async function fetchPortfolio() {
    const userId = userIdInput.value.trim() || 'default_user';
    const params = new URLSearchParams({ userId });
    
    // Don't show full loading text for background 1 min updates if grid has content
    if(portfolioGrid.children.length === 0 || portfolioGrid.querySelector('.grid-loading')) {
      portfolioGrid.innerHTML = '<div class="grid-loading" style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">로딩 중...</div>';
    }
    
    try {
      const response = await fetch(`${API_URL}?${params.toString()}`);
      const data = await response.json();
      
      portfolioGrid.innerHTML = '';
      
      if (!data || data.length === 0) {
        summaryCard.classList.add('hidden');
        portfolioGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">포트폴리오가 비어있습니다. 첫 주식을 등록해보세요!</div>';
        return;
      }
      
      let totalPurchase = 0;
      let totalCurrent = 0;

      data.forEach((stock: any, index: number) => {
        const qty = Number(stock.quantity) || 1;
        const exRate = stock.exchangeRate || 1400;
        const isUSD = stock.currency === 'USD';
        
        const purchaseKrw = isUSD ? Number(stock.purchasePrice) * qty * exRate : Number(stock.purchasePrice) * qty;
        const currentKrw = isUSD ? Number(stock.currentPrice || stock.purchasePrice) * qty * exRate : Number(stock.currentPrice || stock.purchasePrice) * qty;
        
        totalPurchase += purchaseKrw;
        totalCurrent += currentKrw;
        renderCard(stock, index, qty, isUSD, exRate);
      });
      
      renderSummary(totalPurchase, totalCurrent);
      summaryCard.classList.remove('hidden');
      
    } catch (error) {
      console.error('Error fetching data:', error);
      portfolioGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--danger);">데이터를 불러오는데 실패했습니다. 백엔드 서버가 실행 중인지 확인하세요.</div>';
    }
  }

  function renderSummary(totalPurchase: number, totalCurrent: number) {
    const totalReturnRate = totalPurchase > 0 
      ? (((totalCurrent - totalPurchase) / totalPurchase) * 100).toFixed(2) 
      : '0.00';
      
    const isPositive = Number(totalReturnRate) >= 0;
    const rateClass = isPositive ? 'return-positive' : 'return-negative';
    const rateSymbol = isPositive ? '+' : '';
    const diff = totalCurrent - totalPurchase;
    
    summaryCard.innerHTML = `
      <div class="summary-item">
        <span class="summary-label">총 매입 금액</span>
        <span class="summary-val">₩${totalPurchase.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">전체 평가 금액</span>
        <span class="summary-val">₩${totalCurrent.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">총 수익금</span>
        <span class="summary-val" style="color: ${isPositive ? 'var(--success)' : 'var(--danger)'}">${diff > 0 ? '+' : ''}₩${diff.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">총 수익률</span>
        <span class="summary-val ${rateClass}" style="font-size: 1.5rem; padding: 0.2rem 1rem; border-radius: 8px;">${rateSymbol}${totalReturnRate}%</span>
      </div>
    `;
  }

  function renderCard(stock: any, index: number, qty: number, isUSD: boolean, exRate: number) {
    const card = document.createElement('div');
    card.className = 'stock-card glass-card';
    card.style.animationDelay = `${index * 0.1}s`;
    card.style.cursor = 'pointer'; // Make it look clickable
    
    // Parse numeric rate safely
    const rateStr = stock.returnRate ? stock.returnRate.replace('%', '') : '0';
    const rate = parseFloat(rateStr);
    
    const isPositive = rate >= 0;
    const rateClass = isPositive ? 'return-positive' : 'return-negative';
    const rateSymbol = isPositive ? '+' : '';
    
    const purchaseTotal = Number(stock.purchasePrice) * qty;
    const currentTotal = Number(stock.currentPrice || stock.purchasePrice) * qty;
    
    let currentPriceMain = `₩${currentTotal.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
    let currentPriceSub = '';
    let purchasePriceHtml = `₩${purchaseTotal.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;

    if (isUSD) {
       const krwCurrentTotal = currentTotal * exRate;
       const krwPurchaseTotal = purchaseTotal * exRate;
       
       currentPriceMain = `$${currentTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
       currentPriceSub = `<div style="font-size: 0.9rem; font-weight: 500; color: var(--text-secondary); margin-top: 0.2rem;">(₩${krwCurrentTotal.toLocaleString('ko-KR', { maximumFractionDigits: 0 })})</div>`;
       
       purchasePriceHtml = `$${purchaseTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })} <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-secondary);">(₩${krwPurchaseTotal.toLocaleString('ko-KR', { maximumFractionDigits: 0 })})</span>`;
    }
    
    card.innerHTML = `
      <div class="stock-card-header" style="align-items: flex-start;">
        <h3 class="stock-symbol" title="${stock.symbol}" style="font-size: 1.25rem; line-height: 1.2; padding-right: 0.5rem; word-break: keep-all;">
          ${stock.stockName || stock.symbol}
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.3rem; font-weight: 500;">${stock.symbol}</div>
        </h3>
        <button class="delete-btn" data-id="${stock.id}" aria-label="삭제" style="opacity: 0.7; transform: translateY(0.2rem); position: relative; z-index: 10;">
          <svg style="pointer-events: none;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>
      <div class="stock-price" style="display: flex; flex-direction: column; gap: 0.2rem;">
        <div style="display: flex; align-items: baseline; gap: 0.5rem;">
          ${currentPriceMain}
          <span style="font-size: 0.9rem; font-weight: 400; color: var(--text-secondary);">(${qty.toLocaleString('ko-KR')}주)</span>
        </div>
        ${currentPriceSub}
      </div>
      
      <div class="stock-details">
        <div class="row">
          <span>총 매수금:</span>
          <span>${purchasePriceHtml}</span>
        </div>
        <div class="row" style="margin-top: 0.5rem; align-items: center;">
          <span>수익률:</span>
          <span class="return-rate ${rateClass}">${rateSymbol}${stock.returnRate || '0.00%'}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      // Don't open edit modal if delete button was clicked
      if ((e.target as HTMLElement).closest('.delete-btn')) {
        return;
      }
      
      // Populate and open edit modal
      editStockIdInput.value = stock.id;
      editSymbolInput.value = stock.symbol;
      editPurchasePriceInput.value = stock.purchasePrice;
      editQuantityInput.value = qty.toString();
      
      editStockModal.classList.remove('hidden');
    });

    // Add delete event
    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
        try {
          await fetch(`${API_URL}/${stock.id}`, { method: 'DELETE' });
          await fetchPortfolio();
        } catch(err) {
          alert('삭제에 실패했습니다.');
          card.style.opacity = '1';
          card.style.pointerEvents = 'auto';
        }
      });
    }

    portfolioGrid.appendChild(card);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = userIdInput.value.trim() || 'default_user';
    const symbol = document.getElementById('symbol') as HTMLInputElement;
    const purchasePrice = document.getElementById('purchasePrice') as HTMLInputElement;
    const quantity = document.getElementById('quantity') as HTMLInputElement;
    
    loader.classList.remove('hidden');
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.value.toUpperCase().trim(),
          purchasePrice: parseFloat(purchasePrice.value),
          quantity: parseInt(quantity.value, 10) || 1,
          userId
        })
      });
      
      if (!response.ok) throw new Error('Failed to add');
      
      closeModal();
      await fetchPortfolio();
      
    } catch (error) {
      alert('주식을 추가하는데 실패했습니다. 벡엔드 서버를 확인해주세요.');
    } finally {
      loader.classList.add('hidden');
    }
  });

  editStockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = editStockIdInput.value;
    const purchasePrice = parseFloat(editPurchasePriceInput.value);
    const quantity = parseInt(editQuantityInput.value, 10);
    const editLoader = editStockForm.querySelector('.loader') as HTMLSpanElement;
    
    editLoader.classList.remove('hidden');
    
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchasePrice, quantity })
      });
      
      if (!response.ok) throw new Error('Failed to update');
      
      closeEditModal();
      await fetchPortfolio();
      
    } catch (error) {
      alert('주식 정보를 수정하는데 실패했습니다.');
    } finally {
      editLoader.classList.add('hidden');
    }
  });

  refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(180deg)';
    setTimeout(() => refreshBtn.style.transform = 'none', 300);
    fetchPortfolio();
  });

  userIdInput.addEventListener('change', () => {
    fetchPortfolio();
  });

  // Initial fetch
  fetchPortfolio();
  startPolling();
});
