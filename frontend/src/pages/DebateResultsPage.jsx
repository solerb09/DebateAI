import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DebateHero from '../components/DebateHero';
import ScoreCard from '../components/ScoreCard';
import TranscriptionCard from '../components/TranscriptionCard';

const API_URL = import.meta.env.VITE_API_URL;

// Constants for polling
const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLLING_ATTEMPTS = 60; // 5 minutes maximum

/**
 * Page to view debate results after the debate is complete
 */
const DebateResultsPage = () => {
  const { id: debateId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [debate, setDebate] = useState(null);
  const [transcriptions, setTranscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [transcriptionStatus, setTranscriptionStatus] = useState('idle');
  const [participants, setParticipants] = useState([]);
  
  // New state for grading
  const [gradingStatus, setGradingStatus] = useState('pending');
  const [gradingError, setGradingError] = useState(null);
  const [pollingCount, setPollingCount] = useState(0);
  const [pollingTimer, setPollingTimer] = useState(null);

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
        
        // Set initial grading status from debate data
        if (debateData.scoring_status) {
          console.log("[RESULTS] Initial scoring status:", debateData.scoring_status);
          setGradingStatus(debateData.scoring_status);
          
          // If already processing, start polling
          if (debateData.scoring_status === 'processing') {
            startPolling();
          }
        }
        
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
              }
            } else {
              console.warn("[RESULTS] Error fetching transcriptions:", responseData);
              debugData.transcriptionError = responseData;
              setTranscriptionStatus('error');
              setTranscriptions([]);
            }
          } else {
            console.warn("[RESULTS] Error fetching transcriptions:", responseData);
            debugData.transcriptionError = responseData;
            setTranscriptionStatus('error');
            setTranscriptions([]);
          }
        } catch (transcriptError) {
          console.warn('[RESULTS] Error fetching transcription data:', transcriptError);
          debugData.transcriptionException = transcriptError.toString();
          
          setTranscriptions([]);
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
  
  // Get the title for each side
  const getSideTitle = (role) => {
    if (transcriptions.length > 0) {
      if (role === 'pro') {
        const proTranscription = transcriptions.find(t => t.role === 'pro');
        return proTranscription?.user?.username || proTranscription?.user?.email || 'Pro Speaker';
      } else {
        const conTranscription = transcriptions.find(t => t.role === 'con');
        return conTranscription?.user?.username || conTranscription?.user?.email || 'Con Speaker';
      }
    }
    return role === 'pro' ? 'Pro Speaker' : 'Con Speaker';
  };
  
  // Fetch grading status
  const fetchGradingStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/grading/${debateId}/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch grading status');
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch grading status');
      }

      const { status, scores } = data.data;
      setGradingStatus(status);

      if (status === 'completed' && scores) {
        // Transform scores into participants array
        const participantsData = Object.entries(scores).map(([side, data]) => {
          const transcription = transcriptions.find(t => t.role === side);
          return {
            id: transcription?.user_id,  // Get user_id from matching transcription
            side: side,
            username: transcription?.user?.username || transcription?.user?.email || (side === 'pro' ? 'Pro Speaker' : 'Con Speaker'),
            score_breakdown: {
              argument_quality: {
                score: data.score_breakdown.scores.argument_quality,
                explanation: data.score_breakdown.explanations.argument_quality
              },
              communication_skills: {
                score: data.score_breakdown.scores.communication_skills,
                explanation: data.score_breakdown.explanations.communication_skills
              },
              topic_understanding: {
                score: data.score_breakdown.scores.topic_understanding,
                explanation: data.score_breakdown.explanations.topic_understanding
              },
              total_score: data.score_breakdown.scores.total,
              summary: data.score_breakdown.summary
            },
            is_winner: data.is_winner
          };
        });

        
        setParticipants(participantsData);
        
        // Remove setting gradingResults since we're not using it anymore
        if (pollingTimer) {
          clearInterval(pollingTimer);
          setPollingTimer(null);
        }
      } else if (status === 'failed') {
        setGradingError('Grading process failed');
        if (pollingTimer) {
          clearInterval(pollingTimer);
          setPollingTimer(null);
        }
      }
    } catch (error) {
      console.error('Error fetching grading status:', error);
      setGradingError(error.message);
    }
  }, [debateId, pollingTimer, transcriptions]);

  // Start grading process
  const startGrading = async () => {
    try {
      setGradingError(null);
      
      // Double check current status before starting
      await fetchGradingStatus();
      
      // Only proceed if we're in a valid state to start
      if (gradingStatus !== 'pending' && gradingStatus !== 'failed') {
        console.log("[GRADING] Cannot start grading, current status:", gradingStatus);
        return;
      }

      console.log("[GRADING] Starting grading process...");
      const response = await fetch(`${API_URL}/api/grading/${debateId}/start`, {
        method: 'POST'
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to start grading');
      }

      console.log("[GRADING] Successfully started grading process");
      setGradingStatus('processing');
      startPolling();
    } catch (error) {
      console.error('[GRADING] Error starting grading:', error);
      setGradingError(error.message);
      // Don't set status to failed here, as it might have been updated by the backend
      await fetchGradingStatus(); // Refresh the status from backend
    }
  };

  // Start polling for grading status
  const startPolling = useCallback(() => {
    // If we already have a polling timer, don't start another one
    if (pollingTimer) {
      console.log("[GRADING] Polling already in progress, skipping...");
      return;
    }

    console.log("[GRADING] Starting new polling interval");
    setPollingCount(0);
    
    // Start new polling interval
    const timer = setInterval(async () => {
      setPollingCount(count => {
        const newCount = count + 1;
        
        // Stop polling if we've reached max attempts
        if (newCount >= MAX_POLLING_ATTEMPTS) {
          console.log("[GRADING] Max polling attempts reached, stopping");
          clearInterval(timer);
          setPollingTimer(null);
          setGradingError('Grading process timed out');
          return count;
        }
        
        return newCount;
      });

      await fetchGradingStatus();
    }, POLLING_INTERVAL);

    setPollingTimer(timer);

    // Initial fetch
    fetchGradingStatus();
  }, [fetchGradingStatus, pollingTimer]);

  // Check grading status when transcriptions are ready
  useEffect(() => {
    if (transcriptionStatus === 'completed' && transcriptions.length > 0) {
      // Skip if already completed
      if (gradingStatus === 'completed') {
        return;
      }

      // First check current status
      fetchGradingStatus().then(() => {
        // Skip further processing if completed
        if (gradingStatus === 'completed') {
          return;
        }
        
        switch (gradingStatus) {
          case 'pending':
          case 'failed':
            console.log("[GRADING] Starting grading process...");
            startGrading();
            break;
          case 'processing':
            if (!pollingTimer) {
              console.log("[GRADING] Grading in progress, starting polling...");
              startPolling();
            }
            break;
          default:
            console.log("[GRADING] Unknown status:", gradingStatus);
        }
      }).catch(error => {
        console.error("[GRADING] Error checking grading status:", error);
        setGradingError(error.message);
      });
    }
  }, [transcriptionStatus, transcriptions.length, gradingStatus, startGrading, startPolling, pollingTimer, fetchGradingStatus]);

  // Cleanup polling on unmount or when status changes to completed/failed
  useEffect(() => {
    if (gradingStatus === 'completed' || gradingStatus === 'failed') {
      if (pollingTimer) {
        console.log("[GRADING] Stopping polling due to status:", gradingStatus);
        clearInterval(pollingTimer);
        setPollingTimer(null);
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (pollingTimer) {
        console.log("[GRADING] Cleaning up polling timer");
        clearInterval(pollingTimer);
      }
    };
  }, [gradingStatus, pollingTimer]);

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
          winner={participants.find(p => p.is_winner)?.username}
        />
      )}
      
      <div className="score-cards-container">
        {transcriptions.length > 0 ? (
          <>
            {participants.length > 0 ? (
              participants.map((participant) => (
                <ScoreCard
                  key={participant.id}
                  participant={participant}
                  score_breakdown={participant.score_breakdown}
                  isWinner={participant.is_winner}
                />
              ))
            ) : (
              <div className="loading-scores">
                <p>Waiting for debate scores...</p>
              </div>
            )}
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
      
      {transcriptionStatus === 'processing' && (
        <div className="status-message">
          <p>Processing transcriptions...</p>
        </div>
      )}
      
      {transcriptionStatus === 'error' && (
        <div className="status-message error">
          <p>Error loading transcriptions. Please try again later.</p>
        </div>
      )}
      
      {transcriptionStatus === 'completed' && transcriptions.length > 0 && (
        <TranscriptionCard
          proTranscript={proTranscript}
          conTranscript={conTranscript}
        />
      )}
      
      {gradingStatus === 'processing' && (
        <div className="grading-status">
          <p>AI is analyzing the debate...</p>
          <div className="loading-spinner">⌛</div>
        </div>
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