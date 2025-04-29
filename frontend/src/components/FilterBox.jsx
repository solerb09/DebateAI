import React, { useState } from 'react';

const FilterBox = ({ 
  categories, 
  selectedCategory, 
  setSelectedCategory, 
  sortBy, 
  setSortBy,
  searchQuery,
  setSearchQuery,
  onSearch,
  debates 
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setSearchQuery(inputValue);
      onSearch(inputValue);
    }
  };

  const handleReset = () => {
    setSelectedCategory('All Categories');
    setSortBy('Newest First');
    setSearchQuery('');
    setInputValue('');
    onSearch('');
  };

  return (
    <div className="filters-sidebar">
      <div className="search-filter-section">
        <h2>Search & Filter</h2>
        <div className="search-input-container">
          <input
            type="text"
            placeholder="Search debates and press Enter..."
            className="search-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          {inputValue && (
            <button 
              className="clear-search-btn"
              onClick={() => {
                setInputValue('');
                setSearchQuery('');
                onSearch('');
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="filter-section">
          <h3>Category</h3>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            <option>All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-section">
          <h3>Sort By</h3>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option>Newest First</option>
            <option>Oldest First</option>
          </select>
        </div>

        <button 
          onClick={handleReset}
          className="reset-filters-btn"
        >
          <span>Reset Filters</span>
        </button>
      </div>

      <div className="popular-categories">
        <h2>Popular Categories</h2>
        <div className="category-list">
          {categories.slice(0, 3).map(category => (
            <div 
              key={category.id} 
              className="category-item"
              onClick={() => setSelectedCategory(category.name)}
            >
              <span>{category.name}</span>
              <span className="category-count">
                {debates.filter(d => d.category === category.name).length}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterBox; 