# Exercise images

Start (`0.jpg`) and end (`1.jpg`) photos for the starter exercise library in `scripts/data/exercises.json`.

`npm run seed:exercises` uploads them to R2 and stores their keys on each exercise; the app serves them from `/media/...`. After seeding, manage photos in Admin, Exercises. Add `-- --photos` to re-upload every photo from this folder (the old R2 files are deleted).

Photos sourced from free-exercise-db (github.com/yuhonas/free-exercise-db), which is published under the Unlicense. The original photo source and its terms have not been independently verified.
