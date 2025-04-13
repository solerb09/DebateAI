import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Assuming this context provides user info if needed

// Shadcn UI Components (using relative paths as Vite alias setup isn't confirmed)
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { ScrollArea } from "../components/ui/scroll-area";

// Lucide Icons
import { Calendar, Clock, Users, Download, Share2 } from "lucide-react";

// Utility for class names (if shadcn added it)
import { cn } from "../lib/utils"; // Assuming shadcn created this

/**
 * Page to view debate results after the debate is complete, using Shadcn UI and Tailwind.
 */
const DebateResultsPage = () => {
  const { id: debateId } = useParams();
  const { authState } = useAuth(); // Use if needed for user-specific actions
  const [debate, setDebate] = useState(null);
  const [transcriptions, setTranscriptions] = useState([]);
  // Store detailed scores if available, otherwise calculate overall
  const [proScores, setProScores] = useState({ overall: 0, argumentQuality: 0, evidenceUse: 0, rebuttalEffectiveness: 0, speakingSkills: 0 });
  const [conScores, setConScores] = useState({ overall: 0, argumentQuality: 0, evidenceUse: 0, rebuttalEffectiveness: 0, speakingSkills: 0 });
  const [winnerRole, setWinnerRole] = useState(null); // 'pro', 'con', or null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch debate details and transcriptions
  useEffect(() => {
    if (!debateId) return;

    const fetchDebateData = async () => {
      try {
        setLoading(true);
        setError(null); // Reset error on new fetch
        console.log(`[RESULTS] Fetching data for Debate ID: ${debateId}`);

        // Fetch debate details
        const debateResponse = await fetch(`/api/debates/${debateId}`);
        if (!debateResponse.ok) throw new Error(`Debate fetch failed: ${debateResponse.status}`);
        const debateData = await debateResponse.json();
        setDebate(debateData);
        console.log("[RESULTS] Debate data:", debateData);

        // Fetch transcriptions
        const transcriptResponse = await fetch(`/api/audio/transcriptions/${debateId}`);
        const transcriptData = await transcriptResponse.json();

        if (transcriptResponse.ok && transcriptData.success && transcriptData.data) {
          console.log(`[RESULTS] Found ${transcriptData.data.length} transcriptions`);
          setTranscriptions(transcriptData.data);
          processTranscriptionData(transcriptData.data, debateData); // Pass debateData if needed for participant info
        } else {
          console.warn("[RESULTS] No transcription data found or fetch error:", transcriptData);
          setTranscriptions([]);
          // Reset scores if no transcriptions
          setProScores({ overall: 0, argumentQuality: 0, evidenceUse: 0, rebuttalEffectiveness: 0, speakingSkills: 0 });
          setConScores({ overall: 0, argumentQuality: 0, evidenceUse: 0, rebuttalEffectiveness: 0, speakingSkills: 0 });
          setWinnerRole(null);
        }

        setLoading(false);
      } catch (error) {
        console.error('[RESULTS] Error fetching debate data:', error);
        setError(`Failed to load debate information: ${error.message}`);
        setLoading(false);
      }
    };

    fetchDebateData();
  }, [debateId]);

  // Process transcription data to extract scores and determine winner
  const processTranscriptionData = (transcripts, debateInfo) => {
    if (!transcripts || transcripts.length === 0) {
      console.log(`[RESULTS] No transcriptions to process`);
      return;
    }

    try {
      const proTranscription = transcripts.find(t => t.role === 'pro');
      const conTranscription = transcripts.find(t => t.role === 'con');

      console.log("[RESULTS] Processing transcriptions for scoring...");

      // Placeholder for actual scoring logic - replace with real evaluation if available
      // For now, using simple length-based + random scoring for demonstration
      let calculatedProScores = { overall: 0, argumentQuality: 0, evidenceUse: 0, rebuttalEffectiveness: 0, speakingSkills: 0 };
      let calculatedConScores = { overall: 0, argumentQuality: 0, evidenceUse: 0, rebuttalEffectiveness: 0, speakingSkills: 0 };
      let winner = null;

      if (proTranscription && conTranscription) {
        const proLength = proTranscription.transcript?.length || 0;
        const conLength = conTranscription.transcript?.length || 0;

        // Mock detailed scores (replace with actual logic)
        calculatedProScores = {
          overall: Math.min(10, Math.max(5, 7 + (proLength > conLength ? 1.5 : 0) + Math.random())).toFixed(1),
          argumentQuality: Math.min(10, Math.max(5, 7 + Math.random() * 3)).toFixed(1),
          evidenceUse: Math.min(10, Math.max(5, 6.5 + Math.random() * 3)).toFixed(1),
          rebuttalEffectiveness: Math.min(10, Math.max(5, 7 + Math.random() * 3)).toFixed(1),
          speakingSkills: Math.min(10, Math.max(5, 6.8 + Math.random() * 3)).toFixed(1),
        };
        calculatedConScores = {
          overall: Math.min(10, Math.max(5, 7 + (conLength > proLength ? 1.5 : 0) + Math.random())).toFixed(1),
          argumentQuality: Math.min(10, Math.max(5, 7 + Math.random() * 3)).toFixed(1),
          evidenceUse: Math.min(10, Math.max(5, 6.5 + Math.random() * 3)).toFixed(1),
          rebuttalEffectiveness: Math.min(10, Math.max(5, 7 + Math.random() * 3)).toFixed(1),
          speakingSkills: Math.min(10, Math.max(5, 6.8 + Math.random() * 3)).toFixed(1),
        };

        winner = parseFloat(calculatedProScores.overall) > parseFloat(calculatedConScores.overall) ? 'pro' : 'con';
        // Handle ties? For now, 'con' wins ties.
        if (parseFloat(calculatedProScores.overall) === parseFloat(calculatedConScores.overall)) winner = 'con'; // Example tie handling

        console.log(`[RESULTS] Scores calculated - Pro: ${calculatedProScores.overall}, Con: ${calculatedConScores.overall}`);
        console.log(`[RESULTS] Winner determined: ${winner}`);

      } else {
        console.warn("[RESULTS] Missing pro or con transcription, cannot calculate scores accurately.");
      }

      setProScores(calculatedProScores);
      setConScores(calculatedConScores);
      setWinnerRole(winner);

    } catch (error) {
      console.error('[RESULTS] Error processing transcription data:', error);
      // Reset scores on error
      setProScores({ overall: 0, argumentQuality: 0, evidenceUse: 0, rebuttalEffectiveness: 0, speakingSkills: 0 });
      setConScores({ overall: 0, argumentQuality: 0, evidenceUse: 0, rebuttalEffectiveness: 0, speakingSkills: 0 });
      setWinnerRole(null);
    }
  };

  // Helper to get participant info based on role
  const getParticipantInfo = (role) => {
    // Find the transcription associated with the role to get user details
    const transcription = transcriptions.find(t => t.role === role);
    const user = transcription?.user; // User object might be nested in transcription data

    // Fallback names if user data isn't available
    const defaultName = role === 'pro' ? "Pro Participant" : "Con Participant";
    const defaultTitle = role === 'pro' ? "Supporting Position" : "Opposing Position";

    return {
      name: user?.full_name || user?.email || defaultName,
      title: user?.title || defaultTitle, // Assuming a 'title' field might exist
      avatarSrc: user?.avatar_url || "/placeholder.svg?height=64&width=64", // Use placeholder if no avatar
      avatarFallback: (user?.full_name || defaultName).substring(0, 2).toUpperCase(),
    };
  };

  const proInfo = getParticipantInfo('pro');
  const conInfo = getParticipantInfo('con');

  // Helper to format date/time (replace with a robust library like date-fns if needed)
  const formatDebateTime = (startTime, endTime) => {
    if (!startTime || !endTime) return { date: "N/A", time: "N/A", duration: "N/A" };
    const start = new Date(startTime);
    const end = new Date(endTime);
    const optionsDate = { year: 'numeric', month: 'long', day: 'numeric' };
    const optionsTime = { hour: 'numeric', minute: 'numeric', hour12: true };

    const dateStr = start.toLocaleDateString(undefined, optionsDate);
    const timeStr = `${start.toLocaleTimeString(undefined, optionsTime)} - ${end.toLocaleTimeString(undefined, optionsTime)}`;

    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const durationStr = `${hours > 0 ? `${hours}h ` : ''}${minutes}m`;

    return { date: dateStr, time: timeStr, duration: durationStr };
  };

  const { date, time, duration } = formatDebateTime(debate?.start_time, debate?.end_time);

  // Render loading state
  if (loading) {
    return <div className="container max-w-4xl py-10 text-center">Loading debate results...</div>;
  }

  // Render error state
  if (error) {
    return (
      <div className="container max-w-4xl py-10">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Results</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link to="/debates">Back to Debates</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render main content
  return (
    <div className="container max-w-4xl py-10">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Debate Results</h1>
          {/* Assuming debate status is available */}
          <Badge variant={debate?.status === 'completed' ? 'secondary' : 'outline'}>
            {debate?.status || 'Status Unknown'}
          </Badge>
        </div>
        <p className="text-muted-foreground">Review the debate performance and transcript</p>
      </div>

      {/* Debate Info Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl">{debate?.topic || "Debate Topic Not Found"}</CardTitle>
          <CardDescription className="text-base">
            {debate?.description || "No description provided."}
          </CardDescription>
          <div className="flex flex-wrap gap-4 mt-2">
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{date}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{`${time} (${duration})`}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              {/* Assuming participant count is known or based on transcriptions */}
              <span>{transcriptions.length > 0 ? `${new Set(transcriptions.map(t => t.user_id)).size} Participants` : 'Participants N/A'}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {winnerRole && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(
                  winnerRole === 'pro' ? "text-green-700 border-green-200 bg-green-50" : "text-red-700 border-red-200 bg-red-50"
                )}>
                  Winner
                </Badge>
                <span className="font-medium">{winnerRole === 'pro' ? proInfo.name : conInfo.name} ({winnerRole === 'pro' ? 'Pro' : 'Con'} Position)</span>
              </div>
            )}
            {!winnerRole && transcriptions.length > 0 && (
               <div className="flex items-center gap-2">
                 <Badge variant="outline">Result Pending</Badge>
                 <span className="font-medium">Winner not determined yet.</span>
               </div>
            )}
             {!winnerRole && transcriptions.length === 0 && (
               <div className="flex items-center gap-2">
                 <Badge variant="outline">No Transcripts</Badge>
                 <span className="font-medium">Cannot determine winner.</span>
               </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" disabled={transcriptions.length === 0}>
                <Download className="h-4 w-4" />
                <span>Download Transcript</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-1">
                <Share2 className="h-4 w-4" />
                <span>Share Results</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participant Score Cards */}
      <div className="grid gap-8 md:grid-cols-2 mb-8">
        {/* Pro Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Pro Position</CardTitle>
              {winnerRole === 'pro' && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Winner
                </Badge>
              )}
               {winnerRole === 'con' && (
                 <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"> {/* Example style for runner-up */}
                   Runner-up
                 </Badge>
               )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={proInfo.avatarSrc} alt={proInfo.name} />
                <AvatarFallback>{proInfo.avatarFallback}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{proInfo.name}</h3>
                <p className="text-sm text-muted-foreground">{proInfo.title}</p>
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Overall Score</span>
                    <span className="text-sm font-medium">{proScores.overall}/10</span>
                  </div>
                  <Progress value={proScores.overall * 10} className="h-2" />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Argument Quality</span>
                <span className="text-sm font-medium">{proScores.argumentQuality}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Evidence Use</span>
                <span className="text-sm font-medium">{proScores.evidenceUse}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Rebuttal Effectiveness</span>
                <span className="text-sm font-medium">{proScores.rebuttalEffectiveness}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Speaking Skills</span>
                <span className="text-sm font-medium">{proScores.speakingSkills}/10</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Con Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Con Position</CardTitle>
               {winnerRole === 'con' && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Winner
                </Badge>
              )}
               {winnerRole === 'pro' && (
                 <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"> {/* Example style for runner-up */}
                   Runner-up
                 </Badge>
               )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={conInfo.avatarSrc} alt={conInfo.name} />
                <AvatarFallback>{conInfo.avatarFallback}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{conInfo.name}</h3>
                <p className="text-sm text-muted-foreground">{conInfo.title}</p>
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Overall Score</span>
                    <span className="text-sm font-medium">{conScores.overall}/10</span>
                  </div>
                  <Progress value={conScores.overall * 10} className="h-2" />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Argument Quality</span>
                <span className="text-sm font-medium">{conScores.argumentQuality}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Evidence Use</span>
                <span className="text-sm font-medium">{conScores.evidenceUse}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Rebuttal Effectiveness</span>
                <span className="text-sm font-medium">{conScores.rebuttalEffectiveness}/10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Speaking Skills</span>
                <span className="text-sm font-medium">{conScores.speakingSkills}/10</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transcript Section */}
      <Card>
        <CardHeader>
          <CardTitle>Debate Transcript</CardTitle>
          <CardDescription>
            {transcriptions.length > 0 ? "Complete record of the debate conversation" : "No transcriptions available for this debate."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transcriptions.length > 0 ? (
            <Tabs defaultValue="full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="full">Full Transcript</TabsTrigger>
                <TabsTrigger value="pro">Pro Arguments</TabsTrigger>
                <TabsTrigger value="con">Con Arguments</TabsTrigger>
                {/* Add Key Points tab if logic exists */}
                {/* <TabsTrigger value="key">Key Points</TabsTrigger> */}
              </TabsList>

              {/* Full Transcript Tab */}
              <TabsContent value="full" className="mt-4">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="space-y-6">
                    {transcriptions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((t, index) => {
                       const speakerInfo = getParticipantInfo(t.role);
                       const timestamp = new Date(t.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: true });
                       let badgeClass = "bg-gray-50 text-gray-700 border-gray-200"; // Default/Moderator?
                       if (t.role === 'pro') badgeClass = "bg-green-50 text-green-700 border-green-200";
                       if (t.role === 'con') badgeClass = "bg-red-50 text-red-700 border-red-200";

                       return (
                         <div key={t.id || index}>
                           <div className="flex items-center gap-2 mb-1">
                             <Badge variant="outline" className={badgeClass}>
                               {t.role.charAt(0).toUpperCase() + t.role.slice(1)}
                             </Badge>
                             <span className="text-sm font-medium">{speakerInfo.name} ({timestamp})</span>
                           </div>
                           <p className="text-sm">{t.transcript || "[No text recorded]"}</p>
                         </div>
                       );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Pro Arguments Tab */}
              <TabsContent value="pro" className="mt-4">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="space-y-6">
                    {transcriptions.filter(t => t.role === 'pro').sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((t, index) => {
                       const speakerInfo = getParticipantInfo(t.role);
                       const timestamp = new Date(t.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: true });
                       return (
                         <div key={t.id || index}>
                           <div className="flex items-center gap-2 mb-1">
                             <span className="text-sm font-medium">{speakerInfo.name} ({timestamp})</span>
                           </div>
                           <p className="text-sm">{t.transcript || "[No text recorded]"}</p>
                         </div>
                       );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Con Arguments Tab */}
              <TabsContent value="con" className="mt-4">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="space-y-6">
                     {transcriptions.filter(t => t.role === 'con').sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((t, index) => {
                       const speakerInfo = getParticipantInfo(t.role);
                       const timestamp = new Date(t.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: true });
                       return (
                         <div key={t.id || index}>
                           <div className="flex items-center gap-2 mb-1">
                             <span className="text-sm font-medium">{speakerInfo.name} ({timestamp})</span>
                           </div>
                           <p className="text-sm">{t.transcript || "[No text recorded]"}</p>
                         </div>
                       );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Key Points Tab (Add content if logic exists) */}
              {/* <TabsContent value="key" className="mt-4">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="space-y-6">
                    // Key points rendering logic here
                  </div>
                </ScrollArea>
              </TabsContent> */}
            </Tabs>
          ) : (
            <p className="text-muted-foreground p-4 text-center">Transcripts are not yet available for this debate.</p>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link to="/debates">Back to Debates</Link>
          </Button>
          <Button asChild>
            <Link to="/">Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default DebateResultsPage;