const express = require('express');
const router = express.Router();
const aiGradingService = require('../services/aiGradingService');

/**
 * @route POST /api/grading/:debateId
 * @desc Trigger AI grading for a specific debate
 * @access Private
 */
router.post('/:debateId', async (req, res) => {
    try {
        const { debateId } = req.params;
        const gradingResult = await aiGradingService.gradeDebate(debateId);
        res.json({ success: true, data: gradingResult });
    } catch (error) {
        console.error('Error in grading route:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router; 