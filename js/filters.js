const Filters = {
  currentFilter: 'all',
  currentSort: 'default',

  init(containerId, onFilterChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      this.currentFilter = chip.dataset.filter;
      onFilterChange(this.currentFilter, this.currentSort);
    });
  },

  initSort(selectId, onSortChange) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      onSortChange(this.currentFilter, this.currentSort);
    });
  },

  filterByCategory(articles, category, favorites = []) {
    if (category === 'all') return articles;
    if (category === 'favorites') {
      return articles.filter(a => favorites.includes(a.id));
    }
    return articles.filter(a => a.category === category);
  },

  sortArticles(articles, sortBy) {
    const sorted = [...articles];
    switch (sortBy) {
      case 'name-asc': sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'name-desc': sorted.sort((a, b) => b.title.localeCompare(a.title)); break;
      case 'words-asc': sorted.sort((a, b) => a.vocabCount - b.vocabCount); break;
      case 'words-desc': sorted.sort((a, b) => b.vocabCount - a.vocabCount); break;
    }
    return sorted;
  },

  applyAll(articles, filter, sort, query, favorites = []) {
    let result = this.filterByCategory(articles, filter, favorites);
    result = Search.filterArticles(result, query);
    result = this.sortArticles(result, sort);
    return result;
  }
};
