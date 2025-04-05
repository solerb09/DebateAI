/**
 * Service for handling transcription requests
 */
const transcriptionService = {
  /**
   * Upload audio recording for transcription
   * @param {Blob} audioBlob - The audio recording blob
   * @param {string} debateId - ID of the debate
   * @param {string} role - Role of the speaker ('pro' or 'con')
   * @param {string} userId - User ID of the speaker
   * @returns {Promise<Object>} - Response from the server
   */
  uploadRecording: async (audioBlob, debateId, role, userId) => {
    try {
      console.log(`[TRANSCRIPTION] === UPLOADING RECORDING ===`);
      console.log(`[TRANSCRIPTION] Debate ID: ${debateId}`);
      console.log(`[TRANSCRIPTION] Speaker: ${role} (User ID: ${userId})`);
      console.log(`[TRANSCRIPTION] Audio blob size: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      
      // Create a FormData object for the file upload
      const formData = new FormData();
      formData.append('audio', audioBlob, `debate_${debateId}_${role}_${userId}.webm`);
      formData.append('debateId', debateId);
      formData.append('role', role);
      formData.append('userId', userId);
      
      console.log('[TRANSCRIPTION] FormData created successfully');
      
      // Upload the recording to the server
      console.log('[TRANSCRIPTION] Sending POST request to /api/transcription/upload');
      
      let response;
      try {
        response = await fetch('/api/transcription/upload', {
          method: 'POST',
          body: formData,
        });
      } catch (networkError) {
        console.error('[TRANSCRIPTION] Network error during upload:', networkError);
        throw new Error(`Network error: ${networkError.message}`);
      }
      
      console.log(`[TRANSCRIPTION] Server responded with status: ${response.status}`);
      
      // Handle non-JSON responses (like HTML error pages)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[TRANSCRIPTION] Server returned non-JSON response');
        const text = await response.text();
        console.error('[TRANSCRIPTION] Response content:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
        throw new Error(`Server returned non-JSON response with status ${response.status}`);
      }
      
      // Parse JSON response
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('[TRANSCRIPTION] Failed to parse JSON response:', jsonError);
        const text = await response.text();
        console.error('[TRANSCRIPTION] Response content that failed JSON parsing:', text.substring(0, 500));
        throw new Error(`Invalid JSON response: ${jsonError.message}`);
      }
      
      if (!response.ok) {
        console.error('[TRANSCRIPTION] Server error:', result);
        throw new Error(result.error || `Server error: ${response.status}`);
      }
      
      console.log('[TRANSCRIPTION] Upload successful:', result);
      console.log('[TRANSCRIPTION] === UPLOAD COMPLETE ===');
      
      return result;
    } catch (error) {
      console.error('[TRANSCRIPTION] Error in uploadRecording:', error);
      // Return a standardized error response
      return {
        success: false,
        error: error.message || 'Unknown error during transcription upload'
      };
    }
  },
  
  /**
   * Get transcriptions for a debate
   * @param {string} debateId - ID of the debate
   * @returns {Promise<Object>} - Transcriptions data
   */
  getTranscriptions: async (debateId) => {
    try {
      console.log(`[TRANSCRIPTION] === FETCHING TRANSCRIPTIONS ===`);
      console.log(`[TRANSCRIPTION] Debate ID: ${debateId}`);
      
      const response = await fetch(`/api/transcription/${debateId}`);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[TRANSCRIPTION] Server returned non-JSON response');
        throw new Error(`Server returned non-JSON response with status ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('[TRANSCRIPTION] Server error:', result);
        throw new Error(result.error || `Server error: ${response.status}`);
      }
      
      console.log(`[TRANSCRIPTION] Fetched ${result.transcriptions ? result.transcriptions.length : 0} transcriptions`);
      console.log('[TRANSCRIPTION] === FETCH COMPLETE ===');
      
      return result;
    } catch (error) {
      console.error('[TRANSCRIPTION] Error in getTranscriptions:', error);
      return {
        success: false,
        error: error.message || 'Unknown error fetching transcriptions',
        transcriptions: []
      };
    }
  },
  
  /**
   * Get a combined summary for a debate
   * @param {string} debateId - ID of the debate
   * @returns {Promise<Object>} - Debate summary
   */
  getDebateSummary: async (debateId) => {
    try {
      console.log(`[TRANSCRIPTION] === FETCHING SUMMARY ===`);
      console.log(`[TRANSCRIPTION] Debate ID: ${debateId}`);
      
      const response = await fetch(`/api/transcription/${debateId}/summary`);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[TRANSCRIPTION] Server returned non-JSON response');
        throw new Error(`Server returned non-JSON response with status ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('[TRANSCRIPTION] Server error:', result);
        throw new Error(result.error || `Server error: ${response.status}`);
      }
      
      console.log('[TRANSCRIPTION] Summary fetched successfully');
      console.log('[TRANSCRIPTION] === SUMMARY FETCH COMPLETE ===');
      
      return result;
    } catch (error) {
      console.error('[TRANSCRIPTION] Error in getDebateSummary:', error);
      return {
        success: false,
        error: error.message || 'Unknown error fetching debate summary',
        summary: null
      };
    }
  }
};

export default transcriptionService; 