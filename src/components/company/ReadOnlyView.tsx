import { computeMapEmbedSrc } from "@/lib/company/computeMapEmbedSrc";
import { CompanyProfileView } from "@/types/company";
import { Calendar, Globe, LinkIcon, Mail, MapPin, Phone, Sparkles, UserIcon, Users } from "lucide-react";

function Field({
  label,
  value,
  isLink,
  icon,
}: {
  label: string;
  value?: string | null;
  isLink?: boolean;
  icon?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="rounded border border-gray-200 p-4 bg-white/30">
      <div className="text-xs text-gray-800 mb-1 flex items-center gap-2">
        {icon}
        {label}
      </div>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 underline break-all"
        >
          {value}
        </a>
      ) : (
        <div className="text-gray-900 break-words whitespace-pre-wrap">
          {value}
        </div>
      )}
    </div>
  );
}

export default function ReadOnlyView({ data }: { data: CompanyProfileView
 }) {
  const embedSrc = computeMapEmbedSrc({
    address: data.address,
    useAddressForMap: data.useAddressForMap,
  });

  return (
    <div className="space-y-10">
      {data.about && (
        <section className="rounded border border-gray-200 p-4 md:p-5 bg-white/30 mb-5">
          <h3 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            会社情報
          </h3>
          <p className="whitespace-pre-wrap text-gray-800">{data.about}</p>
        </section>
      )}

      {/* 会社情報グリッド */}
      <section className="grid md:grid-cols-2 gap-6 mb-5">
        <Field
          icon={<UserIcon className="h-4 w-4" />}
          label="代表者"
          value={data.ceo ?? undefined}
        />
        <Field
          icon={<Calendar className="h-4 w-4" />}
          label="設立"
          value={data.founded ?? undefined}
        />
        <Field
          icon={<Sparkles className="h-4 w-4" />}
          label="資本金"
          value={data.capital ?? undefined}
        />
        <Field
          icon={<Users className="h-4 w-4" />}
          label="従業員数"
          value={data.employees ?? undefined}
        />
        <Field
          icon={<MapPin className="h-4 w-4" />}
          label="所在地"
          value={data.address ?? undefined}
        />
        <Field
          icon={<Phone className="h-4 w-4" />}
          label="電話番号"
          value={data.phone ?? undefined}
        />
        <Field
          icon={<Mail className="h-4 w-4" />}
          label="メール"
          value={data.email ?? undefined}
        />
        <Field
          icon={<Globe className="h-4 w-4" />}
          label="Webサイト"
          value={data.website ?? undefined}
          isLink
        />
      </section>

      {/* 事業内容 */}
      {Array.isArray(data.business) && data.business.length > 0 && (
        <section className="rounded border border-gray-200 p-4 md:p-5 bg-white/30">
          <h3 className="font-medium text-gray-700 mb-3">事業内容</h3>
          <ul className="list-disc pl-5 space-y-1">
            {data.business
              .filter((b) => (b ?? "").trim() !== "")
              .map((b, i) => (
                <li key={i} className="text-gray-800">
                  {b}
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* アクセス（マップ） */}
      {embedSrc && (
        <section className="rounded overflow-hidden border border-gray-200 bg-white/30">
          <h3 className="font-medium text-gray-700 mb-2 p-4 flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-blue-600" />
            アクセス
          </h3>
          <div className="aspect-video w-full">
            <iframe
              src={embedSrc}
              className="w-full h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      )}
    </div>
  );
}
