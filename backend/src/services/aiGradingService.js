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

            console.log('Fetched debate data:', JSON.stringify(debate, null, 2));

            // 2. Separate pro and con transcripts
            const proTranscript = debate.transcriptions.find(t => t.role === 'pro');
            const conTranscript = debate.transcriptions.find(t => t.role === 'con');

            console.log('Found transcripts:', {
                pro: proTranscript ? 'Yes' : 'No',
                con: conTranscript ? 'Yes' : 'No',
                allTranscripts: debate.transcriptions
            });

            if (!proTranscript || !conTranscript) {
                throw new Error(`Missing transcripts for grading. Found: ${JSON.stringify({
                    hasPro: !!proTranscript,
                    hasCon: !!conTranscript,
                    allRoles: debate.transcriptions.map(t => t.role)
                })}`);
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
        try {
            const prompt = `You are an expert debate judge. Please evaluate the following debate and provide a detailed analysis and scoring.

Debate Topic: ${topic}
Topic Description: ${description}

Pro Side Transcript:
${proTranscript}

Con Side Transcript:
${conTranscript}

Please evaluate the debate based on the following criteria and provide a score from 1-10 for each category:

1. Argument Quality (10 points):
   - Strength of evidence
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
5. Key strengths and areas for improvement for each side

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
    "winner": "pro" | "con",
    "strengths": {
        "pro": ["string"],
        "con": ["string"]
    },
    "improvements": {
        "pro": ["string"],
        "con": ["string"]
    }
}`;

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

            const gradingResult = JSON.parse(completion.choices[0].message.content);
            return gradingResult;
        } catch (error) {
            console.error('Error in _gradeWithAI:', error);
            throw new Error('Failed to grade debate with AI');
        }
    }
}

module.exports = new AIGradingService(); 