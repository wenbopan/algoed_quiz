// Live Quiz Session Manager
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion, 
  arrayRemove,
  serverTimestamp,
  deleteDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';

class LiveQuizManager {
  constructor() {
    this.sessionListeners = new Map();
    this.participantListeners = new Map();
    this.questionStartTime = null;
  }

  // Generate unique session code
  generateSessionCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Create a new live quiz session (Admin)
  async createLiveSession(quizId, hostId, hostName, settings = {}) {
    const sessionCode = this.generateSessionCode();
    const sessionId = `live_${Date.now()}_${sessionCode}`;

    try {
      // Fetch quiz data to get total questions count
      const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
      if (!quizDoc.exists()) {
        return { success: false, error: 'Quiz not found' };
      }
      
      const quizData = quizDoc.data();
      const totalQuestions = quizData.questions?.length || 0;

      const sessionData = {
        sessionId: sessionId,
        sessionCode: sessionCode,
        quizId: quizId,
        totalQuestions: totalQuestions, // Store total questions count
        hostId: hostId,
        hostName: hostName,
        status: 'waiting', // waiting, active, paused, completed, editing
        currentQuestionIndex: -1, // -1 means not started yet
        questionStartTime: null,
        questionTimeLimit: settings.questionTimeLimit || 30, // seconds
        participants: [],
        participantCount: 0,
        createdAt: serverTimestamp(),
        isEditing: false, // Flag for question editing mode
        editingQuestionIndex: null,
        settings: {
          showAnswersAfterEach: settings.showAnswersAfterEach || true,
          allowLateJoin: settings.allowLateJoin || false,
          shuffleQuestions: settings.shuffleQuestions || false,
          autoProgressQuestions: settings.autoProgressQuestions || false,
          ...settings
        }
      };

      await setDoc(doc(db, 'liveQuizSessions', sessionId), sessionData);
      console.log('Live session created:', sessionData);
      return { success: true, sessionId, sessionCode, sessionData };
    } catch (error) {
      console.error('Error creating live session:', error);
      return { success: false, error: error.message };
    }
  }

  // Join a live session (Student)
  async joinSession(sessionCode, userId, userName) {
    try {
      console.log('🔍 JOIN SESSION DEBUG:', { sessionCode, userId, userName });
      
      // Find session by code
      const sessionsRef = collection(db, 'liveQuizSessions');
      const sessions = await getDocs(query(sessionsRef, where('sessionCode', '==', sessionCode)));
      
      if (sessions.empty) {
        console.log('❌ Session not found for code:', sessionCode);
        return { success: false, error: 'Session not found' };
      }

      const sessionDoc = sessions.docs[0];
      const sessionData = sessionDoc.data();
      const sessionId = sessionData.sessionId;

      console.log('✅ Session found:', { sessionId, status: sessionData.status, participants: sessionData.participants });

      // Check if session allows joining
      if (sessionData.status === 'completed') {
        console.log('❌ Session has ended');
        return { success: false, error: 'Session has ended' };
      }

      if (sessionData.status === 'active' && !sessionData.settings.allowLateJoin) {
        console.log('❌ Session already started, late join not allowed');
        return { success: false, error: 'Session has already started' };
      }

      // Check if user already joined - if so, redirect them back to the session
      console.log('🔍 Checking if user already joined. Current participants:', sessionData.participants);
      console.log('🔍 User ID to check:', userId);

      if (sessionData.participants.includes(userId)) {
        console.log('User already in session, redirecting back to session');
        return { success: true, sessionId, sessionData, alreadyJoined: true };
      }

      // Add user to session participants
      await updateDoc(doc(db, 'liveQuizSessions', sessionId), {
        participants: arrayUnion(userId),
        participantCount: sessionData.participantCount + 1
      });

      // Create participant document in liveParticipants collection
      const participantData = {
        sessionId: sessionId,
        userId: userId,
        userName: userName,
        joinedAt: serverTimestamp(),
        currentScore: 0,
        questionsAnswered: 0,
        answers: [],
        status: 'active', // active, disconnected, completed
        lastSeen: serverTimestamp()
      };

      await setDoc(doc(db, 'liveParticipants', `${sessionId}_${userId}`), participantData);

      console.log('✅ User successfully joined session');
      return { success: true, sessionId, sessionData, alreadyJoined: false };
    } catch (error) {
      console.error('Error joining session:', error);
      return { success: false, error: error.message };
    }
  }

