import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeDirectory } from "@/components/admin/EmployeeDirectory";
import { ExternalUserDirectory } from "@/components/admin/ExternalUserDirectory";
import { GroupDirectory } from "@/components/admin/GroupDirectory";
import { requireAnyRole } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: async ({ context }) => {
    await requireAnyRole((context as { userId: string }).userId, ["admin", "platform_admin"], "/admin");
  },
  head: () => ({
    meta: [
      { title: "Utilisateurs — Wilmet Trucks" },
      { name: "description", content: "Gestion des employés internes, des clients acheteurs et des partenaires vendeurs de Wilmet Trucks." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Utilisateurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Employés (internes et prestataires externes), groupes d&apos;affectation, clients acheteurs et partenaires
          vendeurs — trois populations distinctes, gérées depuis un seul écran.
        </p>
      </div>
      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Employés</TabsTrigger>
          <TabsTrigger value="groups">Groupes</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="sellers">Partenaires (vendeurs)</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="mt-4"><EmployeeDirectory /></TabsContent>
        <TabsContent value="groups" className="mt-4"><GroupDirectory /></TabsContent>
        <TabsContent value="clients" className="mt-4"><ExternalUserDirectory kind="client" /></TabsContent>
        <TabsContent value="sellers" className="mt-4"><ExternalUserDirectory kind="seller" /></TabsContent>
      </Tabs>
    </div>
  );
}
