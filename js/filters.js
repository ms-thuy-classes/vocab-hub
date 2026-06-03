/* ========================================
   FILTERS.JS - Lọc bài học theo category
   Hỗ trợ filter chip + sort
   ======================================== */

const Filters = {
  currentFilter: 'all',
  currentSort: 'default',

  // Khởi tạo filters
  init(containerId, onFilterChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Xử lý click chip
    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;

      // Update active state
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      this.currentFilter = chip.dataset.filter;
      onFilterChange(this.currentFilter, this.currentSort);
    });
  },

  // Khởi tạo sort
  initSort(selectId, onSortChange) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      onSortChange(this.currentFilter, this.currentSort);
    });
  },

  // Lọc articles theo filter
  filterByCategory(articles, category, favorites = []) {
    if (category === 'all') return articles;
    if (category === 'favorites') {
      return articles.filter(a => favorites.includes(a.id));
    }
    return articles.filter(a => a.category === category);
  },

  // Sắp xếp articles
  sortArticles(articles, sortBy) {
    const sorted = [...articles];
    switch (sortBy) {
      case 'name-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'words-asc':
        sorted.sort((a, b) => a.vocabCount - b.vocabCount);
        break;
      case 'words-desc':
        sorted.sort((a, b) => b.vocabCount - a.vocabCount);
        break;
      default:
        // Giữ nguyên thứ tự
        break;
    }
    return sorted;
  },

  // Áp dụng cả filter + sort + search
  applyAll(articles, filter, sort, query, favorites = []) {
    let result = articles;

    // Filter by category
    result = this.filterByCategory(result, filter, favorites);

    // Filter by search
    result = Search.filterArticles(result, query);

    // Sort
    result = this.sortArticles(result, sort);

    return result;
  }
};
