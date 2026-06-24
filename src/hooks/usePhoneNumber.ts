import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

export function usePhoneNumber() {
  const siteKey = useSiteKey();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const fetchPhone = async () => {
      const ref = doc(db, "siteSettingsEditable", siteKey);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setPhone(data.phone || null);
      }
    };

    fetchPhone().catch(console.error);
  }, []);

  const updatePhone = async (newPhone: string) => {
    const ref = doc(db, "siteSettingsEditable", siteKey);
    await setDoc(ref, { phone: newPhone }, { merge: true });
    setPhone(newPhone);
  };

  return { phone, updatePhone };
}
