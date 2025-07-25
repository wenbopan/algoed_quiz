// Quick Firebase debug script
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAct6ZdHcb2SIF_IP_FKPEX2dwueNNCdQE',
  authDomain: 'algo-ed-quiz.firebaseapp.com',
  projectId: 'algo-ed-quiz',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkFirebaseData() {
  console.log('🔍 Checking Firebase data...\n');
  
  try {
    // Check quizzes
    const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));
    console.log(`📋 Quizzes collection: ${quizzesSnapshot.size} documents`);
    quizzesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.name} (${data.status})`);
    });
    
    // Check userProgress
    const progressSnapshot = await getDocs(collection(db, 'userProgress'));
    console.log(`\n👤 UserProgress collection: ${progressSnapshot.size} documents`);
    progressSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.userId} | ${data.quizName} | Status: ${data.status}`);
    });
    
    // Check quizResults
    const resultsSnapshot = await getDocs(collection(db, 'quizResults'));
    console.log(`\n🏆 QuizResults collection: ${resultsSnapshot.size} documents`);
    resultsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${data.userName} | ${data.quizName} | Score: ${data.percentageScore}%`);
    });
    
    console.log('\n✅ Firebase data check complete!');
    
  } catch (error) {
    console.error('❌ Error checking Firebase:', error);
  }
}

checkFirebaseData(); 