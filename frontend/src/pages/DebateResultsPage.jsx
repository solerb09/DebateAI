import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/GradingResults.css';
import DebateHero from '../components/DebateHero';
import ScoreCard from '../components/ScoreCard';
import TranscriptionCard from '../components/TranscriptionCard';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Page to view debate results after the debate is complete
 */
const DebateResultsPage = () => {
  const { id: debateId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [debate, setDebate] = useState(null);
  const [transcriptions, setTranscriptions] = useState([]);
  const [scores, setScores] = useState({ ai: 0, human: 0 });
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [gradingResults, setGradingResults] = useState(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState('idle'); // 'idle', 'processing', 'completed', 'error'
  
  // Fetch debate details and transcriptions
  useEffect(() => {
    if (!debateId) return;
    
    const fetchDebateData = async () => {
      try {
        setLoading(true);
        console.log(`[RESULTS] ========= FETCHING DEBATE RESULTS =========`);
        console.log(`[RESULTS] Debate ID: ${debateId}`);
        
        // Fetch debate details
        console.log(`[RESULTS] Fetching debate details...`);
        const debateResponse = await fetch(`${API_URL}/api/debates/${debateId}`);
        
        if (!debateResponse.ok) {
          const errorText = await debateResponse.text();
          console.error(`[RESULTS] Error ${debateResponse.status} fetching debate details:`, errorText);
          throw new Error(`Server responded with ${debateResponse.status}: ${errorText}`);
        }
        
        const debateData = await debateResponse.json();
        setDebate(debateData);
        console.log("[RESULTS] Debate data:", debateData);
        
        const debugData = { debateInfo: debateData };
        
        // Fetch transcriptions
        try {
          console.log(`[RESULTS] Fetching transcriptions...`);
          const transcriptResponse = await fetch(`${API_URL}/api/audio/transcriptions/${debateId}`);
          const responseData = await transcriptResponse.json();
          
          if (transcriptResponse.ok) {
            console.log("[RESULTS] Transcription response status:", transcriptResponse.status);
            debugData.transcriptionResponse = responseData;
            
            if (responseData.success) {
              if (responseData.status === 'processing') {
                console.log('[RESULTS] Transcriptions are still being processed');
                setTranscriptionStatus('processing');
                setTranscriptions([]);
                setScores({ ai: 0, human: 0 });
                setWinner(null);
              } else if (responseData.data && responseData.data.length > 0) {
                console.log(`[RESULTS] Found ${responseData.data.length} transcriptions`);
                setTranscriptionStatus('completed');
                
                // Log details about each transcription
                responseData.data.forEach((transcript, index) => {
                  console.log(`[RESULTS] Transcription ${index + 1}:`);
                  console.log(`[RESULTS] - Role: ${transcript.role}`);
                  console.log(`[RESULTS] - User ID: ${transcript.user_id}`);
                  console.log(`[RESULTS] - User Name: ${transcript.user?.username || transcript.user?.email || 'Unknown'}`);
                  console.log(`[RESULTS] - Transcript Length: ${transcript.transcript?.length || 0} chars`);
                  console.log(`[RESULTS] - Created: ${new Date(transcript.created_at).toLocaleString()}`);
                });
                
                setTranscriptions(responseData.data);
                
                // Process transcription data for scores
                console.log(`[RESULTS] Processing transcription data for scoring...`);
                processTranscriptionData(responseData.data);
                
                // Update debug info
                debugData.foundTranscriptions = responseData.data.length;
                debugData.transcriptionData = responseData.data.map(t => ({
                  id: t.id,
                  role: t.role,
                  user_id: t.user_id,
                  created_at: t.created_at,
                  transcript_length: t.transcript?.length || 0
                }));
              } else {
                console.warn("[RESULTS] No transcription data found:", responseData);
                debugData.noTranscriptionsReason = "No data in response or empty data array";
                setTranscriptionStatus('completed');
                setTranscriptions([]);
                setScores({ ai: 0, human: 0 });
                setWinner(null);
              }
            } else {
              console.warn("[RESULTS] Error fetching transcriptions:", responseData);
              debugData.transcriptionError = responseData;
              
              // Set empty transcriptions array, no mock data
              setTranscriptions([]);
              setScores({ ai: 0, human: 0 });
              setWinner(null);
            }
          } else {
            console.warn("[RESULTS] Error fetching transcriptions:", responseData);
            debugData.transcriptionError = responseData;
            
            // Set empty transcriptions array, no mock data
            setTranscriptions([]);
            setScores({ ai: 0, human: 0 });
            setWinner(null);
          }
        } catch (transcriptError) {
          console.warn('[RESULTS] Error fetching transcription data:', transcriptError);
          debugData.transcriptionException = transcriptError.toString();
          
          // Set empty transcriptions array, no mock data
          setTranscriptions([]);
          setScores({ ai: 0, human: 0 });
          setWinner(null);
        }
        
        setDebugInfo(debugData);
        setLoading(false);
        console.log(`[RESULTS] ========= RESULTS LOADING COMPLETE =========`);
        
        // After fetching debate data, fetch grading results
        await fetchGradingResults()
        console.log(`[RESULTS] ========= GRADING RESULTS FETCHED =========`);
        
      } catch (error) {
        console.error('[RESULTS] Error fetching debate data:', error);
        setError('Failed to load debate information');
        setDebugInfo({ error: error.toString() });
        setLoading(false);
      }
    };
    
    fetchDebateData();
  }, [debateId]);
  
  // Process transcription data to extract scores
  const processTranscriptionData = (transcriptions) => {
    if (!transcriptions || transcriptions.length === 0) {
      console.log(`[RESULTS] No transcriptions to process`);
      return;
    }
    
    try {
      // Find pro and con transcriptions
      const proTranscription = transcriptions.find(t => t.role === 'pro');
      const conTranscription = transcriptions.find(t => t.role === 'con');
      
      console.log("[RESULTS] Processing transcriptions for scoring:");
      console.log("[RESULTS] Pro transcription found:", !!proTranscription);
      console.log("[RESULTS] Con transcription found:", !!conTranscription);
      
      // Set scores based on transcript length for now (or some other metric)
      // In a real implementation, this would come from an AI evaluation
      if (proTranscription && conTranscription) {
        const proLength = proTranscription.transcript?.length || 0;
        const conLength = conTranscription.transcript?.length || 0;
        
        console.log(`[RESULTS] Pro transcript length: ${proLength}, Con transcript length: ${conLength}`);
        
        // Simple scoring based on length with randomization for testing
        const proScore = Math.min(100, Math.max(50, 70 + (proLength > conLength ? 15 : 0) + Math.floor(Math.random() * 10)));
        const conScore = Math.min(100, Math.max(50, 70 + (conLength > proLength ? 15 : 0) + Math.floor(Math.random() * 10)));
        
        // Set scores and determine winner
        setScores({
          ai: proScore, 
          human: conScore
        });
        
        // Mock winner declaration - this will be replaced with real AI evaluation later
        const winnerName = proScore > conScore ? 'AI' : 'Human';
        setWinner(winnerName);
        console.log(`[RESULTS] Scores calculated - Pro: ${proScore}, Con: ${conScore}`);
        console.log(`[RESULTS] Winner determined: ${winnerName}`);
      } else {
        // For now, we won't set a mock winner if we don't have both transcripts
        console.warn("[RESULTS] Missing either pro or con transcription, no scores calculated");
        setScores({ ai: 0, human: 0 });
        setWinner(null);
      }
    } catch (error) {
      console.error('[RESULTS] Error processing transcription data:', error);
      setScores({ ai: 0, human: 0 });
      setWinner(null);
    }
  };
  
  // Extract key points from the transcription
  const getKeyPoints = (role) => {
    try {
      // Find the transcription for this role
      const transcription = transcriptions.find(t => t.role === role);
      
      if (transcription && transcription.transcript) {
        // If we have a real transcript, try to extract key points
        const text = transcription.transcript;
        console.log(`[TRANSCRIPTION] Extracting key points from ${role} transcript (${text.length} chars)`);
        
        // Split text into sentences and filter out short ones
        const sentences = text.split(/[.!?]+/)
          .map(s => s.trim())
          .filter(s => s.length > 20);
        
        // Get up to 5 sentences as key points
        const extractedPoints = sentences
          .slice(0, Math.min(5, sentences.length))
          .filter(s => s.length > 0);
        
        console.log(`[TRANSCRIPTION] Extracted ${extractedPoints.length} key points for ${role}`);
        
        return extractedPoints;
      }
      
      // If no transcript available, return empty array - no fallback to mock data
      return [];
    } catch (error) {
      console.error(`[TRANSCRIPTION] Error getting key points for ${role}:`, error);
      return [];
    }
  };
  
  // Get the title for each side
  const getSideTitle = (role) => {
    // If we have real transcription data with roles, use those
    if (transcriptions.length > 0) {
      if (role === 'pro') {
        const proTranscription = transcriptions.find(t => t.role === 'pro');
        return proTranscription?.user?.username || proTranscription?.user?.email || 'Pro Speaker';
      } else {
        const conTranscription = transcriptions.find(t => t.role === 'con');
        return conTranscription?.user?.username || conTranscription?.user?.email || 'Con Speaker';
      }
    }
    
    // Default titles if no transcriptions
    return role === 'pro' ? 'Pro Speaker' : 'Con Speaker';
  };
  
  const fetchGradingResults = async () => {
    try {
      const response = await fetch(`${API_URL}/api/grading/${debateId}/results`);
      if (!response.ok) {
        // If results aren't ready, trigger grading
        await fetch(`${API_URL}/api/grading/${debateId}`, {
          method: 'POST'
        });
        // Wait a bit and try again
        setTimeout(fetchGradingResults, 3000);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setGradingResults(data.data);
      }
    } catch (error) {
      console.error('Error fetching grading results:', error);
    }
  };
  
  // Format transcriptions for the TranscriptionCard
  const formatTranscriptions = () => {
    const proTranscript = transcriptions
      .filter(t => t.role === 'pro')
      .map(t => ({
        title: t.user?.username || t.user?.email || 'Pro Speaker',
        timestamp: new Date(t.created_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        text: t.transcript || ''
      }));

    const conTranscript = transcriptions
      .filter(t => t.role === 'con')
      .map(t => ({
        title: t.user?.username || t.user?.email || 'Con Speaker',
        timestamp: new Date(t.created_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        text: t.transcript || ''
      }));

    return { proTranscript, conTranscript };
  };
  
  if (loading) {
    return <div className="loading">Loading debate results...</div>;
  }
  
  if (error) {
    return (
      <div className="error-container">
        <div className="card">
          <h2>Error</h2>
          <p>{error}</p>
          <Link to="/debates" className="btn">Back to Debates</Link>
        </div>
      </div>
    );
  }
  
  const { proTranscript, conTranscript } = formatTranscriptions();

  return (
    <div className="debate-results-page">
      {debate && (
        <DebateHero
          title={debate.topic}
          description={debate.description}
          date={debate.scheduled_time}
          startTime={debate.scheduled_time}
          endTime={debate.end_time}
          duration="1h 30m"
          participants={2}
          winner={winner ? getSideTitle(winner.toLowerCase() === 'ai' ? 'pro' : 'con') : null}
        />
      )}
      
      {winner && (
        <div className="winner-announcement">
          <h2>{winner} has been declared the winner!</h2>
        </div>
      )}
      
      <div className="score-cards-container">
        {transcriptions.length > 0 ? (
          <>
            <ScoreCard
              position="Pro Position"
              username={getSideTitle('pro')}
              title="AI Ethics Researcher"
              scores={{
                argument_quality: scores.ai * 10,
                communication_skills: scores.ai * 10,
                topic_understanding: scores.ai * 10,
                total: scores.ai * 10
              }}
              isWinner={winner?.toLowerCase() === 'ai'}
            />
            <ScoreCard
              position="Con Position"
              username={getSideTitle('con')}
              title="Debate Participant"
              scores={{
                argument_quality: scores.human * 10,
                communication_skills: scores.human * 10,
                topic_understanding: scores.human * 10,
                total: scores.human * 10
              }}
              isWinner={winner?.toLowerCase() === 'human'}
            />
          </>
        ) : (
          <div className="no-transcriptions-message" style={{ textAlign: 'center', margin: '2rem 0' }}>
            {transcriptionStatus === 'processing' ? (
              <>
                <h3>Transcriptions are being processed</h3>
                <p>Please wait while we process the debate recordings. This may take a few minutes.</p>
                <div className="loading-spinner" style={{ margin: '20px auto' }}>⌛</div>
              </>
            ) : (
              <>
                <h3>No transcriptions available for this debate</h3>
                <p>Transcriptions will appear here once the debate is completed and recordings are processed.</p>
              </>
            )}
          </div>
        )}
      </div>
      
      {transcriptions.length > 0 && (
        <TranscriptionCard
          proTranscript={proTranscript}
          conTranscript={conTranscript}
        />
      )}
      
      <div className="actions">
        <Link to="/debates" className="btn">Back to Debates</Link>
      </div>
      
      {/* Debug information section to help track transcription issues */}
      <div className="debug-section" style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h3>Debug Information</h3>
        <p>Debate ID: {debateId}</p>
        <p>Found Transcriptions: {transcriptions.length}</p>
        
        {transcriptions.length > 0 ? (
          <div>
            <h4>Transcription Details:</h4>
            {transcriptions.map((t, index) => (
              <div key={index} style={{ marginBottom: '1rem', padding: '0.5rem', border: '1px solid #eee' }}>
                <p>Role: {t.role}</p>
                <p>User ID: {t.user_id}</p>
                <p>Created: {new Date(t.created_at).toLocaleString()}</p>
                <p>Transcript Length: {t.transcript?.length || 0} chars</p>
                <details>
                  <summary>Show Transcript</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                    {t.transcript || 'No transcript content'}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p>No transcriptions found. Check that:</p>
            <ol>
              <li>The debate has been completed</li>
              <li>Recording was started during the debate</li>
              <li>The recording was successfully uploaded</li>
              <li>The transcription service processed the audio</li>
            </ol>
          </div>
        )}
        
        <details>
          <summary>Debug Data</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default DebateResultsPage; 