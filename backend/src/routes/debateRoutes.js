/**
 * API routes for debate topics management
 */

const express = require('express');
const router = express.Router();

// In-memory storage for debate topics
// In a production app, you'd use a database instead
let debates = [
  {
    id: '1',
    title: 'Should AI be regulated?',
    description: 'A debate on the ethics and necessity of AI regulation',
    creator: 'user1',
    status: 'open', // open, active, closed
    createdAt: new Date()
  }
];

// Get all debates
router.get('/', (req, res) => {
  res.json(debates);
});

// Get a specific debate
router.get('/:id', (req, res) => {
  const debate = debates.find(d => d.id === req.params.id);
  if (!debate) {
    return res.status(404).json({ error: 'Debate not found' });
  }
  res.json(debate);
});

// Create a new debate
router.post('/', (req, res) => {
  const { title, description, creator } = req.body;
  
  // Validate required fields
  if (!title || !description || !creator) {
    return res.status(400).json({ error: 'Title, description, and creator are required' });
  }
  
  // Create new debate
  const newDebate = {
    id: Date.now().toString(),
    title,
    description,
    creator,
    status: 'open',
    createdAt: new Date()
  };
  
  debates.push(newDebate);
  res.status(201).json(newDebate);
});

// Update a debate (e.g., changing status)
router.put('/:id', (req, res) => {
  const { status } = req.body;
  const index = debates.findIndex(d => d.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Debate not found' });
  }
  
  // Update debate
  debates[index] = {
    ...debates[index],
    ...req.body,
    updatedAt: new Date()
  };
  
  res.json(debates[index]);
});

// Delete a debate
router.delete('/:id', (req, res) => {
  const index = debates.findIndex(d => d.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Debate not found' });
  }
  
  debates.splice(index, 1);
  res.status(204).send();
});

module.exports = router; 