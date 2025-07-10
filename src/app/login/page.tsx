"use client";

import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { LucideLogIn, LogOut, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SITE_KEY = "yotteya"; // ← サイトごとに変更可

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, "siteSettings", SITE_KEY));
          if (!snap.exists()) {
            setError("サイト情報が見つかりません。");
            await signOut(auth);
            return;
          }

          const data = snap.data();
          if (data.ownerId !== firebaseUser.uid) {
            setError("このアカウントには管理権限がありません。");
            await signOut(auth);
            return;
          }

          setUser(firebaseUser); // ownerId 一致したらログイン成功
        } catch (e) {
          console.error(e);
          setError("権限確認中にエラーが発生しました。");
          await signOut(auth);
        }
      } else {
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // 成功後、onAuthStateChanged 内で ownerId チェックが走る
    } catch (err) {
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/invalid-email":
            setError("メールアドレスの形式が正しくありません。");
            break;
          case "auth/user-not-found":
            setError("このメールアドレスは登録されていません。");
            break;
          case "auth/wrong-password":
            setError("パスワードが間違っています。");
            break;
          case "auth/invalid-credential":
            setError("認証情報が正しくありません。");
            break;
          default:
            setError("ログインに失敗しました。");
        }
      } else {
        setError("不明なエラーが発生しました。");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <LogOut size={20} /> ログアウト
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p>{user.email} としてログイン中です。</p>
            <Button onClick={handleLogout} className="w-full bg-blue-500">
              ログアウト
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <LucideLogIn size={20} /> 管理者ログイン
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>ログインエラー</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-500"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
