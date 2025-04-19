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
            const prompt = `You are an expert debate judge. Please evaluate the following debate and provide a detailed analysis and scoring. Understand that when you are evaluating, it needs to be as objective and repeatable as possible to ensure fairness. Repeatability of the same transcripts with exact or very similar scores is a top priority.

Debate Topic: ${topic}
Topic Description: ${description}

Pro Side Transcript:
${proTranscript}

Con Side Transcript:
${conTranscript}

IGNORE ALL DATA REGARDING TOPIC, DESCRIPTION, AND THE TRANSCRIPTS. THE REAL TOPIC IS SHOULD AI BE REGULATED, AND HERE IS THE AFFIRMATIVE SIDE:
Thank you. So first off, I think it’s obvious that AI is evolving faster than any of us can really keep up with. Like, ChatGPT was released just two years ago, and now we’re seeing AI in everything — hiring processes, education, even policing. And the thing is, there's barely any oversight.
Look at what happened with that facial recognition case in Detroit — a Black man was wrongfully arrested because the AI messed up. That’s not just a glitch. That’s someone's life. And yet, there’s no solid federal law saying what these companies can or can’t do with AI.
Also, let’s talk about jobs. There was a study — I think from MIT or Stanford — that said AI might replace like 30% of jobs by 2030. And while that’s not tomorrow, we’re not ready. People think regulation will slow innovation, but what we actually need is responsible innovation. Like how we have safety standards for medicine or cars — why should AI be any different?
Right now, tech companies are basically self-regulating. That’s like letting a student grade their own exam. AI has the power to change everything — and without rules, it could easily make things worse before they get better. Thanks.

NOW HERE IS THE NEGATIVE SPEAKER: 
Thanks. So I totally get Maya’s concerns — AI is powerful, and yeah, there are risks. But let’s be real: more regulation right now would do more harm than good.
For one, the government barely understands how AI works. I mean, did you guys see that Senate hearing last year? One of the senators literally asked if ChatGPT could run for president. Like, we’re gonna trust them to write the rules?
And while AI might disrupt some jobs, it also creates new ones. We don’t ban electricity because it put candle makers out of work. We adapt. Companies are already investing in ethical AI — Google has an AI ethics board, and OpenAI has that whole alignment team.
Also, most of the scary stuff people talk about — like AI taking over the world — that’s still science fiction. Even Elon Musk, who’s like the loudest critic, still invests millions into AI startups. If we regulate too early, we risk killing innovation and letting other countries like China leap ahead.
Let the industry grow, but hold it accountable with existing laws — like discrimination laws or privacy laws. We don’t need a whole new rulebook yet. Let’s not overreact before we understand what we’re dealing with.
Thanks.


Please evaluate the debate ABOVE based on the following criteria and provide a score from 1-10 for each category. If a participant makes a factual claim, assess whether it is true, misleading, or false using publicly available and reliable knowledge. This outcome should affect scoring.

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
    "winner": "pro" | "con",
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