import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ExternalUserDirectory } from "@/components/admin/ExternalUserDirectory";
import { requireAnyRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/partenaires")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole((context as { userId: string }).userId, [
      "admin",
      "platform_admin",
      "sales_manager",
    ]);
  },
  head: () => ({
    meta: [
      { title: "Partenaires vendeurs — Wilmet Trucks" },
      {
        name: "description",
        content: "Annuaire des partenaires vendeurs externes qui apportent des véhicules à Wilmet.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("admin.partenaires.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.partenaires.subtitle")}</p>
      </div>
      <ExternalUserDirectory kind="seller" />
    </div>
  );
}
