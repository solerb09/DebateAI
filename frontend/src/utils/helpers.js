/**
 * Format seconds into a time string (MM:SS)
 * @param {number} seconds - Number of seconds
 * @returns {string} - Formatted time string
 */
export const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Calculate center points for positioning UI elements
 * @param {Object} rect - DOMRect of the container element
 * @returns {Object} - Center coordinates
 */
export const calculateCenterPoints = (rect) => {
  if (!rect) return { x: 0, y: 0 };
  
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}; 