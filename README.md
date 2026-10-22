# all systems you

*Your health is complicated. Managing it shouldn't be.*

Open-source, whole-life health planning for real humans with real complexity.

(Shared version, Phase 1. Formerly "all systems you".)

A free, open source helper for people who manage complex diets and health routines at home:
a daily checklist with supplement and routine reminders, a pantry-to-meals planner with a shopping
list, and a meal checker that flags foods against each person's own rules.

**This is not medical advice.** The app helps people follow the plan they and their care team set.
It never invents targets or doses: every number starts blank until the person enters one.

## What's here

- `app/` is the ready-to-use web app (published from `docs/` on GitHub Pages). Put the folder on any static web host,
  open `index.html`, and use "Add to Home Screen" on a phone. After the first visit it works offline.
  You can also open `app/index.html` straight from disk; offline install needs a web address.
- Every outside resource is cited on `app/sources.html`, built from `src/sources.json`.
- `src/` is the source. Edit these files, then rebuild with `python3 src/build.py app`.
  - `helper.html` is the all systems you (becomes `app/index.html`).
  - `checker.html` is the Meal Plan Checker. Its `STARTER_PACKS` are the starter food lists.
  - `pantry.template.html` is the Pantry Meal Planner. The build copies the checker's starter lists
    and food table into it, so all three pages flag foods the same way.

## Privacy

There are no accounts and no server. Everything a person enters is saved only in their own browser
on their own device. Backups are a copy-and-paste settings text (all systems you) and a backup file
(Pantry Meal Planner).

## Household and food cards

More, then Household: people you share meals with. Each person makes a food card in their own app (food rules only,
picked line by line), locked with a spoken passcode, and shares it by QR code, AirDrop/Quick Share/Bluetooth, or pasted
text. Someone can also be typed in with their OK. The helper, pantry and checker then check shared dishes for each
person. Code: `src/household/` . Sources: Household sharing on
`app/sources.html`.

## Starter food lists are drafts

Blood sugar, Low-mold, Gluten-free, and Medicine and food warnings are general starter lists, turned
on under My rules. They have not yet been reviewed by a clinician. Personal allergies and limits go
in each person's own "Foods to flag" list.

## Known gaps (later phases)

- One setup flow for new people (conditions, allergies, kitchen, household), instead of editing tabs.
- Glycemic index numbers in the food table need a freely licensed source or must be marked as estimates.
- Reminders while the app is closed are limited in browsers; the calendar export is the backup.

## License

Code: GNU Affero General Public License 3.0 (see `LICENSE.txt`). A separate paid business license is
planned for for-profit clinics.
