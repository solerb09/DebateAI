const debateRoutes = require('./routes/debateRoutes');
const transcriptionRoutes = require('./routes/transcriptionRoutes');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/debates', debateRoutes);
app.use('/api/transcription', transcriptionRoutes); 