  // Start quiz (Admin)
  async startQuiz(sessionId) {
    try {
      await updateDoc(doc(db, 'liveQuizSessions', sessionId), {
        status: 'active',
        currentQuestionIndex: 0,
        questionStartTime: serverTimestamp()
      });
      this.questionStartTime = new Date();
      return { success: true };
    } catch (error) {
      console.error('Error starting quiz:', error);
      return { success: false, error: error.message };
    }
  }

  // Move to next question (Admin)
  async nextQuestion(sessionId, currentQuestionIndex) {
    try {
      // Before moving to next question, auto-submit for participants who didn't answer
      await this.autoSubmitUnansweredQuestion(sessionId, currentQuestionIndex);
      
      const nextIndex = currentQuestionIndex + 1;
      
      await updateDoc(doc(db, 'liveQuizSessions', sessionId), {
        currentQuestionIndex: nextIndex,
        questionStartTime: serverTimestamp(),
        isEditing: false,
        editingQuestionIndex: null
      });
      
      this.questionStartTime = new Date();
      return { success: true };
    } catch (error) {
      console.error('Error moving to next question:', error);
      return { success: false, error: error.message };
    }
  }

  // Auto-submit unanswered questions when time runs out
  async autoSubmitUnansweredQuestion(sessionId, questionIndex) {
    try {
      // Get session data to find quiz info
      const sessionDoc = await getDoc(doc(db, 'liveQuizSessions', sessionId));
      if (!sessionDoc.exists()) return { success: false, error: 'Session not found' };
      
      const sessionData = sessionDoc.data();
      
      // Get quiz data to get question details
      const quizDoc = await getDoc(doc(db, 'quizzes', sessionData.quizId));
      if (!quizDoc.exists()) return { success: false, error: 'Quiz not found' };
      
      const quizData = quizDoc.data();
      const questionData = quizData.questions[questionIndex];
      if (!questionData) return { success: false, error: 'Question not found' };

      // Get all participants for this session
      const participantsRef = collection(db, 'liveParticipants');
      const participantsQuery = query(participantsRef, where('sessionId', '==', sessionId));
      const participantsSnapshot = await getDocs(participantsQuery);

      // Check each participant and auto-submit if they haven't answered this question
      const autoSubmitPromises = participantsSnapshot.docs.map(async (participantDoc) => {
        const participantData = participantDoc.data();
        
        // Check if this participant already answered this question
        const hasAnswered = participantData.answers && 
          participantData.answers.some(a => a.questionIndex === questionIndex);
        
        if (!hasAnswered) {
          // Auto-submit with no answer
          return this.submitAnswerForParticipant(
            sessionId, 
            participantData.userId, 
            questionIndex, 
            null, // No answer provided
            questionData,
            true // Mark as auto-submitted
          );
        }
        return Promise.resolve();
      });

      await Promise.all(autoSubmitPromises);
      console.log(`Auto-submitted unanswered questions for question ${questionIndex + 1}`);
      return { success: true };
    } catch (error) {
      console.error('Error auto-submitting unanswered questions:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to submit answer for a specific participant (used for auto-submit)
  async submitAnswerForParticipant(sessionId, userId, questionIndex, answer, questionData, isAutoSubmitted = false) {
    try {
      const participantRef = doc(db, 'liveParticipants', `${sessionId}_${userId}`);
      const participantDoc = await getDoc(participantRef);

      if (!participantDoc.exists()) {
        return { success: false, error: 'Participant not found' };
      }

      const participantData = participantDoc.data();
      const currentTime = new Date();
      
      // Check if already answered this question
      const existingAnswerIndex = participantData.answers.findIndex(a => a.questionIndex === questionIndex);
      
      // Build comprehensive answer record
      let newAnswers = [...participantData.answers];
      const isCorrect = answer && answer === questionData.answer;
      
      const answerRecord = {
        questionIndex: questionIndex,
        questionId: questionData.id || `q${questionIndex}`,
        questionText: questionData.question,
        options: questionData.options || questionData.choices,
        correctAnswer: questionData.answer,
        userAnswer: answer, // null if no answer provided
        answeredAt: currentTime,
        timeSpent: this.calculateTimeSpent(),
        isCorrect: isCorrect,
        isAutoSubmitted: isAutoSubmitted, // Flag to indicate this was auto-submitted
        
        // Progress tracking
        questionsAnswered: 0, // Will be calculated below
        currentScore: 0, // Will be calculated below
        cumulativePercentage: 0, // Will be calculated below
        questionNumber: questionIndex + 1
      };

      // Handle existing answer (re-submission during editing)
      if (existingAnswerIndex !== -1) {
        newAnswers[existingAnswerIndex] = answerRecord;
      } else {
        newAnswers.push(answerRecord);
      }

      // Calculate progress metrics
      const questionsAnswered = newAnswers.length;
      const currentScore = newAnswers.filter(a => a.isCorrect).length;
      const cumulativePercentage = questionsAnswered > 0 ? (currentScore / questionsAnswered) * 100 : 0;

      // Update answer record with calculated progress
      answerRecord.questionsAnswered = questionsAnswered;
      answerRecord.currentScore = currentScore;
      answerRecord.cumulativePercentage = cumulativePercentage;

      // Save locally if not auto-submitted
      if (!isAutoSubmitted) {
        this.saveAnswerToLocalStorage(sessionId, userId, answerRecord);
      }

      // Update participant document
      await updateDoc(participantRef, {
        answers: newAnswers,
        currentScore: currentScore,
        questionsAnswered: questionsAnswered,
        lastSeen: serverTimestamp()
      });

      // Get session data for quiz info
      const sessionDoc = await getDoc(doc(db, 'liveQuizSessions', sessionId));
      const sessionData = sessionDoc.data();

      // Create/update comprehensive quiz result record
      await this.updateQuizResultRecord(sessionId, userId, answerRecord, {
        quizId: sessionData.quizId,
        quizName: sessionData.quizName || 'Live Quiz',
        totalQuestions: sessionData.totalQuestions || 10,
        currentScore,
        questionsAnswered,
        cumulativePercentage
      });

      return { success: true, isCorrect, newScore: currentScore };
    } catch (error) {
      console.error('Error submitting answer for participant:', error);
      return { success: false, error: error.message };
    }
  }

  // Enable editing mode for current question (Admin)
  async startQuestionEdit(sessionId, questionIndex) {
    try {
      await updateDoc(doc(db, 'liveQuizSessions', sessionId), {
        isEditing: true,
        editingQuestionIndex: questionIndex,
        status: 'editing'
      });
      return { success: true };
    } catch (error) {
      console.error('Error starting question edit:', error);
      return { success: false, error: error.message };
    }
  }

  // Finish editing and reset for re-answering (Admin)
  async finishQuestionEdit(sessionId, questionIndex) {
    try {
      // Clear all answers for the current question from all participants
      const participantsRef = collection(db, 'liveParticipants');
      const participantsQuery = query(participantsRef, where('sessionId', '==', sessionId));
      const participantsSnapshot = await getDocs(participantsQuery);

      // Update each participant to remove answers for this question
      const updatePromises = participantsSnapshot.docs.map(async (participantDoc) => {
        const participantData = participantDoc.data();
        const filteredAnswers = participantData.answers.filter(a => a.questionIndex !== questionIndex);
        
        // Recalculate score without the removed answer
        const newScore = filteredAnswers.filter(a => a.isCorrect).length;
        
        return updateDoc(participantDoc.ref, {
          answers: filteredAnswers,
          currentScore: newScore,
          questionsAnswered: filteredAnswers.length
        });
      });

      await Promise.all(updatePromises);

      // Reset session to active with new timer
      await updateDoc(doc(db, 'liveQuizSessions', sessionId), {
        isEditing: false,
        editingQuestionIndex: null,
        status: 'active',
        questionStartTime: serverTimestamp()
      });

      this.questionStartTime = new Date();
      return { success: true };
    } catch (error) {
      console.error('Error finishing question edit:', error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced answer submission with comprehensive data tracking
  async submitAnswer(sessionId, userId, questionIndex, answer, questionData) {
    try {
      // Check if session is in editing mode - block submissions
      const sessionDoc = await getDoc(doc(db, 'liveQuizSessions', sessionId));
      const sessionData = sessionDoc.data();
      
      if (sessionData.isEditing) {
        return { success: false, error: 'Question is being edited. Please wait...' };
      }

      const participantRef = doc(db, 'liveParticipants', `${sessionId}_${userId}`);
      const participantDoc = await getDoc(participantRef);

      if (!participantDoc.exists()) {
        return { success: false, error: 'Participant not found' };
      }

      const participantData = participantDoc.data();
      const currentTime = new Date();
      
      // Check if already answered this question
      const existingAnswerIndex = participantData.answers.findIndex(a => a.questionIndex === questionIndex);
      
      // Calculate progress
      let newAnswers = [...participantData.answers];
      const isCorrect = answer === questionData.answer;
      
      // Build comprehensive answer record
      const answerRecord = {
        questionIndex: questionIndex,
        questionId: questionData.id || `q${questionIndex}`,
        questionText: questionData.question,
        options: questionData.options || questionData.choices,
        correctAnswer: questionData.answer,
        userAnswer: answer,
        answeredAt: currentTime,
        timeSpent: this.calculateTimeSpent(),
        isCorrect: isCorrect,
        
        // Progress tracking
        questionsAnswered: 0, // Will be calculated below
        currentScore: 0, // Will be calculated below
        cumulativePercentage: 0, // Will be calculated below
        questionNumber: questionIndex + 1
      };

      // Handle existing answer (re-submission during editing)
      if (existingAnswerIndex !== -1) {
        newAnswers[existingAnswerIndex] = answerRecord;
      } else {
        newAnswers.push(answerRecord);
      }

      // Calculate progress metrics
      const questionsAnswered = newAnswers.length;
      const currentScore = newAnswers.filter(a => a.isCorrect).length;
      const cumulativePercentage = questionsAnswered > 0 ? (currentScore / questionsAnswered) * 100 : 0;

      // Update answer record with calculated progress
      answerRecord.questionsAnswered = questionsAnswered;
      answerRecord.currentScore = currentScore;
      answerRecord.cumulativePercentage = cumulativePercentage;

      // Save locally first
      this.saveAnswerToLocalStorage(sessionId, userId, answerRecord);

      // Update participant document
      await updateDoc(participantRef, {
        answers: newAnswers,
        currentScore: currentScore,
        questionsAnswered: questionsAnswered,
        lastSeen: serverTimestamp()
      });

      // Create/update comprehensive quiz result record
      await this.updateQuizResultRecord(sessionId, userId, answerRecord, {
        quizId: sessionData.quizId,
        quizName: sessionData.quizName || 'Live Quiz',
        totalQuestions: sessionData.totalQuestions || 10,
        currentScore,
        questionsAnswered,
        cumulativePercentage
      });

      console.log('Answer submitted successfully with progress tracking');
      return { success: true, isCorrect, newScore: currentScore, progress: { questionsAnswered, currentScore, cumulativePercentage } };
    } catch (error) {
      console.error('Error submitting answer:', error);
      return { success: false, error: error.message };
    }
  }

  // Save answer to localStorage for backup/recovery
  saveAnswerToLocalStorage(sessionId, userId, answerRecord) {
    try {
      const storageKey = `liveQuiz_${sessionId}_${userId}`;
      let localData = JSON.parse(localStorage.getItem(storageKey) || '{}');
      
      if (!localData.answers) {
        localData = {
          sessionId,
          userId,
          startedAt: new Date().toISOString(),
          answers: [],
          lastSaved: new Date().toISOString()
        };
      }

      // Update or add answer
      const existingIndex = localData.answers.findIndex(a => a.questionIndex === answerRecord.questionIndex);
      if (existingIndex !== -1) {
        localData.answers[existingIndex] = answerRecord;
      } else {
        localData.answers.push(answerRecord);
      }

      localData.lastSaved = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(localData));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  // Update comprehensive quiz result record
  async updateQuizResultRecord(sessionId, userId, answerRecord, quizInfo) {
    try {
      const resultRef = doc(db, 'liveQuizResults', `${sessionId}_${userId}`);
      const resultDoc = await getDoc(resultRef);

      if (!resultDoc.exists()) {
        // Create initial record
        await setDoc(resultRef, {
          quizId: quizInfo.quizId,
          userId: userId,
          sessionId: sessionId,
          quizName: quizInfo.quizName,
          startedAt: new Date(),
          questionsAnswered: answerRecord.questionsAnswered,
          totalQuestions: quizInfo.totalQuestions,
          currentScore: answerRecord.currentScore,
          currentPercentage: answerRecord.cumulativePercentage,
          lastAnsweredAt: new Date(),
          status: "in_progress",
          answers: [answerRecord]
        });
      } else {
        // Update existing record
        const existingData = resultDoc.data();
        let updatedAnswers = [...(existingData.answers || [])];
        
        // Update or add answer
        const existingIndex = updatedAnswers.findIndex(a => a.questionIndex === answerRecord.questionIndex);
        if (existingIndex !== -1) {
          updatedAnswers[existingIndex] = answerRecord;
        } else {
          updatedAnswers.push(answerRecord);
        }

        await updateDoc(resultRef, {
          answers: updatedAnswers,
          questionsAnswered: answerRecord.questionsAnswered,
          currentScore: answerRecord.currentScore,
          currentPercentage: answerRecord.cumulativePercentage,
          lastAnsweredAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error updating quiz result record:', error);
    }
  }

  // Calculate time spent on current question
  calculateTimeSpent() {
    if (!this.questionStartTime) return 0;
    return Math.floor((new Date() - this.questionStartTime) / 1000);
  }

  // End session (Admin)
  async endSession(sessionId) {
    try {
      // Get current session data to determine the final question
      const sessionDoc = await getDoc(doc(db, 'liveQuizSessions', sessionId));
      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        
        // Auto-submit the final question for anyone who hasn't answered
        if (sessionData.currentQuestionIndex >= 0) {
          await this.autoSubmitUnansweredQuestion(sessionId, sessionData.currentQuestionIndex);
        }
      }
      
      await updateDoc(doc(db, 'liveQuizSessions', sessionId), {
        status: 'completed',
        endedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error ending session:', error);
      return { success: false, error: error.message };
    }
  }

  // Listen to session changes (Real-time)
  listenToSession(sessionId, callback) {
    const unsubscribe = onSnapshot(doc(db, 'liveQuizSessions', sessionId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        // Update local question start time for accurate time calculations
        if (data.questionStartTime) {
          this.questionStartTime = data.questionStartTime.toDate?.() || new Date(data.questionStartTime);
        }
        callback(data);
      } else {
        callback(null);
      }
    });

    this.sessionListeners.set(sessionId, unsubscribe);
    return unsubscribe;
  }

  // Listen to participants (Real-time)
  listenToParticipants(sessionId, callback) {
    const participantsRef = collection(db, 'liveParticipants');
    const unsubscribe = onSnapshot(
      query(participantsRef, where('sessionId', '==', sessionId)),
      (snapshot) => {
        const participants = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(participants);
      }
    );

    this.participantListeners.set(sessionId, unsubscribe);
    return unsubscribe;
  }

  // Cleanup listeners
  cleanup(sessionId) {
    if (this.sessionListeners.has(sessionId)) {
      this.sessionListeners.get(sessionId)();
      this.sessionListeners.delete(sessionId);
    }

    if (this.participantListeners.has(sessionId)) {
      this.participantListeners.get(sessionId)();
      this.participantListeners.delete(sessionId);
    }
  }

  // Get session by code (for joining)
  async getSessionByCode(sessionCode) {
    try {
      const sessionsRef = collection(db, 'liveQuizSessions');
      const sessions = await getDocs(query(sessionsRef, where('sessionCode', '==', sessionCode)));
      
      if (sessions.empty) {
        return { success: false, error: 'Session not found' };
      }

      const sessionDoc = sessions.docs[0];
      return { success: true, sessionData: sessionDoc.data() };
    } catch (error) {
      console.error('Error getting session by code:', error);
      return { success: false, error: error.message };
    }
  }
}

export default LiveQuizManager; 