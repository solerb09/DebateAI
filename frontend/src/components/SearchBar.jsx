import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/SearchBar.css';

const SearchBar = ({ placeholder = "Search for debates..." }) => {
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        navigate(`/debates?search=${encodeURIComponent(inputValue.trim())}`);
      }
    }
  };

  const handleIconClick = () => {
    if (inputValue.trim()) {
      navigate(`/debates?search=${encodeURIComponent(inputValue.trim())}`);
    }
  };

  return (
    <div className="search-container">
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
      />
      <span className="search-icon" onClick={handleIconClick} style={{ cursor: 'pointer' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M19 19L14.65 14.65M17 9C17 13.4183 13.4183 17 9 17C4.58172 17 1 13.4183 1 9C1 4.58172 4.58172 1 9 1C13.4183 1 17 4.58172 17 9Z" 
            stroke="#666666" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"/>
        </svg>
      </span>
    </div>
  );
};

export default SearchBar; 