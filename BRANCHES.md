# Gestion des branches — leNeo/geospatial

> Documentation interne du workflow de contribution multi-modules vers OCA/geospatial.
> Dernière mise à jour : 2026-05-16 (ajout module pont `geoengine_drone_ortho_swisstopo`)

## 1. Vue d'ensemble

Ce dépôt est un **fork** de [OCA/geospatial](https://github.com/OCA/geospatial).
Il contient plusieurs modules Odoo migrés vers la 19.0. La contribution à OCA suit la règle :

> **1 PR = 1 module**

Pour respecter cette règle tout en gardant un environnement de développement
cohérent (où tous les modules cohabitent), on adopte un **workflow hybride**.

## 2. Architecture des branches

| Branche | Rôle | Contenu | Destination |
|---|---|---|---|
| `19.0-mig-base_geoengine` | **Branche de dev** (intégration) | Tous les modules ensemble | Jamais poussée vers OCA |
| `19.0` | OCA-ready — `base_geoengine` | base_geoengine seul | PR OCA #446 |
| `19.0-geoengine_swisstopo` | OCA-ready — `geoengine_swisstopo` | base_geoengine + swisstopo | Future PR OCA |
| `19.0-geoengine_drone_ortho` | OCA-ready — `geoengine_drone_ortho` | base_geoengine + drone_ortho | Future PR OCA |
| `19.0-geoengine_drone_ortho_swisstopo` | OCA-ready — **module pont** | base + swisstopo + drone_ortho + pont | Future PR OCA (après les 2 dépendances) |

### Schéma

```
                  ┌────────────────────────────────┐
                  │  19.0-mig-base_geoengine       │  ← développement quotidien
                  │  (tous modules, tout-en-un)    │
                  └───────────┬────────────────────┘
                              │ cherry-pick (1 commit / module)
                              ▼
   ┌──────────┬───────────────┼───────────────┬─────────────────────────┐
   ▼          ▼               ▼               ▼                         ▼
 ┌──────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────────────────────┐
 │ 19.0 │ │ …_swiss…   │ │ …_drone_ortho│ │ …_drone_ortho_swisstopo      │
 │(base)│ │(base+swiss)│ │ (base+drone) │ │(base+swiss+drone+pont)       │
 └──┬───┘ └──────┬─────┘ └──────┬───────┘ └──────────────┬───────────────┘
    │PR#446      │PR future     │PR future               │PR future
    ▼            ▼              ▼                        ▼ (après les 3 autres)
                          OCA/geospatial:19.0
```

## 3. Convention de commit

On utilise les **Conventional Commits** avec scope = nom du module :

```
feat(base_geoengine): ajout du support des projections multiples
fix(geoengine_swisstopo): correction de l'opacité des couches raster
refactor(base_geoengine): chargement dynamique des libs JS
[ADD] geoengine_drone_ortho: module initial XYZ/TMS pour orthos drones
```

**Règle d'or :** *1 commit ne touche qu'à 1 seul module* (sauf cas exceptionnel
documenté en message de commit).

## 4. Workflow quotidien

### 4.1 Développement

Tout le travail se fait sur `19.0-mig-base_geoengine` :

```bash
git checkout 19.0-mig-base_geoengine
# … coder, tester …
git add path/du/module/
git commit -m "feat(nom_du_module): description courte"
git push origin 19.0-mig-base_geoengine
```

### 4.2 Propager une modif vers la branche OCA-ready correspondante

Une fois un commit prêt, on le **cherry-pick** vers la branche OCA-ready :

```bash
# Exemple : un commit qui touche base_geoengine
git checkout 19.0
git pull --rebase origin 19.0
git cherry-pick <SHA_DU_COMMIT>
# Si conflit (modify/delete sur des fichiers d'un autre module) :
git rm path/de/l-autre/module/fichier
git cherry-pick --continue
git push origin 19.0
```

### 4.3 Mettre à jour les branches OCA-ready des modules dépendants

Quand on modifie `base_geoengine`, il faut **propager** la mise à jour aux
branches `…_swisstopo-clean` et `…_drone_ortho`, qui contiennent toutes deux
`base_geoengine` :

```bash
git checkout 19.0-geoengine_swisstopo-clean
git pull --rebase origin 19.0     # récupère le nouveau commit de base_geoengine
git push origin 19.0-geoengine_swisstopo-clean
```

Idem pour `19.0-geoengine_drone_ortho`.

> **Pourquoi `pull --rebase` et pas `merge` ?**
> Pour garder un historique linéaire propre, exigé par OCA.

## 5. Création d'une nouvelle branche OCA-ready

Pour ajouter un nouveau module (ex : `geoengine_xyz`) :

```bash
# 1. Partir de 19.0 (qui ne contient que base_geoengine)
git checkout 19.0
git pull --rebase origin 19.0
git checkout -b 19.0-geoengine_xyz

# 2. Copier les fichiers du module depuis la branche de dev
git checkout origin/19.0-mig-base_geoengine -- geoengine_xyz/

# 3. Commiter en 1 seul commit
git add geoengine_xyz/
git commit -m "[ADD] geoengine_xyz: description du module"

# 4. Pousser
git push origin 19.0-geoengine_xyz
```

Vérifier ensuite sur GitHub via la page de comparaison :

```
https://github.com/leNeo/geospatial/compare/19.0...19.0-geoengine_xyz
```

→ doit afficher **1 commit, N fichiers, "Able to merge"** (1 seul contributeur).

## 6. Création d'une PR vers OCA

> ⚠️ Soumettre une PR uniquement quand le module précédent est mergé sur OCA
> (sinon la diff inclura les fichiers du module en attente).

1. Aller sur `https://github.com/OCA/geospatial/compare/19.0...leNeo:geospatial:19.0-geoengine_xyz`
2. Cliquer "Create pull request"
3. Titre : `[19.0][ADD] geoengine_xyz: description courte`
4. Description : suivre le template OCA (Summary, Changes, Test plan)
5. Vérifier que `pre-commit run --all-files` passe en local avant soumission

## 7. État courant des PRs OCA

| Module | PR OCA | Statut |
|---|---|---|
| `base_geoengine` | [#465](https://github.com/OCA/geospatial/pull/465) | 🟢 Open — **PR consolidée**, CI verte, en review |
| `geoengine_swisstopo` | _(pas encore créée)_ | ⏳ Attend merge **#465** |
| `geoengine_drone_ortho` | _(pas encore créée)_ | ⏳ Attend merge `geoengine_swisstopo` (par sécurité, ordre logique) |
| `geoengine_drone_ortho_swisstopo` | _(pas encore créée)_ | ⏳ Attend merge des deux dépendances |

> **Convergence base_geoengine (consolidation #465).** Il y avait 3 migrations
> parallèles : [#414](https://github.com/OCA/geospatial/pull/414) (weinni2000),
> notre [#446](https://github.com/OCA/geospatial/pull/446), et la PR
> [weinni2000/geospatial#7](https://github.com/weinni2000/geospatial/pull/7)
> (juppe : montée libs OL/Chroma/Geostats, fix WKB, cherry-pick #431).
> weinni2000 a proposé de passer la main → nous avons **consolidé le tout en
> [#465](https://github.com/OCA/geospatial/pull/465)** : base #414 + improvements
> de juppe + notre **fix sécurité `ir.rule`** (voir §8.3). Crédits préservés
> (`Co-authored-by` / historique par commit).
> Suites : **#446 fermée** (superseded), #414 à fermer par weinni2000, PR#7 intégrée.

**Ordre de soumission** :
1. `base_geoengine` — **#465** (consolidée)
2. `geoengine_swisstopo`
3. `geoengine_drone_ortho` *(plus de dépendance JS bloquante — voir §8.1)*
4. `geoengine_drone_ortho_swisstopo` *(module pont, dépend des deux précédents)*

## 8. Points d'attention / Dette technique

### 8.1 Dépendance JS croisée — `geoengine_drone_ortho` ✅ RÉSOLU

**État précédent** : `geoengine_drone_ortho/static/src/js/geoengine_renderer_patch.esm.js`
importait `SWISSTOPO_EXTENT_2056` et `SWISSTOPO_RESOLUTIONS` depuis
`@geoengine_swisstopo/js/swisstopo_raster.esm`, sans déclarer la dépendance
dans `__manifest__.py`. Incompatible avec la règle OCA "1 PR = 1 module
autonome".

**Solution retenue** : pattern **module pont** (bridge module).

1. `geoengine_drone_ortho` rendu autonome :
   - Import `@geoengine_swisstopo` supprimé.
   - Cas spécial `if (srcProjCode === "EPSG:2056")` retiré.
   - Nouveau point d'extension `_buildXyzTileGrid(srcProjCode, srcProj, background)`
     exposé sur `GeoengineRenderer.prototype` — retourne par défaut une grille
     WebMercator générique via `ol.tilegrid.createXYZ`.

2. Nouveau module `geoengine_drone_ortho_swisstopo` :
   - `depends: ["geoengine_drone_ortho", "geoengine_swisstopo"]`
   - `auto_install: True` → s'active automatiquement si les deux modules sont présents.
   - Patche `_buildXyzTileGrid` pour retourner une `ol.tilegrid.TileGrid` avec
     `SWISSTOPO_EXTENT_2056` + `SWISSTOPO_RESOLUTIONS` quand
     `srcProjCode === "EPSG:2056"`, sinon délègue à `super`.

**Bénéfice** : chaque module est OCA-soumissible indépendamment, et la grille
Swisstopo s'active automatiquement quand les deux modules sont installés
ensemble.

### 8.2 Workflow `test.yml` / PostGIS ⚠️ TRANSITOIRE (patch manuel)

Le workflow CI `.github/workflows/test.yml` a été modifié **manuellement** pour
utiliser `postgis/postgis:14-3.5` (nécessaire aux tests de `base_geoengine`).
Cette modification est conforme aux migrations 17.0 et 18.0 précédentes.

> ⚠️ **C'est un patch manuel d'un fichier généré par Copier.** Il sera écrasé
> à chaque `copier update`. Il doit être réappliqué tant que le template OCA
> du dépôt n'a pas été régénéré avec le support natif de l'image PostgreSQL
> (voir solution propre ci-dessous).

**Solution propre (à venir) — paramètre `postgres_image` du template OCA**

La PR [OCA/oca-addons-repo-template#355](https://github.com/OCA/oca-addons-repo-template/pull/355)
(mergée le 2026-05-29) ajoute un paramètre `postgres_image` au template :
on peut désormais déclarer l'image PostgreSQL dans `.copier-answers.yml` au
lieu de patcher `test.yml` à la main.

Migration prévue, en **2 temps** (opérations **niveau dépôt**, hors PR de
module — ne PAS inclure dans la PR #446 de `base_geoengine`) :

1. Attendre que OCA/geospatial bumpe le template à un tag **> v1.35** incluant
   la PR #355 (`copier update` lancé centralement par les mainteneurs / le bot).
2. Renseigner dans `.copier-answers.yml` :
   ```yaml
   postgres_image: postgis/postgis:14-3.5
   ```
   puis régénérer. Le `test.yml` produit contiendra alors PostGIS nativement,
   et le patch manuel ci-dessus pourra être **supprimé de toutes les branches**.

> Tant que le template n'est pas bumpé, garder le patch manuel : sans lui, plus
> de PostGIS en CI → les tests de `base_geoengine` échouent.

### 8.3 Régression sécurité `ir.rule` sur geo-opérateurs indirects ✅ CORRIGÉ (#465)

**Problème** : la migration 19.0 (#414) a remplacé `self._apply_ir_rules(rel_query, "read")`
(API supprimée en 19.0) par `model._check_field_access(current_field, "read")`
dans `base_geoengine/expressions.py`. Ce n'est **pas équivalent** : les record
rules (`ir.rule`) n'étaient plus appliquées à la **sous-requête spatiale** des
geo-opérateurs indirects (forme `dict`, ex. `{"dummy.zip.the_geom": [...]}`).
→ Un utilisateur non-admin pouvait matcher des enregistrements liés qu'il n'a
pas le droit de voir (contournement row-level security).

**Pourquoi non détecté** : tous les tests tournent en **superuser**
(`TransactionCase` = `SUPERUSER_ID`), donc les `ir.rule` ne filtrent rien.

**Fix (#465)** : `where_calc()` applique désormais les record rules comme le
fait `BaseModel._search` (bloc `# security access domain`), garde sur
`model.env.su`. Ligne `_check_field_access` erronée retirée. Test de
non-régression ajouté (`test_geo_search_indirect_respects_record_rules` :
utilisateur non-admin + `ir.rule` scoping un groupe → la sous-requête respecte
la règle). Validé en CI OCA.

## 9. Commandes utiles

### Voir la diff d'une branche par rapport à `19.0`

```bash
git log --oneline 19.0..19.0-geoengine_xyz
git diff --stat 19.0...19.0-geoengine_xyz
```

### Vérifier qu'une branche est "Able to merge" sur GitHub

```
https://github.com/leNeo/geospatial/compare/19.0...<branch>
```

### Nettoyer une branche locale obsolète

```bash
git branch -D <branche>
git push origin --delete <branche>   # supprime aussi sur GitHub
```

### Réinitialiser une branche OCA-ready à partir de zéro

Si une branche OCA-ready est devenue trop "sale" (mauvais commits, doublons),
la recréer depuis `19.0` :

```bash
git checkout 19.0
git checkout -b 19.0-geoengine_xyz-clean
git checkout origin/19.0-mig-base_geoengine -- geoengine_xyz/
git commit -m "[ADD] geoengine_xyz: description"
git push origin 19.0-geoengine_xyz-clean
# Une fois validé, supprimer l'ancienne et renommer
```

## 10. Checklist avant chaque PR OCA

- [ ] Branche basée sur `OCA/geospatial:19.0` à jour
- [ ] Diff = 1 commit, N fichiers, **un seul contributeur**
- [ ] GitHub indique "Able to merge"
- [ ] `pre-commit run --all-files` ✅
- [ ] Tests passent : `odoo-bin -d test_db -i <module> --test-enable --stop-after-init`
- [ ] Pas de dépendance JS/Python cachée vers un autre module non déclaré dans `__manifest__.py`
- [ ] Headers de license OCA présents (`# Copyright …` + `# License AGPL-3.0`)
- [ ] `readme/` complet (DESCRIPTION, CONTRIBUTORS, HISTORY, USAGE, INSTALL si nécessaire)