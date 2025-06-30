// src/lib/firebase.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase設定（↓ここはあなたのFirebaseコンソールの内容に置き換え）
const firebaseConfig = {
  apiKey: "AIzaSyCwaY-wuPESXLJ-8X-QBSbp8HeX51o04Pk",
  authDomain: "crepe-shop-homepage.firebaseapp.com",
  projectId: "crepe-shop-homepage",
  storageBucket: "crepe-shop-homepage.firebasestorage.app",
  messagingSenderId: "92024590951",
  appId: "1:92024590951:web:6b6dce6367972fdb6bbac2",
  measurementId: "G-3D6Q54FJMV",
};

// Firebase App 初期化（複数回初期化防止）
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 各サービスインスタンス
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
