"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import type { CartItem } from "@/types/cart";

type CartContextValue = {
  items: CartItem[];
  totalQty: number;
  subtotalJPY: number;
  add: (item: CartItem) => void;
  remove: (productId: string) => void;
  changeQty: (productId: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const i = prev.findIndex((p) => p.productId === item.productId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + item.qty };
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const remove = useCallback(
    (productId: string) => {
      setItems((prev) => prev.filter((p) => p.productId !== productId));
    },
    []
  );

  const changeQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, qty } : p))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotalJPY = useMemo(
    () => items.reduce((sum, it) => sum + it.unitAmount * it.qty, 0),
    [items]
  );
  const totalQty = useMemo(
    () => items.reduce((n, it) => n + it.qty, 0),
    [items]
  );

  const value: CartContextValue = {
    items,
    totalQty,
    subtotalJPY,
    add,
    remove,
    changeQty,
    clear,
  };

  // ★ サンクスページからの cart:clear イベントを拾う
  useEffect(() => {
    const handler = () => clear();
    window.addEventListener("cart:clear", handler);
    return () => window.removeEventListener("cart:clear", handler);
  }, [clear]);

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
