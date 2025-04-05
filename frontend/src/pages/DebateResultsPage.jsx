import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Page to view debate results after the debate is complete
 */
const DebateResultsPage = () => {
  const { id: debateId } = useParams();
  const { authState } = useAuth();
  const [debate, setDebate] = useState(null);
  const [transcriptions, setTranscriptions] = useState([]);
  const [scores, setScores] = useState({ ai: 0, human: 0 });
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  
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
        const debateResponse = await fetch(`/api/debates/${debateId}`);
        
        if (!debateResponse.ok) {
          console.error(`[RESULTS] Error ${debateResponse.status} fetching debate details`);
          throw new Error(`Server responded with ${debateResponse.status}`);
        }
        
        const debateData = await debateResponse.json();
        setDebate(debateData);
        console.log("[RESULTS] Debate data:", debateData);
        
        const debugData = { debateInfo: debateData };
        
        // Fetch transcriptions
        try {
          console.log(`[RESULTS] Fetching transcriptions...`);
          const transcriptResponse = await fetch(`/api/audio/transcriptions/${debateId}`);
          const responseData = await transcriptResponse.json();
          
          if (transcriptResponse.ok) {
            console.log("[RESULTS] Transcription response status:", transcriptResponse.status);
            debugData.transcriptionResponse = responseData;
            
            if (responseData.success && responseData.data && responseData.data.length > 0) {
              console.log(`[RESULTS] Found ${responseData.data.length} transcriptions`);
              
              // Log details about each transcription
              responseData.data.forEach((transcript, index) => {
                console.log(`[RESULTS] Transcription ${index + 1}:`);
                console.log(`[RESULTS] - Role: ${transcript.role}`);
                console.log(`[RESULTS] - User ID: ${transcript.user_id}`);
                console.log(`[RESULTS] - User Name: ${transcript.users?.display_name || 'Unknown'}`);
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
              
              // Use mock scores if no transcriptions are found
              console.log(`[RESULTS] Using mock scores due to missing transcriptions`);
              setScores({ ai: 86, human: 72 });
              setWinner('AI');
            }
          } else {
            console.warn("[RESULTS] Error fetching transcriptions:", responseData);
            debugData.transcriptionError = responseData;
            
            // Use mock scores if transcription fetch fails
            console.log(`[RESULTS] Using mock scores due to fetch error`);
            setScores({ ai: 86, human: 72 });
            setWinner('AI');
          }
        } catch (transcriptError) {
          console.warn('[RESULTS] Error fetching transcription data:', transcriptError);
          debugData.transcriptionException = transcriptError.toString();
          
          // Use mock scores if transcription fetch fails
          console.log(`[RESULTS] Using mock scores due to exception`);
          setScores({ ai: 86, human: 72 });
          setWinner('AI');
        }
        
        setDebugInfo(debugData);
        setLoading(false);
        console.log(`[RESULTS] ========= RESULTS LOADING COMPLETE =========`);
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
        
        const winnerName = proScore > conScore ? 'AI' : 'Human';
        setWinner(winnerName);
        console.log(`[RESULTS] Scores calculated - Pro: ${proScore}, Con: ${conScore}`);
        console.log(`[RESULTS] Winner determined: ${winnerName}`);
      } else {
        console.warn("[RESULTS] Missing either pro or con transcription, using default scores");
        
        // Use default scores
        setScores({ ai: 86, human: 72 });
        setWinner('AI');
      }
    } catch (error) {
      console.error('[RESULTS] Error processing transcription data:', error);
      // Keep default values
      setScores({ ai: 86, human: 72 });
      setWinner('AI');
    }
  };
  
  // Extract key points from transcriptions
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
        
        if (extractedPoints.length >= 3) {
          return extractedPoints;
        }
      }
      
      // Fallback to mock data
      console.log(`[TRANSCRIPTION] Using default key points for ${role}`);
      return getDefaultKeyPoints(role);
    } catch (error) {
      console.error(`[TRANSCRIPTION] Error getting key points for ${role}:`, error);
      return getDefaultKeyPoints(role);
    }
  };
  
  // Default key points if real data is not available
  const getDefaultKeyPoints = (role) => {
    if (role === 'pro') {
      return [
        "Advancements in AI can significantly improve efficiency and productivity across various industries.",
        "AI has the potential to solve complex problems faster than humans.",
        "Ethical AI development can ensure that technology benefits society.",
        "Machine learning allows AI to continuously improve and adapt.",
        "AI can augment human capabilities without replacing jobs."
      ];
    } else {
      return [
        "Human intuition and creativity are irreplaceable in decision-making processes.",
        "Relying too heavily on AI could lead to unintended consequences.",
        "Ethical concerns around AI are difficult to address effectively.",
        "Human oversight is necessary to ensure AI systems are aligned with societal values.",
        "Jobs and industries could be disrupted by AI, leading to economic inequality."
      ];
    }
  };
  
  // Get the title for each side
  const getSideTitle = (role) => {
    // If we have real transcription data with roles, use those
    if (transcriptions.length > 0) {
      if (role === 'pro') {
        const proTranscription = transcriptions.find(t => t.role === 'pro');
        return proTranscription?.users?.display_name || 'AI';
      } else {
        const conTranscription = transcriptions.find(t => t.role === 'con');
        return conTranscription?.users?.display_name || 'Human';
      }
    }
    
    // Default titles
    return role === 'pro' ? 'AI' : 'Human';
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
  
  return (
    <div className="debate-results-page">
      <h1 className="page-title">Debate Results</h1>
      
      {winner && (
        <div className="winner-announcement">
          <h2>{winner} has been declared the winner!</h2>
        </div>
      )}
      
      <div className="results-container">
        <div className="result-card">
          <h2>{getSideTitle('pro')}</h2>
          <div className="score">{scores.ai}</div>
          <h3>Key Points</h3>
          <ul className="key-points">
            {getKeyPoints('pro').map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </div>
        
        <div className="result-card">
          <h2>{getSideTitle('con')}</h2>
          <div className="score">{scores.human}</div>
          <h3>Key Points</h3>
          <ul className="key-points">
            {getKeyPoints('con').map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="actions">
        <Link to="/debates" className="btn">
          Back to Debates
        </Link>
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