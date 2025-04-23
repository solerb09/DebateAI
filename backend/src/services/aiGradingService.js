const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

class AIGradingService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    /**
     * Grades a debate based on the topic and transcripts
     * @param {string} debateId - UUID of the debate
     * @returns {Promise<Object>} Grading results
     */
    async gradeDebate(debateId) {
        try {
            console.log('[GRADING] Starting grading process for debate:', debateId);
            
            // 1. Fetch debate details and transcripts
            const { data: debate, error: debateError } = await this.supabase
                .from('debate_rooms')
                .select(`
                    id,
                    topic_id,
                    debate_topics (
                        title,
                        description
                    ),
                    transcriptions (
                        id,
                        role,
                        transcript,
                        user_id
                    )
                `)
                .eq('id', debateId)
                .single();

            if (debateError) {
                console.error('[GRADING] Error fetching debate:', debateError);
                throw debateError;
            }

            if (!debate) {
                throw new Error('Debate not found');
            }

            console.log('[GRADING] Fetched debate data:', {
                id: debate.id,
                topic: debate.debate_topics?.title,
                transcriptionCount: debate.transcriptions?.length
            });

            // 2. Separate pro and con transcripts
            const proTranscript = debate.transcriptions.find(t => t.role === 'pro');
            const conTranscript = debate.transcriptions.find(t => t.role === 'con');

            console.log('[GRADING] Found transcripts:', {
                pro: proTranscript ? 'Yes' : 'No',
                con: conTranscript ? 'Yes' : 'No',
                proLength: proTranscript?.transcript?.length || 0,
                conLength: conTranscript?.transcript?.length || 0
            });

            if (!proTranscript || !conTranscript) {
                throw new Error(`Missing transcripts for grading. Found: ${JSON.stringify({
                    hasPro: !!proTranscript,
                    hasCon: !!conTranscript,
                    allRoles: debate.transcriptions.map(t => t.role)
                })}`);
            }

            // Only set status to processing right before making the OpenAI call
            console.log('[GRADING] Setting status to processing before OpenAI call...');
            const { error: updateError } = await this.supabase
                .from('debate_rooms')
                .update({ scoring_status: 'processing' })
                .eq('id', debateId);

            if (updateError) {
                console.error('[GRADING] Error updating status to processing:', updateError);
                throw updateError;
            }

            console.log('[GRADING] Starting AI grading...');
            
            // Get grading result from OpenAI
            const gradingResult = await this._gradeWithAI(
                debateId,
                debate.debate_topics.title,
                debate.debate_topics.description,
                proTranscript.transcript,
                conTranscript.transcript
            );

            console.log('[GRADING] AI grading completed, updating participants...');

            // First fetch complete participant data including user_ids
            const { data: fullParticipants, error: participantsFetchError } = await this.supabase
                .from('debate_participants')
                .select('id, user_id, side')
                .eq('room_id', debateId)
                .in('side', ['pro', 'con']);

            if (participantsFetchError) {
                console.error('[GRADING] Failed to fetch participants:', participantsFetchError);
                throw new Error(`Failed to fetch participants: ${participantsFetchError.message}`);
            }

            if (!fullParticipants || fullParticipants.length !== 2) {
                console.error('[GRADING] Invalid participant count:', fullParticipants?.length);
                throw new Error(`Expected 2 participants, found ${fullParticipants?.length || 0}`);
            }

            console.log('[GRADING] Found participants:', fullParticipants);

            // Prepare updates for both participants
            const updates = fullParticipants.map(participant => {
                const side = participant.side;
                const scores = side === 'pro' ? gradingResult.pro_scores : gradingResult.con_scores;
                const explanations = gradingResult.score_explanations[side];
                
                // Create comprehensive score breakdown
                const score_breakdown = {
                    scores: {
                        argument_quality: scores.argument_quality,
                        communication_skills: scores.communication_skills,
                        topic_understanding: scores.topic_understanding,
                        total: scores.total
                    },
                    explanations: {
                        argument_quality: explanations.argument_quality,
                        communication_skills: explanations.communication_skills,
                        topic_understanding: explanations.topic_understanding
                    },
                    summary: gradingResult.summary
                };

                return {
                    id: participant.id,
                    room_id: debateId,
                    user_id: participant.user_id, // Using user_id from fetched data
                    score_breakdown,
                    is_winner: gradingResult.winner === side
                };
            });

            console.log('[GRADING] Preparing updates:', updates);

            // Execute updates with complete data
            const { error: updateError2 } = await this.supabase
                .from('debate_participants')
                .upsert(updates);

            if (updateError2) {
                console.error('[GRADING] Failed to update participants:', updateError2);
                throw new Error(`Failed to update participants: ${updateError2.message}`);
            }

            console.log('[GRADING] Successfully updated participants, updating debate room status...');

            // Update user win/loss counts
            console.log('[GRADING] Updating user win/loss counts...');
            
            try {
                // Find the winner and loser participants
                const winner = updates.find(p => p.is_winner === true);
                const loser = updates.find(p => p.is_winner === false);
                
                if (winner && winner.user_id && loser && loser.user_id) {
                    // Get current stats for winner
                    const { data: winnerData, error: winnerFetchError } = await this.supabase
                        .from('users')
                        .select('wins')
                        .eq('id', winner.user_id)
                        .single();
                    
                    if (winnerFetchError) {
                        console.error('[GRADING] Failed to fetch winner stats:', winnerFetchError);
                    } else {
                        // Increment wins for winner
                        const currentWins = winnerData.wins || 0;
                        const { error: winnerUpdateError } = await this.supabase
                            .from('users')
                            .update({ wins: currentWins + 1 })
                            .eq('id', winner.user_id);
                        
                        if (winnerUpdateError) {
                            console.error('[GRADING] Failed to update winner stats:', winnerUpdateError);
                        } else {
                            console.log(`[GRADING] Successfully incremented wins for user ${winner.user_id} to ${currentWins + 1}`);
                        }
                    }
                    
                    // Get current stats for loser
                    const { data: loserData, error: loserFetchError } = await this.supabase
                        .from('users')
                        .select('losses')
                        .eq('id', loser.user_id)
                        .single();
                    
                    if (loserFetchError) {
                        console.error('[GRADING] Failed to fetch loser stats:', loserFetchError);
                    } else {
                        // Increment losses for loser
                        const currentLosses = loserData.losses || 0;
                        const { error: loserUpdateError } = await this.supabase
                            .from('users')
                            .update({ losses: currentLosses + 1 })
                            .eq('id', loser.user_id);
                        
                        if (loserUpdateError) {
                            console.error('[GRADING] Failed to update loser stats:', loserUpdateError);
                        } else {
                            console.log(`[GRADING] Successfully incremented losses for user ${loser.user_id} to ${currentLosses + 1}`);
                        }
                    }
                } else {
                    console.warn('[GRADING] Could not determine winner and loser for updating stats');
                }
            } catch (statsError) {
                console.error('[GRADING] Error updating user win/loss stats:', statsError);
                // Don't fail the whole process if stats update fails
            }

            // Update debate room status to completed (no metadata needed)
            const { error: finalStatusError } = await this.supabase
                .from('debate_rooms')
                .update({ scoring_status: 'completed' })
                .eq('id', debateId);

            if (finalStatusError) {
                console.error('[GRADING] Failed to update final status:', finalStatusError);
                throw new Error(`Failed to update debate status: ${finalStatusError.message}`);
            }

            // Verify the status was actually updated
            const { data: finalCheck, error: checkError } = await this.supabase
                .from('debate_rooms')
                .select('scoring_status')
                .eq('id', debateId)
                .single();

            if (checkError) {
                console.error('[GRADING] Failed to verify final status:', checkError);
                throw new Error(`Failed to verify debate status: ${checkError.message}`);
            }

            if (finalCheck.scoring_status !== 'completed') {
                console.error('[GRADING] Status verification failed. Expected completed but got:', finalCheck.scoring_status);
                throw new Error(`Failed to update status to completed. Current status: ${finalCheck.scoring_status}`);
            }

            console.log('[GRADING] Grading process completed successfully and verified');
            return gradingResult;
            
        } catch (error) {
            console.error('[GRADING] Error in gradeDebate:', error);
            // Update debate room status to failed
            try {
                const { error: failureError } = await this.supabase
                    .from('debate_rooms')
                    .update({ scoring_status: 'failed' })
                    .eq('id', debateId);

                if (failureError) {
                    console.error('[GRADING] Failed to update status to failed:', failureError);
                }
            } catch (updateError) {
                console.error('[GRADING] Failed to update status to failed:', updateError);
            }
            throw error;
        }
    }

    /**
     * Internal method to handle AI grading logic
     * @private
     */
    async _gradeWithAI(debateId, topic, description, proTranscript, conTranscript) {
        try {
            console.log('[AI_GRADING] Starting AI grading for debate:', debateId);
            console.log('[AI_GRADING] Topic:', topic);
            console.log('[AI_GRADING] Pro transcript length:', proTranscript?.length || 0);
            console.log('[AI_GRADING] Con transcript length:', conTranscript?.length || 0);

            if (!proTranscript || !conTranscript) {
                throw new Error('Missing transcripts for grading');
            }

            const prompt = `You are an expert debate judge. Please evaluate the following debate and provide a detailed analysis and scoring. Understand that when you are evaluating, it needs to be as objective and repeatable as possible to ensure fairness. Repeatability of the same transcripts with exact or very similar scores is a top priority.

Debate Topic: ${topic}
Topic Description: ${description}

Pro Side Transcript:
${proTranscript}

Con Side Transcript:
${conTranscript}

Please evaluate the debate based on the following criteria and provide a score from 1-10 for each category. If a participant makes a factual claim, assess whether it is true, misleading, or false using publicly available and reliable knowledge. This outcome should affect scoring.

1. Argument Quality (10 points):
   - Strength of evidence and correctness of claim
   - Logical consistency
   - Relevance to topic
   - Depth of analysis

2. Communication Skills (10 points):
   - Clarity of expression
   - Organization of points
   - Use of language
   - Engagement with audience

3. Topic Understanding (10 points):
   - Depth of knowledge
   - Contextual awareness
   - Application of concepts

Please provide:
1. A summary of the debate
2. Individual scores for each category for both sides
3. A brief explanation for each score
4. An overall winner

Format your response as a JSON object with the following structure:
{
    "summary": "string",
    "pro_scores": {
        "argument_quality": number,
        "communication_skills": number,
        "topic_understanding": number,
        "total": number
    },
    "con_scores": {
        "argument_quality": number,
        "communication_skills": number,
        "topic_understanding": number,
        "total": number
    },
    "score_explanations": {
        "pro": {
            "argument_quality": "string",
            "communication_skills": "string",
            "topic_understanding": "string"
        },
        "con": {
            "argument_quality": "string",
            "communication_skills": "string",
            "topic_understanding": "string"
        }
    },
    "winner": "pro" | "con"
}`;

            console.log('[AI_GRADING] Sending request to OpenAI...');
            
            try {
                const completion = await this.openai.chat.completions.create({
                    model: "gpt-4-turbo-preview",
                    messages: [
                        {
                            role: "system",
                            content: "You are an expert debate judge with years of experience in evaluating competitive debates."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    response_format: { type: "json_object" }
                });

                console.log('[AI_GRADING] Received response from OpenAI');
                
                if (!completion.choices || completion.choices.length === 0) {
                    throw new Error('No response content from OpenAI');
                }

                const gradingResult = JSON.parse(completion.choices[0].message.content);
                console.log('[AI_GRADING] Successfully parsed grading result:', gradingResult);

                // Validate the response format
                if (!gradingResult.summary || !gradingResult.pro_scores || !gradingResult.con_scores) {
                    throw new Error('Invalid response format from OpenAI');
                }

                return gradingResult;
            } catch (openaiError) {
                console.error('[AI_GRADING] OpenAI API error:', openaiError);
                throw new Error(`OpenAI API error: ${openaiError.message}`);
            }
        } catch (error) {
            console.error('[AI_GRADING] Error in _gradeWithAI:', error);
            throw error;
        }
    }
}

module.exports = new AIGradingService(); 