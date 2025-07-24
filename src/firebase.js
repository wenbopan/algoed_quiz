// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAct6ZdHcb2SIF_IP_FKPEX2dwueNNCdQE',
  authDomain: 'algo-ed-quiz.firebaseapp.com',
  projectId: 'algo-ed-quiz',
  // Add other config values from your Firebase project settings
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 