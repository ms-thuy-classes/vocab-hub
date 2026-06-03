/* ========================================
   SEARCH.JS - Chức năng tìm kiếm realtime
   Tìm theo: tên bài, tag, mô tả
   ======================================== */

const Search = {
  query: '',
  debounceTimer: null,

  // Khởi tạo search
  init(inputId, onSearch) {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById('clearSearch');
    if (!input) return;

    input.addEventListener('input', (e) => {
      this.query = e.target.value.trim().toLowerCase();

      // Hiện/ẩn nút clear
      if (clearBtn) {
        if (this.query) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }

      // Debounce 200ms
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        onSearch(this.query);
      }, 200);
    });

    // Nút clear
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        this.query = '';
        clearBtn.classList.add('hidden');
        onSearch('');
        input.focus();
      });
    }

    // Keyboard shortcut: Ctrl+K hoặc /
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== input)) {
        e.preventDefault();
        input.focus();
        input.select();
      }
      if (e.key === 'Escape' && document.activeElement === input) {
        input.blur();
      }
    });
  },

  // Lọc articles theo query
  filterArticles(articles, query) {
    if (!query) return articles;

    const terms = query.split(/\s+/).filter(t => t.length > 0);

    return articles.filter(article => {
      // Tạo text searchable
      const searchText = [
        article.title,
        article.description,
        article.level,
        article.category,
        ...(article.tags || [])
      ].join(' ').toLowerCase();

      // Tất cả terms phải xuất hiện
      return terms.every(term => searchText.includes(term));
    });
  },

  // Highlight từ khóa trong text
  highlight(text, query) {
    if (!query || !text) return text;
    const terms = query.split(/\s+/).filter(t => t.length > 0);
    let result = text;
    terms.forEach(term => {
      const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
      result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
    });
    return result;
  },

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
};

// CSS cho highlight
const searchStyle = document.createElement('style');
searchStyle.textContent = `
  .search-highlight {
    background: linear-gradient(135deg, #fde68a, #fbbf24);
    color: #78350f;
    padding: 0 2px;
    border-radius: 3px;
    font-weight: 700;
  }
`;
document.head.appendChild(searchStyle);
