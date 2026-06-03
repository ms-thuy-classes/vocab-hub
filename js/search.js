const Search = {
  query: '',
  debounceTimer: null,
  init(inputId, onSearch) {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById('clearSearch');
    if (!input) return;
    input.addEventListener('input', (e) => {
      this.query = e.target.value.trim().toLowerCase();
      if (clearBtn) {
        if (this.query) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        onSearch(this.query);
      }, 200);
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        this.query = '';
        clearBtn.classList.add('hidden');
        onSearch('');
        input.focus();
      });
    }
  },
  filterArticles(articles, query) {
    if (!query) return articles;
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    return articles.filter(article => {
      const searchText = [
        article.title,
        article.description,
        article.level,
        article.category,
        ...(article.tags || [])
      ].join(' ').toLowerCase();
      return terms.every(term => searchText.includes(term));
    });
  }
};
