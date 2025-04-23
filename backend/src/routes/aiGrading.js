const express = require('express');
const router = express.Router();
const aiGradingService = require('../services/aiGradingService');

/**
 * @route GET /api/debates/:debateId/grading/status
 * @desc Get the grading status for a specific debate
 * @access Private
 */
router.get('/:debateId/status', async (req, res) => {
    try {
        const { debateId } = req.params;
        
        // Get debate status from database
        const { data: debate, error } = await aiGradingService.supabase
            .from('debate_rooms')
            .select('scoring_status')
            .eq('id', debateId)
            .single();
            
        if (error) throw error;
        
        if (!debate) {
            return res.status(404).json({
                success: false,
                error: 'Debate not found'
            });
        }
        
        // Get participant scores if grading is completed
        let scores = null;
        if (debate.scoring_status === 'completed') {
            const { data: participants, error: participantsError } = await aiGradingService.supabase
                .from('debate_participants')
                .select('side, score_breakdown, is_winner')
                .eq('room_id', debateId);
                
            if (!participantsError && participants) {
                scores = participants.reduce((acc, p) => {
                    acc[p.side] = {
                        score_breakdown: p.score_breakdown,
                        is_winner: p.is_winner
                    };
                    return acc;
                }, {});
            }
        }
        
        res.json({
            success: true,
            data: {
                status: debate.scoring_status,
                scores: scores
            }
        });
    } catch (error) {
        console.error('Error getting grading status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/debates/:debateId/grading/start
 * @desc Start AI grading for a specific debate
 * @access Private
 */
router.post('/:debateId/start', async (req, res) => {
    try {
        const { debateId } = req.params;
        console.log('[GRADING_ROUTE] Starting grading for debate:', debateId);
        
        // Check if debate exists and can be graded
        const { data: debate, error: debateError } = await aiGradingService.supabase
            .from('debate_rooms')
            .select('status, scoring_status')
            .eq('id', debateId)
            .single();
            
        if (debateError) {
            console.error('[GRADING_ROUTE] Error fetching debate:', debateError);
            throw debateError;
        }
        
        if (!debate) {
            console.log('[GRADING_ROUTE] Debate not found:', debateId);
            return res.status(404).json({
                success: false,
                error: 'Debate not found'
            });
        }

        console.log('[GRADING_ROUTE] Current debate status:', {
            status: debate.status,
            scoring_status: debate.scoring_status
        });
        
        // Only allow grading for completed debates
        if (debate.status !== 'completed') {
            console.log('[GRADING_ROUTE] Cannot grade uncompleted debate');
            return res.status(400).json({
                success: false,
                error: 'Debate must be completed before grading'
            });
        }
        
        // Allow starting grading from pending or failed status
        if (debate.scoring_status !== 'pending' && debate.scoring_status !== 'failed') {
            console.log('[GRADING_ROUTE] Invalid scoring status for starting grading:', debate.scoring_status);
            return res.status(400).json({
                success: false,
                error: `Cannot start grading from '${debate.scoring_status}' status. Status must be 'pending' or 'failed'`
            });
        }

        console.log('[GRADING_ROUTE] Starting grading process...');
        
        // Start grading asynchronously - status will be set to processing when OpenAI request begins
        aiGradingService.gradeDebate(debateId)
            .catch(error => {
                console.error('[GRADING_ROUTE] Background grading failed:', error);
                // Update status back to failed if grading fails
                aiGradingService.supabase
                    .from('debate_rooms')
                    .update({ scoring_status: 'failed' })
                    .eq('id', debateId)
                    .then(() => console.log('[GRADING_ROUTE] Status updated to failed after error'))
                    .catch(updateError => console.error('[GRADING_ROUTE] Failed to update status after error:', updateError));
            });
        
        console.log('[GRADING_ROUTE] Grading initiated');
        res.json({
            success: true,
            message: 'Grading started',
            data: { status: 'pending' }
        });
    } catch (error) {
        console.error('[GRADING_ROUTE] Error in start grading route:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/debates/:debateId/grading/reset
 * @desc Reset the grading status for a specific debate
 * @access Private
 */
router.post('/:debateId/reset', async (req, res) => {
    try {
        const { debateId } = req.params;
        console.log('[GRADING_ROUTE] Attempting to reset grading status for debate:', debateId);
        
        // Check current status
        const { data: debate, error: debateError } = await aiGradingService.supabase
            .from('debate_rooms')
            .select('scoring_status')
            .eq('id', debateId)
            .single();
            
        if (debateError) {
            console.error('[GRADING_ROUTE] Error fetching debate:', debateError);
            throw debateError;
        }
        
        if (!debate) {
            return res.status(404).json({
                success: false,
                error: 'Debate not found'
            });
        }

        console.log('[GRADING_ROUTE] Current status:', debate.scoring_status);
        
        // Only reset if status is 'processing'
        if (debate.scoring_status === 'processing') {
            const { error: updateError } = await aiGradingService.supabase
                .from('debate_rooms')
                .update({ scoring_status: 'pending' })
                .eq('id', debateId);

            if (updateError) {
                throw updateError;
            }

            console.log('[GRADING_ROUTE] Status reset to pending');
            return res.json({
                success: true,
                message: 'Status reset to pending',
                data: { status: 'pending' }
            });
        }

        return res.json({
            success: true,
            message: 'No reset needed',
            data: { status: debate.scoring_status }
        });
    } catch (error) {
        console.error('[GRADING_ROUTE] Error resetting status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 