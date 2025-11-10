import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBcWzJZFKMaYZAV8JcHENJpNFJM6krL8pQ',
  authDomain: 'dbms-project-edd2c.firebaseapp.com',
  projectId: 'dbms-project-edd2c',
  storageBucket: 'dbms-project-edd2c.appspot.com',
  messagingSenderId: '950465249799',
  appId: '1:950465249799:web:e4c0c09281d1c0609a60a2',
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage };
