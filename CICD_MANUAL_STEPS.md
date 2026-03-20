STEP 1 — Push the workflows to GitHub
--------------------------------------
  git add .github/workflows/ci.yml .github/workflows/cd.yml
  git commit -m "ci: add GitHub Actions CI/CD workflows"
  git push origin main

  After pushing, go to the "Actions" tab in your GitHub repo.
  Wait for the CI workflow to complete at least once — you NEED a completed
  run before the check names appear in the branch protection settings.


STEP 2 — Configure Branch Protection on `main`
-----------------------------------------------
  1. Open your GitHub repo in the browser
  2. Go to: Settings → Branches → "Add branch protection rule"
  3. Under "Branch name pattern", type: main
  4. Check: "Require a pull request before merging"
       (leave "Required approvals" at 0 unless you want mandatory code review)
  5. Check: "Require status checks to pass before merging"
  6. Check: "Require branches to be up to date before merging"
  7. In the search box under "Status checks that are required", add each of
     these (search by name, they appear after the first CI run):

       Lint API
       Lint Worker
       Lint Web
       Test API
       Test Worker
       Test Web
       Build API
       Build Worker
       Build Web

  8. Check: "Do not allow bypassing the above settings"
  9. Click "Save changes"

  Result: No branch can be merged to main unless all 9 checks pass.


STEP 3 — Set GHCR Package Visibility (Optional)
------------------------------------------------
  Docker images are pushed to GHCR (GitHub Container Registry) and are
  PRIVATE by default. If you want to pull images without logging in
  (e.g., on a deployment server), make them public:

  1. Go to your GitHub profile → "Packages"
  2. After the first CD run, you'll see: api, worker, web
  3. Click each package → "Package settings" → "Change visibility" → Public
  4. Repeat for all three packages

  If you keep them private, pull on a server using:
    docker login ghcr.io -u <your-github-username> -p <PAT with read:packages>
    docker pull ghcr.io/<owner>/<repo>/api:latest


STEP 4 — Verify Everything Works
---------------------------------
  CI test:
    - Create a new branch, make any small change, push it
    - Open a PR targeting main
    - All 9 checks should appear and pass (or fail if there's a real issue)
    - Try merging without green checks — GitHub should block it

  CD test:
    - Merge a PR into main
    - Go to Actions tab → "CD" workflow should trigger
    - It builds all 3 apps then pushes images to GHCR
    - Go to your GitHub repo → "Packages" — you'll see api, worker, web
      with tags like "latest" and "abc1234" (7-char git SHA)


STEP 5 — Pull Images on a Server (Future Deployment)
------------------------------------------------------
  Once images are in GHCR, pull them like this on any server:

    docker pull ghcr.io/<owner>/<repo>/api:latest
    docker pull ghcr.io/<owner>/<repo>/worker:latest
    docker pull ghcr.io/<owner>/<repo>/web:latest

  Or use a specific commit:
    docker pull ghcr.io/<owner>/<repo>/api:abc1234

  Replace <owner> with your GitHub username (lowercase) and <repo> with
  the repository name (lowercase), e.g.:
    ghcr.io/xperiaroco2/ai-powered-decision-journal/api:latest

================================================================================
