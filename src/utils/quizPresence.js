import { doc, updateDoc, addDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

class QuizPresenceManager {
  constructor() {
    this.heartbeatInterval = null;
    this.heartbeatFrequency = 15000; // 15 seconds
    this.maxMissedHeartbeats = 3;
    this.currentUser = null;
    this.missedHeartbeats = 0;
    this.isOnline = navigator.onLine;
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Connection restored');
      this.isOnline = true;
      this.handleConnectionRestored();
    });
    
    window.addEventListener('offline', () => {
      console.log('Connection lost');
      this.isOnline = false;
    });

    // Listen for page unload to clean up
    window.addEventListener('beforeunload', () => {
      this.leaveQuiz();
    });

    // Listen for page visibility changes (tab switching, minimizing)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('Page hidden - pausing heartbeat');
        this.pauseHeartbeat();
      } else {
        console.log('Page visible - resuming heartbeat');
        this.resumeHeartbeat();
      }
    });
  }

  async joinQuiz(quizId, userId, userName) {
    try {
      // Check if user already exists (in case of reconnection)
      const existingUserQuery = query(
        collection(db, 'activeUsers'),
        where('quizId', '==', quizId),
        where('userId', '==', userId)
      );
      const existingUsers = await getDocs(existingUserQuery);
      
      if (existingUsers.empty) {
        // Add new user
        const docRef = await addDoc(collection(db, 'activeUsers'), {
          quizId,
          userId,
          userName,
          joinedAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
          status: 'active',
          currentQuestion: 1,
          score: 0,
          missedHeartbeats: 0,
          connectionStatus: 'stable'
        });
        
        this.currentUser = {
          docId: docRef.id,
          quizId,
          userId,
          userName
        };
      } else {
        // Update existing user (reconnection)
        const userDoc = existingUsers.docs[0];
        await updateDoc(userDoc.ref, {
          lastSeen: serverTimestamp(),
          status: 'active',
          missedHeartbeats: 0,
          connectionStatus: 'reconnected'
        });
        
        this.currentUser = {
          docId: userDoc.id,
          quizId,
          userId,
          userName
        };
      }

      this.startHeartbeat();
      console.log('User joined quiz successfully:', this.currentUser);
      return this.currentUser;
    } catch (error) {
      console.error('Error joining quiz:', error);
      throw error;
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.heartbeatFrequency);

    console.log(`Heartbeat started (every ${this.heartbeatFrequency/1000}s)`);
  }

  async sendHeartbeat() {
    if (!this.currentUser || !this.isOnline) {
      console.log('Skipping heartbeat - offline or no current user');
      return;
    }

    try {
      await updateDoc(doc(db, 'activeUsers', this.currentUser.docId), {
        lastSeen: serverTimestamp(),
        connectionStatus: 'stable',
        missedHeartbeats: 0
      });
      
      // Reset missed heartbeats on successful update
      this.missedHeartbeats = 0;
      console.log('Heartbeat sent successfully');
    } catch (error) {
      this.missedHeartbeats++;
      console.error(`Heartbeat failed (${this.missedHeartbeats}/${this.maxMissedHeartbeats}):`, error);
      
      // Update connection status to show unstable connection
      try {
        await updateDoc(doc(db, 'activeUsers', this.currentUser.docId), {
          connectionStatus: 'unstable',
          missedHeartbeats: this.missedHeartbeats
        });
      } catch (updateError) {
        console.error('Failed to update connection status:', updateError);
      }

      // Remove user after max missed heartbeats
      if (this.missedHeartbeats >= this.maxMissedHeartbeats) {
        console.log(`Max missed heartbeats reached. Removing user.`);
        await this.leaveQuiz();
      }
    }
  }

  async handleConnectionRestored() {
    if (this.currentUser) {
      console.log('Attempting to restore presence...');
      try {
        // Update user as reconnected
        await updateDoc(doc(db, 'activeUsers', this.currentUser.docId), {
          lastSeen: serverTimestamp(),
          connectionStatus: 'reconnected',
          missedHeartbeats: 0
        });
        
        // Reset missed heartbeats and resume normal heartbeat
        this.missedHeartbeats = 0;
        this.resumeHeartbeat();
        console.log('Presence restored successfully');
      } catch (error) {
        console.error('Failed to restore presence:', error);
        // Try to rejoin if update fails
        await this.joinQuiz(
          this.currentUser.quizId,
          this.currentUser.userId,
          this.currentUser.userName
        );
      }
    }
  }

  pauseHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  resumeHeartbeat() {
    if (!this.heartbeatInterval && this.currentUser) {
      this.startHeartbeat();
    }
  }

  async updateQuizProgress(currentQuestion, score, answers = null) {
    if (!this.currentUser) return;

    try {
      const updateData = {
        currentQuestion,
        score,
        lastSeen: serverTimestamp()
      };

      if (answers) {
        updateData.answers = answers;
      }

      await updateDoc(doc(db, 'activeUsers', this.currentUser.docId), updateData);
      console.log('Quiz progress updated:', { currentQuestion, score });
    } catch (error) {
      console.error('Error updating quiz progress:', error);
    }
  }

  async leaveQuiz() {
    if (!this.currentUser) return;

    try {
      // Stop heartbeat
      this.pauseHeartbeat();

      // Remove user from active users
      await deleteDoc(doc(db, 'activeUsers', this.currentUser.docId));
      console.log('User left quiz successfully');
      
      this.currentUser = null;
      this.missedHeartbeats = 0;
    } catch (error) {
      console.error('Error leaving quiz:', error);
    }
  }

  // Admin function to clean up stale users
  static async cleanupStaleUsers(maxAgeMinutes = 5) {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
      const staleUsersQuery = query(
        collection(db, 'activeUsers'),
        where('lastSeen', '<', cutoffTime)
      );
      
      const staleUsers = await getDocs(staleUsersQuery);
      const deletePromises = staleUsers.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`Cleaned up ${staleUsers.size} stale users`);
      return staleUsers.size;
    } catch (error) {
      console.error('Error cleaning up stale users:', error);
      return 0;
    }
  }

  // Get current connection status
  getConnectionStatus() {
    return {
      isOnline: this.isOnline,
      missedHeartbeats: this.missedHeartbeats,
      maxMissedHeartbeats: this.maxMissedHeartbeats,
      currentUser: this.currentUser,
      heartbeatActive: !!this.heartbeatInterval
    };
  }
}

// Export singleton instance
export const quizPresence = new QuizPresenceManager();

// Export the class for testing or multiple instances
export default QuizPresenceManager; 