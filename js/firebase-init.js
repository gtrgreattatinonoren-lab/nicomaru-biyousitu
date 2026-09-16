// ==========================================================================
// Firebase SDKの初期化(予約フォーム・管理画面の共通処理)
// ==========================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

var app = null;
var db = null;
var auth = null;

if (isFirebaseConfigured()) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

export {
  db,
  auth,
  isFirebaseConfigured,
  collection,
  addDoc,
  setDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
