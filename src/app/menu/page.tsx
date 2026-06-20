import MenuPageClient from "@/components/menu/MenuPageClient";

export default async function MenuPage() {
  // SSR: Firestoreから初期データを取得

  return <MenuPageClient />;
}
