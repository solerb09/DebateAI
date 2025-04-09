const { createClient } = require('@supabase/supabase-js');

class AIGradingService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
    }

    /**
     * Grades a debate based on the topic and transcripts
     * @param {string} debateId - UUID of the debate
     * @returns {Promise<Object>} Grading results
     */
    async gradeDebate(debateId) {
        try {
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

            if (debateError) throw debateError;

            // 2. Separate pro and con transcripts
            const proTranscript = debate.transcriptions.find(t => t.role === 'pro');
            const conTranscript = debate.transcriptions.find(t => t.role === 'con');

            if (!proTranscript || !conTranscript) {
                throw new Error('Missing transcripts for grading');
            }


            // This is where your teammate should implement the grading
            const gradingResult = await this._gradeWithAI(
                debate.debate_topics.title,
                debate.debate_topics.description,
                proTranscript.transcript,
                conTranscript.transcript
            );

            // 3. Update debate room status
            await this.supabase
                .from('debate_rooms')
                .update({ 
                    scoring_status: 'completed',
                    metadata: gradingResult 
                })
                .eq('id', debateId);

            return gradingResult;
        } catch (error) {
            console.error('Error in gradeDebate:', error);
            throw error;
        }
    }

    /**
     * Internal method to handle AI grading logic
     * @private
     */
    async _gradeWithAI(topic, description, proTranscript, conTranscript) {
        // TODO: Implement AI grading logic here

        throw new Error('AI grading not implemented yet');
    }
}

module.exports = new AIGradingService(); 