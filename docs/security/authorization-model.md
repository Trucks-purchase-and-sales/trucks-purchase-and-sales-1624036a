# Modèle d'autorisation Wilmet (source de vérité)

## Frontière de confiance

- **RLS Postgres est la frontière de sécurité.** Toute décision d'accès doit tenir même si l'appelant contourne l'interface.
- Le filtrage côté UI et les filtres appliqués dans les server functions sont de l'ergonomie, **pas** de l'autorisation.
- **Un utilisateur = un seul rôle** (`public.user_roles`). `profiles.is_external` est une métadonnée dérivée (`external_agent => true`), jamais une identité de sécurité.

## Matrice canonique (tables pipeline cœur)

Tables concernées : `vehicle_opportunities`, `buyer_leads`, `demand_opportunities`, `sale_listings`.

| Rôle | Lecture | Écriture |
| --- | --- | --- |
| `admin` / `platform_admin` | tout | tout |
| `company_management` (Direction) | tout | **aucune** (lecture seule) |
| `sales_manager` | tout | tout + affectation |
| `sales_agent` (interne) | dossiers qui lui sont affectés, dossiers de ses groupes, dossiers non affectés dans son périmètre (`staff_scope`) | idem lecture |
| `external_agent` | uniquement les dossiers directement affectés à lui ; pour `vehicle_opportunities` également les véhicules qu'il a apportés (`partenaire_id = auth.uid()`) | idem lecture |
| `partenaire` + `partner_kind = seller` | ses propres véhicules | ses propres véhicules (brouillon / côté partenaire) |
| `partenaire` + `partner_kind = client` | ses propres demandes / leads | soumission de ses propres demandes |

Aucune visibilité croisée entre partenaires (vendeur ↔ acheteur ↔ autre partenaire).

## Invariants

1. Le rôle `sales_agent` **n'accorde jamais** un accès global : la portée vient toujours de l'affectation, du groupe ou du périmètre.
2. `external_agent` n'hérite **jamais** de l'accès groupe, global ou au pool non affecté.
3. `company_management` n'a aucun chemin d'écriture (INSERT / UPDATE / DELETE) sur les tables pipeline cœur.
4. Les partenaires conservent leurs chemins de soumission légitimes, restreints à leurs propres lignes.
5. Les helpers d'autorisation sont `SECURITY DEFINER`, `STABLE`, avec `search_path` fixé.

## Helpers d'autorisation (schéma `private`)

- `can_read_all_pipeline(user)` — admin, platform_admin, company_management, sales_manager.
- `can_write_all_pipeline(user)` — admin, platform_admin, sales_manager.
- `is_internal_sales_agent(user)` — rôle `sales_agent`.
- `is_external_agent(user)` — rôle `external_agent` (basé sur le rôle, plus sur le drapeau profil).
- `staff_scope_allows(user, side)` — `profiles.staff_scope` = `side` ou `both`.
- `can_read_pipeline_record(user, assigned_sales_agent_id, assigned_group_id, side)`.
- `can_write_pipeline_record(user, assigned_sales_agent_id, assigned_group_id, side)` — même portée, lecteurs globaux moins `company_management`.

## Tests d'acceptation

1. Vendeur A lit son véhicule ; ne lit pas celui du vendeur B.
2. Client A lit son lead / sa demande ; ne lit pas ceux du client B.
3. `sales_agent` interne lit/écrit une ligne affectée, une ligne de son groupe, une ligne non affectée dans son périmètre ; échoue hors périmètre.
4. `external_agent` lit/écrit une ligne directement affectée et un véhicule qu'il a apporté ; échoue sur ligne d'un autre agent, de groupe, ou non affectée.
5. `company_management` lit les lignes pipeline ; UPDATE / INSERT / DELETE refusés.
6. `sales_manager` / `admin` conservent l'accès complet.

Les vérifications doivent être exécutées avec des JWT utilisateurs réels — jamais avec la clé de service.
