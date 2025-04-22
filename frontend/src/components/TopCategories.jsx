import React from 'react';
import '../styles/TopCategories.css';

function TopCategories({ categories }) {
  return (
    <div className="top-categories-container">
      <div className="top-categories-header">
        <i className="categories-icon"></i>
        <h2>Top Categories</h2>
      </div>
      
      <div className="categories-list">
        {categories.map((category, index) => (
          <div key={index} className="category-row">
            <div className="category-name">{category.name}</div>
            <div className="category-winrate">{category.winRate} win rate</div>
            <div className="category-bar-container">
              <div 
                className="category-bar-fill" 
                style={{ width: `${parseInt(category.winRate)}%` }}
              ></div>
            </div>
            <div className="category-stats">
              <div className="category-wins">{category.wins} wins</div>
              <div className="category-debates">{category.debates} debates</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopCategories; 